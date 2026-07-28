import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { unwrapAiResponseEnvelope } from "../ai-response";

import {
  supportChatAttachment,
  supportChatMessage,
  supportChatSession,
  supportKnowledgeChunk,
  supportKnowledgeSource,
  supportLearningEvent,
  registeredDomain,
  supportTicket,
  supportTicketComment,
  subscription,
  invoice,
  caesarChatSession,
  lead,
  vultrInstance,
  website,
  user,
  websiteRuntimeServer,
} from "../../db/schema";
import { splitDomainName } from "./domains";
import { listInstances, rebootInstance, startInstance, stopInstance } from "../vultr";
export type SupportChatTurnInput = {
  sessionId: string;
  userMessageId: string;
  userId: string;
  firstSend: () => Promise<{ toolCalls?: unknown[]; [key: string]: unknown }>;
  secondSend?: (
    toolResults: unknown[],
  ) => Promise<{ toolCalls?: unknown[]; [key: string]: unknown }>;
  executeToolCalls: (toolCalls: unknown[]) => Promise<unknown[]>;
  fallbackToolCalls?: unknown[];
};

export async function completeSupportChatTurn(input: SupportChatTurnInput) {
  let aiResult = await input.firstSend();
  const requestedToolCalls = Array.isArray(aiResult.toolCalls) ? aiResult.toolCalls : [];
  const toolCalls = requestedToolCalls.length
    ? requestedToolCalls
    : (input.fallbackToolCalls ?? []);
  if (toolCalls.length > 0 && input.secondSend) {
    const toolResults = await input.executeToolCalls(toolCalls);
    aiResult = await input.secondSend(toolResults);
  }

  return aiResult;
}

export function shouldOpenNewSupportTicket(
  shouldCreateTicket: boolean,
  linkedTicket?: { status?: string | null } | null,
) {
  // A ticketed turn is an explicit request for a new support case. The chat
  // session may still point at an older open ticket, but that must not cause
  // unrelated requests to be appended as comments to it.
  return shouldCreateTicket;
}

const supportChatSchema = z
  .object({
    sessionId: z.string().optional().nullable(),
    message: z.string().optional().default(""),
    attachmentIds: z.array(z.string().min(1)).optional().default([]),
    clientCapabilities: z
      .object({
        audioReply: z.boolean().optional(),
        imageUpload: z.boolean().optional(),
        voiceNotes: z.boolean().optional(),
      })
      .optional()
      .default({}),
  })
  .refine((body) => body.message.trim().length > 0 || body.attachmentIds.length > 0, {
    message: "Message or attachment is required",
  });

export const supportAgentToolCallSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domain_availability"), domain: z.string().min(3) }),
  z.object({ type: z.literal("owned_domains") }),
  z.object({ type: z.literal("domain_dns"), domain: z.string().min(3) }),
  z.object({
    type: z.literal("domain_dns_create"),
    domain: z.string().min(3),
    recordType: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA"]),
    name: z.string().min(1),
    content: z.string().min(1).optional(),
    ttl: z.number().int().min(60).max(86400).optional().default(3600),
  }),
  z.object({
    type: z.literal("domain_dns_delete"),
    domain: z.string().min(3),
    dnsId: z.union([z.string(), z.number()]).transform(String),
  }),
  z.object({ type: z.literal("domain_info"), domain: z.string().min(3) }),
  z.object({ type: z.literal("vultr_instances") }),
  z.object({
    type: z.literal("vultr_action"),
    instanceId: z.string().min(1),
    action: z.enum(["start", "stop", "reboot"]),
  }),
  z
    .object({
      type: z.literal("website_lookup"),
      websiteId: z.string().min(1).optional(),
      domain: z.string().min(3).optional(),
    })
    .refine((value) => value.websiteId || value.domain, {
      message: "Website ID or domain is required",
    }),
  z.object({
    type: z.literal("website_deploy"),
    websiteId: z.string().min(1),
    deploymentDomain: z.enum(["temporary", "primary"]).optional().default("temporary"),
  }),
  z.object({
    type: z.literal("website_remediate"),
    websiteId: z.string().min(1),
    action: z.literal("restart").default("restart"),
  }),
]);

export function parseAdminDnsMutationRequest(message: string) {
  const isMailjetSetup = /\b(?:SPF|DKIM)\s+Setup\b/i.test(message);
  const isStructuredDnsSetup =
    /^Type$/im.test(message) && /^(?:Host|Hostname)$/im.test(message) && /^Value$/im.test(message);
  if (
    !/\b(add|create|set|update|edit)\b/i.test(message) &&
    !isMailjetSetup &&
    !isStructuredDnsSetup
  ) {
    return [];
  }
  const domain = message.match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i)?.[0];
  if (!domain) return [];

  const records: Array<z.infer<typeof supportAgentToolCallSchema>> = [];
  const rawLines = message.split(/\r?\n/);
  for (const rawLine of rawLines) {
    const line = rawLine.trim().replace(/^[-*]\s+/, "");
    const match = line.match(
      /^(@|\*|_[a-z0-9._-]+|[a-z0-9][a-z0-9._-]*)\s+(A|AAAA|CNAME|MX|TXT|SRV|CAA)\s+(.+)$/i,
    );
    if (!match) continue;
    records.push({
      type: "domain_dns_create",
      domain: domain.toLowerCase(),
      name: match[1],
      recordType: match[2].toUpperCase() as "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV" | "CAA",
      content: match[3].trim().replace(/^"([\s\S]*)"$/, "$1"),
      ttl: 3600,
    });
  }

  if (records.length === 0 && (isMailjetSetup || isStructuredDnsSetup)) {
    const lines = rawLines.map((line) => line.trim()).filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      if (!/^(?:Record Type|Type)$/i.test(lines[index])) continue;
      const recordType = lines[index + 1]?.toUpperCase();
      if (!recordType || !["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA"].includes(recordType)) {
        continue;
      }

      const nextRecordIndex = lines.findIndex(
        (line, candidateIndex) => candidateIndex > index && /^(?:Record Type|Type)$/i.test(line),
      );
      const sectionEnd = nextRecordIndex === -1 ? lines.length : nextRecordIndex;
      const hostnameLabelIndex = lines.findIndex(
        (line, candidateIndex) =>
          candidateIndex > index &&
          candidateIndex < sectionEnd &&
          /^(?:Host|Hostname)$/i.test(line),
      );
      const valueLabelIndex = lines.findIndex(
        (line, candidateIndex) =>
          candidateIndex > hostnameLabelIndex &&
          candidateIndex < sectionEnd &&
          /^Value$/i.test(line),
      );
      if (hostnameLabelIndex === -1 || valueLabelIndex === -1) continue;

      const name = lines[hostnameLabelIndex + 1];
      const valueCandidates = lines
        .slice(valueLabelIndex + 1, sectionEnd)
        .filter(
          (line) =>
            !/^Preview:/i.test(line) && !/^\d+\s+bits$/i.test(line) && !/^Please\b/i.test(line),
        );
      const content =
        valueCandidates.find((line) => /^(?:v=spf1\b|k=rsa;\s*p=)/i.test(line)) ??
        valueCandidates[0];
      if (!name || !content) continue;
      const priorityLabelIndex = lines.findIndex(
        (line, candidateIndex) =>
          candidateIndex > valueLabelIndex &&
          candidateIndex < sectionEnd &&
          /^Priority$/i.test(line),
      );
      const priority =
        priorityLabelIndex !== -1 && /^\d+$/.test(lines[priorityLabelIndex + 1] ?? "")
          ? lines[priorityLabelIndex + 1]
          : null;
      const normalizedContent = content.replace(/^"([\s\S]*)"$/, "$1");

      records.push({
        type: "domain_dns_create",
        domain: domain.toLowerCase(),
        name,
        recordType: recordType as "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV" | "CAA",
        content:
          recordType === "MX" && priority && !/^\d+\s/.test(normalizedContent)
            ? `${priority} ${normalizedContent}`
            : normalizedContent,
        ttl: 3600,
      });
    }
  }
  return records;
}

function isAdminDnsStatusFollowup(message: string) {
  return /^(?:\?+|done\??|status\??|is it done\??|why (?:is|does).*tak)/i.test(message.trim());
}

const supportAgentResponseSchema = z.object({
  reply: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  intent: z
    .enum([
      "support",
      "billing",
      "signup_guidance",
      "domain_check",
      "dns_query",
      "onboarding",
      "general",
    ])
    .optional(),
  createTicket: z.boolean().optional(),
  ticket: z
    .object({
      subject: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      category: z.string().optional(),
    })
    .optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().optional(),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  toolCalls: z.array(supportAgentToolCallSchema).optional().default([]),
  suggestedActions: z
    .array(z.object({ label: z.string(), href: z.string() }))
    .optional()
    .default([]),
  summary: z.string().optional(),
  internalNote: z.string().optional(),
  audioReplyText: z.string().optional(),
});

export function normalizeSupportAgentResponse(input: unknown) {
  const parsed = supportAgentResponseSchema.safeParse(unwrapAiResponseEnvelope(input));
  if (!parsed.success) {
    return {
      reply:
        "I could not process the support assistant response. Please send one more detail and I will try again.",
      intent: "general" as const,
      createTicket: false,
      toolCalls: [],
      suggestedActions: [],
      internalNote: JSON.stringify(parsed.error.flatten()),
    };
  }

  const data = parsed.data;
  return {
    ...data,
    reply:
      data.reply ??
      data.message ??
      "I can help with that. Please send one more detail so I can give you the right next step.",
    createTicket: data.createTicket ?? false,
    toolCalls: data.toolCalls ?? [],
    suggestedActions: data.suggestedActions ?? [],
  };
}

export function shouldCreateEmergencyFallbackTicket(message: string) {
  const haystack = message.toLowerCase();
  return [
    "human",
    "support ticket",
    "agent",
    "site down",
    "website down",
    "cannot access",
    "can't access",
    "payment taken",
    "charged",
    "security breach",
    "hacked",
  ].some((phrase) => haystack.includes(phrase));
}

type SupportChatDependencies = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  makeId: (prefix: string) => string;
  safeJsonParse: (value: string | null | undefined) => any;
  getSupportCrmContext: (userId: string) => Promise<any>;
  resolveSupportChatSession: (userId: string, requestedSessionId?: string | null) => Promise<any>;
  loadSupportChatHistory: (sessionId: string) => Promise<any[]>;
  retrieveSupportKnowledge: (input: {
    userId: string;
    message: string;
    context: Record<string, unknown>;
  }) => Promise<any>;
  sendN8nSupportChat: (input: any) => Promise<any>;
  reserveWalletUsage: (input: any) => Promise<any>;
  commitWalletReservation: (input: any) => Promise<any>;
  releaseWalletReservation: (input: any) => Promise<any>;
  executeToolCalls: (
    userId: string,
    toolCalls: unknown[],
    access?: { isAdmin?: boolean; actorUserId?: string },
  ) => Promise<unknown[]>;
  storeSupportLearning: (input: {
    userId: string;
    sessionId: string;
    ticketId?: string | null;
    message: string;
    reply: string;
    intent?: string;
    summary?: string;
    createTicket: boolean;
  }) => Promise<void>;
  readFile: typeof readFile;
  stat: typeof stat;
  mkdir: typeof mkdir;
  writeFile: typeof writeFile;
  CHAT_UPLOAD_DIR: string;
  getAttachmentKind: (mimeType: string) => string | null;
  maxBytesForAttachment: (kind: string) => number;
  sanitizeFileName: (value: string) => string;
};

export async function sendN8nSupportChat(input: {
  sessionId: string;
  message: string;
  threadContext: Record<string, unknown>;
  conversationHistory: Array<Record<string, unknown>>;
  user: Record<string, unknown>;
  context: Record<string, unknown>;
  ragContext?: Record<string, unknown>;
  attachments?: unknown[];
  toolResults?: unknown[];
  clientCapabilities?: Record<string, unknown>;
  event?: string;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL;
  const webhookSecret =
    process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET ?? process.env.N8N_EMAIL_WEBHOOK_SECRET;
  const cloudMonkeyApiToken =
    process.env.CLOUDMONKEY_API_TOKEN ?? process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Support agent workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      ...(cloudMonkeyApiToken ? { "X-CloudMonkey-API-Token": cloudMonkeyApiToken } : {}),
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: input.event ?? "support.chat.message",
      ...input,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n support agent webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return normalizeSupportAgentResponse(responseText ? JSON.parse(responseText) : {});
  } catch {
    return normalizeSupportAgentResponse({
      reply:
        responseText ||
        "I could not parse the support assistant response. Please send one more detail and I will try again.",
      createTicket: false,
      intent: "general",
      internalNote: "n8n support assistant returned non-JSON output",
    });
  }
}

const SUPPORT_CHAT_HISTORY_LIMIT = 16;

export async function resolveSupportChatSession(
  deps: Pick<SupportChatDependencies, "db" | "makeId">,
  userId: string,
  requestedSessionId?: string | null,
) {
  if (requestedSessionId) {
    const requestedSession = await deps.db.query.supportChatSession.findFirst({
      where: eq(supportChatSession.id, requestedSessionId),
    });
    if (requestedSession) {
      if (requestedSession.userId !== userId) {
        return null;
      }
      return requestedSession;
    }
  }

  const latestOpenSession = await deps.db.query.supportChatSession.findFirst({
    where: and(
      eq(supportChatSession.userId, userId),
      sql`${supportChatSession.status} IN ('open', 'pending')`,
    ),
    orderBy: (supportChatSession: any, { desc }: any) => [desc(supportChatSession.updatedAt)],
  });
  if (latestOpenSession) {
    return latestOpenSession;
  }

  const [createdSession] = await deps.db
    .insert(supportChatSession)
    .values({
      id: deps.makeId("chatsession"),
      userId,
      status: "open",
    })
    .returning();
  return createdSession;
}

export async function loadSupportChatHistory(
  deps: Pick<SupportChatDependencies, "db">,
  sessionId: string,
  limit = SUPPORT_CHAT_HISTORY_LIMIT,
) {
  const rows = await deps.db.query.supportChatMessage.findMany({
    where: eq(supportChatMessage.sessionId, sessionId),
    orderBy: (supportChatMessage: any, { desc }: any) => [
      desc(supportChatMessage.createdAt),
      desc(supportChatMessage.id),
    ],
    limit,
  });

  return rows.reverse().map((row: any) => ({
    id: row.id,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

async function checkDomainAvailability(domain: string) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey || apiKey === "your_domains_co_za_key") {
    throw Object.assign(new Error("Domain availability is not configured"), { status: 503 });
  }

  const response = await fetch(
    `https://api.domains.co.za/api/domain/check?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`,
  );
  if (!response.ok) throw new Error(`Domains API error: ${response.status}`);
  const data = await response.json();
  return { domain: normalizedDomain, result: data };
}

async function fetchOwnedDomainDns(
  deps: Pick<SupportChatDependencies, "db">,
  userId: string,
  domain: string,
  allowAnyDomain = false,
) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const ownership = await deps.db.query.registeredDomain.findFirst({
    where: eq(registeredDomain.id, normalizedDomain),
  });
  if (!allowAnyDomain && (!ownership || ownership.userId !== userId)) {
    throw Object.assign(new Error("Domain is not assigned to this account"), { status: 403 });
  }

  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Domains API is not configured"), { status: 503 });
  const response = await fetch(
    `https://api.domains.co.za/api/domain/dns?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`,
  );
  if (!response.ok) throw new Error(`Domains DNS API error: ${response.status}`);
  return { domain: normalizedDomain, result: await response.json() };
}

async function fetchOwnedDomainInfo(
  deps: Pick<SupportChatDependencies, "db">,
  userId: string,
  domain: string,
  allowAnyDomain = false,
) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const ownership = await deps.db.query.registeredDomain.findFirst({
    where: eq(registeredDomain.id, normalizedDomain),
  });
  if (!allowAnyDomain && (!ownership || ownership.userId !== userId)) {
    throw Object.assign(new Error("Domain is not assigned to this account"), { status: 403 });
  }

  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Domains API is not configured"), { status: 503 });
  const response = await fetch(
    `https://api.domains.co.za/api/domain/info?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`,
  );
  if (!response.ok) throw new Error(`Domains info API error: ${response.status}`);
  return { domain: normalizedDomain, result: await response.json() };
}

export async function getSupportCrmContext(
  deps: Pick<SupportChatDependencies, "db">,
  userId: string,
) {
  const parseStoredJson = (value: string | null | undefined, fallback: unknown) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const [domains, servers, sites, tickets, subs, invoices, caesarSessions, leads] =
    await Promise.all([
      deps.db.query.registeredDomain.findMany({ where: eq(registeredDomain.userId, userId) }),
      deps.db.query.vultrInstance.findMany({ where: eq(vultrInstance.userId, userId) }),
      deps.db.query.website.findMany({ where: eq(website.userId, userId) }),
      deps.db.query.supportTicket.findMany({
        where: eq(supportTicket.userId, userId),
        orderBy: (supportTicket: any, { desc }: any) => [desc(supportTicket.updatedAt)],
      }),
      deps.db.query.subscription.findMany({
        where: eq(subscription.userId, userId),
        orderBy: (subscription: any, { desc }: any) => [desc(subscription.updatedAt)],
      }),
      deps.db.query.invoice.findMany({
        where: eq(invoice.userId, userId),
        orderBy: (invoice: any, { desc }: any) => [desc(invoice.createdAt)],
      }),
      deps.db.query.caesarChatSession.findMany({
        where: eq(caesarChatSession.userId, userId),
        orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
        limit: 5,
      }),
      deps.db.query.lead.findMany({
        where: eq(lead.userId, userId),
        orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
        limit: 5,
      }),
    ]);
  return {
    domains,
    servers,
    websites: sites,
    tickets: tickets.slice(0, 10),
    subscriptions: subs,
    invoices: invoices.filter((row: any) => row.status !== "void").slice(0, 10),
    caesar: {
      sessions: caesarSessions.map((row: any) => ({
        intent: row.intent,
        stage: row.stage,
        qualification: parseStoredJson(row.qualification, {}),
        summary: row.summary,
        updatedAt: row.updatedAt,
      })),
      leads: leads.map((row: any) => ({
        status: row.status,
        services: parseStoredJson(row.services, []),
        businessNeed: row.businessNeed,
        budgetRange: row.budgetRange,
        timeline: row.timeline,
      })),
    },
  };
}

const SUPPORT_RAG_DIMENSIONS = Number(process.env.SUPPORT_RAG_DIMENSIONS ?? 768);
const SUPPORT_RAG_TOP_K = Number(process.env.SUPPORT_RAG_TOP_K ?? 6);
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function redactSupportKnowledge(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone]")
    .replace(/\b(?:sk|pk|api|key|token|secret|password)[_:=\s-]+[A-Za-z0-9_.-]{8,}/gi, "[secret]")
    .slice(0, 6000);
}

function vectorLiteral(values: number[]) {
  if (values.length !== SUPPORT_RAG_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid embedding vector");
  }
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function summarizeDynamicSupportContext(context: Record<string, unknown>) {
  const domains = Array.isArray(context.domains) ? context.domains : [];
  const servers = Array.isArray(context.servers) ? context.servers : [];
  const websites = Array.isArray(context.websites) ? context.websites : [];
  const tickets = Array.isArray(context.tickets) ? context.tickets : [];
  const subscriptions = Array.isArray(context.subscriptions) ? context.subscriptions : [];
  const invoices = Array.isArray(context.invoices) ? context.invoices : [];
  return {
    customerAssets: {
      domains: domains
        .slice(0, 8)
        .map((row: any) => ({ id: row.id, status: row.status, expiryDate: row.expiryDate })),
      servers: servers.slice(0, 8).map((row: any) => ({
        id: row.id,
        label: row.label,
        status: row.status,
        region: row.region,
      })),
      websites: websites
        .slice(0, 8)
        .map((row: any) => ({ id: row.id, domain: row.domain, status: row.status })),
      subscriptions: subscriptions.slice(0, 8).map((row: any) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        interval: row.interval,
      })),
    },
    recentSupport: tickets.slice(0, 5).map((row: any) => ({
      id: row.id,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      category: row.category,
      resolutionSummary: row.resolutionSummary,
    })),
    billing: invoices.slice(0, 5).map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.dueDate,
    })),
  };
}

async function embedSupportText(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = GEMINI_EMBEDDING_MODEL.startsWith("models/")
    ? GEMINI_EMBEDDING_MODEL
    : `models/${GEMINI_EMBEDDING_MODEL}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        content: { parts: [{ text: redactSupportKnowledge(text) }] },
        taskType,
        outputDimensionality: SUPPORT_RAG_DIMENSIONS,
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Gemini embedding failed: ${response.status} ${body.error?.message ?? ""}`.trim(),
    );
  }
  const values = body.embedding?.values ?? body.embeddings?.[0]?.values;
  return Array.isArray(values) ? values.map((value: unknown) => Number(value)) : null;
}

export async function retrieveSupportKnowledge(
  deps: Pick<SupportChatDependencies, "db" | "makeId">,
  input: {
    userId: string;
    message: string;
    context: Record<string, unknown>;
  },
) {
  const dynamicContext = summarizeDynamicSupportContext(input.context);
  const fallbackContext = {
    memoryEnabled: Boolean(process.env.GEMINI_API_KEY),
    retrievedKnowledge: [],
    dynamicContext,
    instructions: [
      "Use retrievedKnowledge only when it matches the user's request.",
      "Use dynamicContext for customer-specific account, billing, domain, server, website, and subscription facts.",
      "Ask a clarifying question when confidence is low.",
      "Do not create a support ticket for normal guidance, FAQs, product selection, read-only domain checks, or DNS explanations.",
    ],
  };

  try {
    const embedding = await embedSupportText(input.message, "RETRIEVAL_QUERY");
    if (!embedding) return fallbackContext;
    const literal = vectorLiteral(embedding);
    const rows = await deps.db.execute(sql`
      SELECT
        c."id",
        c."chunkText",
        c."confidence",
        c."metadata",
        s."title",
        s."sourceType",
        s."visibility",
        1 - (c."embedding" <=> ${literal}::vector) AS "score"
      FROM "support_knowledge_chunk" c
      JOIN "support_knowledge_source" s ON s."id" = c."sourceId"
      WHERE c."status" = 'active'
        AND s."status" = 'active'
        AND (c."userId" IS NULL OR c."userId" = ${input.userId})
        AND (s."userId" IS NULL OR s."userId" = ${input.userId})
      ORDER BY c."embedding" <=> ${literal}::vector
      LIMIT ${SUPPORT_RAG_TOP_K}
    `);
    return {
      ...fallbackContext,
      retrievedKnowledge: rows
        .map((row: any) => ({
          id: row.id,
          title: row.title,
          sourceType: row.sourceType,
          visibility: row.visibility,
          score: Number(row.score ?? 0),
          confidence: row.confidence,
          text: row.chunkText,
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
        }))
        .filter((row: any) => row.score >= 0.45),
    };
  } catch (error) {
    console.error("Support RAG retrieval failed:", error);
    return fallbackContext;
  }
}

export async function storeSupportLearning(
  deps: Pick<SupportChatDependencies, "db" | "makeId">,
  input: {
    userId: string;
    sessionId: string;
    ticketId?: string | null;
    message: string;
    reply: string;
    intent?: string;
    summary?: string;
    createTicket: boolean;
  },
) {
  if (input.createTicket || !process.env.GEMINI_API_KEY) return;
  const reusableIntents = new Set([
    "billing",
    "signup_guidance",
    "domain_check",
    "dns_query",
    "onboarding",
    "general",
  ]);
  if (input.intent && !reusableIntents.has(input.intent)) return;

  const summary = redactSupportKnowledge(
    input.summary || `Customer asked: ${input.message}\nAssistant answered: ${input.reply}`,
  );
  if (summary.length < 80) return;

  try {
    const embedding = await embedSupportText(summary, "RETRIEVAL_DOCUMENT");
    if (!embedding) return;
    const now = new Date();
    const sourceId = deps.makeId("ksrc");
    const chunkId = deps.makeId("kchunk");
    const eventId = deps.makeId("klearn");
    await deps.db.insert(supportKnowledgeSource).values({
      id: sourceId,
      userId: input.userId,
      sourceType: "support_chat_summary",
      title: `AI chat summary ${input.sessionId}`,
      visibility: "customer",
      status: "active",
      metadata: JSON.stringify({ sessionId: input.sessionId, intent: input.intent ?? null }),
    });
    await deps.db.execute(sql`
      INSERT INTO "support_knowledge_chunk"
        ("id", "sourceId", "userId", "chunkText", "embedding", "tokenEstimate", "confidence", "status", "metadata")
      VALUES
        (${chunkId}, ${sourceId}, ${input.userId}, ${summary}, ${vectorLiteral(embedding)}::vector, ${estimateTokens(summary)}, 70, 'active', ${JSON.stringify({ sessionId: input.sessionId, intent: input.intent ?? null })})
    `);
    await deps.db.insert(supportLearningEvent).values({
      id: eventId,
      userId: input.userId,
      sessionId: input.sessionId,
      ticketId: input.ticketId ?? null,
      sourceId,
      eventType: "support_chat_summary",
      summary,
      status: "stored",
      metadata: JSON.stringify({ intent: input.intent ?? null }),
    });
  } catch (error) {
    console.error("Support learning storage failed:", error);
  }
}

export async function executeSupportToolCalls(
  deps: Pick<SupportChatDependencies, "db"> & {
    recordAudit?: (input: Record<string, unknown>) => Promise<void>;
    provisionWebsiteRuntime?: (
      userId: string,
      websiteId: string,
      options?: { deploymentDomain?: "temporary" | "primary"; skipAgreementCheck?: boolean },
    ) => Promise<unknown>;
    remediateWebsite?: (websiteId: string, actorUserId: string) => Promise<unknown>;
  },
  userId: string,
  toolCalls: z.infer<typeof supportAgentToolCallSchema>[],
  access: { isAdmin?: boolean; actorUserId?: string } = {},
) {
  const parseProviderResponse = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const results = [];
  // DNS and mail-provider setup instructions commonly contain five or more
  // records in one approved batch (for example, two MX records plus TXT,
  // SPF, and DKIM). Keep a finite cap while allowing the complete batch.
  for (const toolCall of toolCalls.slice(0, 10)) {
    try {
      if (toolCall.type === "domain_availability") {
        results.push({ toolCall, ok: true, data: await checkDomainAvailability(toolCall.domain) });
      } else if (toolCall.type === "owned_domains") {
        const domains = await deps.db.query.registeredDomain.findMany(
          access.isAdmin ? {} : { where: eq(registeredDomain.userId, userId) },
        );
        results.push({ toolCall, ok: true, data: domains });
      } else if (toolCall.type === "domain_dns") {
        results.push({
          toolCall,
          ok: true,
          data: await fetchOwnedDomainDns(deps, userId, toolCall.domain, access.isAdmin === true),
        });
      } else if (toolCall.type === "domain_dns_create") {
        if (!access.isAdmin) {
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        }
        const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
        if (!apiKey) throw new Error("Domains API is not configured");
        const parts = splitDomainName(toolCall.domain);
        let recordContent = toolCall.content?.trim() ?? "";
        if (!recordContent && ["A", "AAAA"].includes(toolCall.recordType)) {
          const site = await deps.db.query.website.findFirst({
            where: (row: any) =>
              or(
                eq(row.domain, parts.domain),
                eq(row.primaryDomain, parts.domain),
                eq(row.temporaryDomain, parts.domain),
              ),
          });
          if (site?.runtimeServerId) {
            const runtime = await deps.db.query.websiteRuntimeServer.findFirst({
              where: eq(websiteRuntimeServer.id, site.runtimeServerId),
            });
            recordContent = runtime?.publicIp ?? runtime?.ingressIp ?? runtime?.privateIp ?? "";
          }
        }
        if (!recordContent) {
          throw new Error(
            "DNS record content is required, or provide a managed website domain so its runtime IP can be resolved",
          );
        }
        const currentResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&key=${apiKey}`,
        );
        const currentText = await currentResponse.text();
        if (!currentResponse.ok) {
          throw new Error(`Domains API returned ${currentResponse.status}: ${currentText}`);
        }
        const currentData = currentText ? parseProviderResponse(currentText) : null;
        const existingRecords =
          currentData && typeof currentData === "object" && Array.isArray(currentData.arrRecords)
            ? currentData.arrRecords
            : [];
        const mxContentMatch =
          toolCall.recordType === "MX" ? recordContent.match(/^(\d+)\s+(.+)$/) : null;
        const providerContent = mxContentMatch?.[2] ?? recordContent;
        const providerPriority = mxContentMatch ? Number(mxContentMatch[1]) : null;
        const normalizedDomain = parts.domain.replace(/\.$/, "").toLowerCase();
        const expectedName =
          toolCall.name === "@"
            ? normalizedDomain
            : toolCall.name.toLowerCase().endsWith(`.${normalizedDomain}`)
              ? toolCall.name.replace(/\.$/, "").toLowerCase()
              : `${toolCall.name.replace(/\.$/, "").toLowerCase()}.${normalizedDomain}`;
        const existingRecord = existingRecords.find(
          (record: any) =>
            String(record.type ?? "").toUpperCase() === toolCall.recordType &&
            String(record.name ?? record.host ?? "")
              .replace(/\.$/, "")
              .toLowerCase() === expectedName &&
            String(record.content ?? record.value ?? "").trim() === providerContent &&
            (providerPriority === null ||
              Number(record.prio ?? record.priority) === providerPriority),
        );
        if (existingRecord) {
          results.push({
            toolCall,
            ok: true,
            data: { completed: true, alreadyExists: true, record: existingRecord },
          });
          continue;
        }
        const providerResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sld: parts.sld,
              tld: parts.tld,
              type: toolCall.recordType,
              // Domains.co.za expects an empty name for the zone apex. Sending
              // the conventional "@" label creates the literal host
              // "@.example.com" instead.
              name: toolCall.name === "@" ? "" : toolCall.name,
              content: providerContent,
              ...(providerPriority === null ? {} : { prio: providerPriority }),
              ttl: toolCall.ttl,
            }),
          },
        );
        const responseText = await providerResponse.text();
        const data = responseText ? parseProviderResponse(responseText) : null;
        if (!providerResponse.ok) {
          throw new Error(`Domains API returned ${providerResponse.status}: ${responseText}`);
        }
        await deps.recordAudit?.({
          actorUserId: access.actorUserId ?? userId,
          action: "copilot.domain.dns_created",
          entityType: "registered_domain",
          entityId: parts.domain,
          message: `Admin copilot added ${toolCall.recordType} record ${toolCall.name}`,
          metadata: { source: "support_chat", record: toolCall },
        });
        results.push({ toolCall, ok: true, data });
      } else if (toolCall.type === "domain_dns_delete") {
        if (!access.isAdmin) {
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        }
        const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
        if (!apiKey) throw new Error("Domains API is not configured");
        const parts = splitDomainName(toolCall.domain);
        const providerResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&dnsId=${encodeURIComponent(toolCall.dnsId)}&key=${apiKey}`,
          { method: "DELETE" },
        );
        const responseText = await providerResponse.text();
        const data = responseText ? parseProviderResponse(responseText) : null;
        if (!providerResponse.ok) {
          throw new Error(`Domains API returned ${providerResponse.status}: ${responseText}`);
        }
        await deps.recordAudit?.({
          actorUserId: access.actorUserId ?? userId,
          action: "copilot.domain.dns_deleted",
          entityType: "registered_domain",
          entityId: parts.domain,
          message: `Admin copilot deleted DNS record ${toolCall.dnsId}`,
          metadata: { source: "support_chat", dnsId: toolCall.dnsId },
        });
        results.push({ toolCall, ok: true, data });
      } else if (toolCall.type === "domain_info") {
        results.push({
          toolCall,
          ok: true,
          data: await fetchOwnedDomainInfo(deps, userId, toolCall.domain, access.isAdmin === true),
        });
      } else if (toolCall.type === "vultr_instances") {
        if (!access.isAdmin) {
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        }
        results.push({ toolCall, ok: true, data: await listInstances() });
      } else if (toolCall.type === "vultr_action") {
        if (!access.isAdmin) {
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        }
        if (toolCall.action === "start") await startInstance(toolCall.instanceId);
        if (toolCall.action === "stop") await stopInstance(toolCall.instanceId);
        if (toolCall.action === "reboot") await rebootInstance(toolCall.instanceId);
        await deps.recordAudit?.({
          actorUserId: access.actorUserId ?? userId,
          action: `copilot.vultr.${toolCall.action}`,
          entityType: "vultr_instance",
          entityId: toolCall.instanceId,
          message: `Admin copilot requested Vultr ${toolCall.action}`,
          metadata: { source: "support_chat" },
        });
        results.push({ toolCall, ok: true, data: { completed: true } });
      } else if (toolCall.type === "website_lookup") {
        const websiteRow = await deps.db.query.website.findFirst({
          where: (row: any) => {
            const filters = [];
            if (toolCall.websiteId) filters.push(eq(row.id, toolCall.websiteId));
            if (toolCall.domain) {
              const domain = toolCall.domain.trim().toLowerCase();
              filters.push(
                eq(row.domain, domain),
                eq(row.primaryDomain, domain),
                eq(row.temporaryDomain, domain),
              );
            }
            return filters.length === 1 ? filters[0] : or(...filters);
          },
        });
        if (!websiteRow)
          throw Object.assign(new Error("Website record not found"), { status: 404 });
        const runtime = websiteRow.runtimeServerId
          ? await deps.db.query.websiteRuntimeServer.findFirst({
              where: eq(websiteRuntimeServer.id, websiteRow.runtimeServerId),
            })
          : null;
        results.push({
          toolCall,
          ok: true,
          data: {
            id: websiteRow.id,
            domain: websiteRow.domain,
            status: websiteRow.status,
            aiGenerationStatus: websiteRow.aiGenerationStatus,
            temporaryDomain: websiteRow.temporaryDomain,
            primaryDomain: websiteRow.primaryDomain,
            containerStatus: websiteRow.containerStatus,
            runtimeServer: runtime
              ? {
                  id: runtime.id,
                  profileName: runtime.profileName,
                  hostname: runtime.hostname,
                  publicIp: runtime.publicIp,
                  privateIp: runtime.privateIp,
                  status: runtime.status,
                }
              : null,
          },
        });
      } else if (toolCall.type === "website_deploy") {
        if (!access.isAdmin)
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        if (!deps.provisionWebsiteRuntime) throw new Error("Website deployment is not configured");
        const data = await deps.provisionWebsiteRuntime(userId, toolCall.websiteId, {
          deploymentDomain: toolCall.deploymentDomain,
          skipAgreementCheck: access.isAdmin === true,
        });
        await deps.recordAudit?.({
          actorUserId: access.actorUserId ?? userId,
          action: "copilot.website.deploy",
          entityType: "website",
          entityId: toolCall.websiteId,
          message: `Admin copilot deployed website ${toolCall.websiteId}`,
          metadata: { source: "support_chat", deploymentDomain: toolCall.deploymentDomain },
        });
        results.push({ toolCall, ok: true, data });
      } else if (toolCall.type === "website_remediate") {
        if (!access.isAdmin)
          throw Object.assign(new Error("Administrator access is required"), { status: 403 });
        if (!deps.remediateWebsite) throw new Error("Website remediation is not configured");
        const data = await deps.remediateWebsite(toolCall.websiteId, access.actorUserId ?? userId);
        results.push({ toolCall, ok: true, data });
      }
    } catch (error) {
      results.push({
        toolCall,
        ok: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      });
    }
  }
  return results;
}

function attachmentDto(row: typeof supportChatAttachment.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    kind: row.kind,
    mimeType: row.mimeType,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createSupportChatHandlers(deps: SupportChatDependencies) {
  return {
    async handleUserSupportChat(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const { session, response } = await deps.requireSession(request);
      if (response) return response;

      const uploadMatch = url.pathname.match(/^\/api\/user\/support-chat\/uploads\/([^/]+)$/);
      if (uploadMatch && request.method === "GET") {
        const attachmentId = decodeURIComponent(uploadMatch[1]);
        const attachment = await deps.db.query.supportChatAttachment.findFirst({
          where: eq(supportChatAttachment.id, attachmentId),
        });
        if (!attachment || attachment.userId !== session.user.id)
          return deps.json({ error: "Attachment not found" }, 404);
        const fileStat = await deps.stat(attachment.storagePath).catch(() => null);
        if (!fileStat?.isFile()) return deps.json({ error: "Attachment file not found" }, 404);
        return new Response(await deps.readFile(attachment.storagePath), {
          headers: {
            "Content-Type": attachment.mimeType,
            "Content-Length": String(attachment.sizeBytes),
            "Content-Disposition": `inline; filename="${deps.sanitizeFileName(attachment.fileName)}"`,
          },
        });
      }

      if (url.pathname === "/api/user/support-chat/uploads" && request.method === "POST") {
        try {
          const formData = await request.formData();
          const requestedSessionId =
            typeof formData.get("sessionId") === "string"
              ? String(formData.get("sessionId"))
              : null;
          const chatSession = await deps.resolveSupportChatSession(
            session.user.id,
            requestedSessionId,
          );
          if (requestedSessionId && chatSession === null)
            return deps.json({ error: "Chat session not found" }, 404);

          const rawFiles = [...formData.getAll("files"), ...formData.getAll("file")];
          const files = rawFiles.filter((file): file is File => file instanceof File);
          if (!files.length) return deps.json({ error: "No files uploaded" }, 400);
          if (files.length > 4) return deps.json({ error: "Upload up to 4 files at a time" }, 400);

          await deps.mkdir(deps.CHAT_UPLOAD_DIR, { recursive: true });
          const saved = [];
          for (const file of files) {
            const kind = deps.getAttachmentKind(file.type);
            if (!kind)
              return deps.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, 400);
            if (file.size > deps.maxBytesForAttachment(kind)) {
              return deps.json(
                { error: `${kind === "image" ? "Image" : "Audio"} upload is too large` },
                413,
              );
            }

            const attachmentId = deps.makeId("chatatt");
            const extension =
              path.extname(file.name || "") || (kind === "image" ? ".bin" : ".webm");
            const storagePath = path.join(deps.CHAT_UPLOAD_DIR, `${attachmentId}${extension}`);
            await deps.writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
            const [attachment] = await deps.db
              .insert(supportChatAttachment)
              .values({
                id: attachmentId,
                sessionId: chatSession.id,
                userId: session.user.id,
                kind,
                mimeType: file.type,
                fileName: deps.sanitizeFileName(file.name || `${kind}${extension}`),
                sizeBytes: file.size,
                storagePath,
                metadata: JSON.stringify({ originalName: file.name || null }),
              })
              .returning();
            saved.push(attachmentDto(attachment));
          }

          return deps.json({ session: chatSession, attachments: saved }, 201);
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method === "POST") {
        try {
          const body = await deps.parseBody(request, supportChatSchema);
          const chatSession = await deps.resolveSupportChatSession(session.user.id, body.sessionId);
          if (body.sessionId && chatSession === null) {
            return deps.json({ error: "Chat session not found" }, 404);
          }

          const userMessageId = deps.makeId("chatmsg");

          const userMessage = await deps.db
            .insert(supportChatMessage)
            .values({
              id: userMessageId,
              sessionId: chatSession.id,
              userId: session.user.id,
              role: "user",
              body: body.message,
            })
            .returning();

          const [createdUserMessage] = userMessage;
          const attachments = body.attachmentIds.length
            ? await deps.db.query.supportChatAttachment.findMany({
                where: eq(supportChatAttachment.sessionId, chatSession.id),
              })
            : [];
          const selectedAttachments = attachments.filter(
            (attachment) =>
              body.attachmentIds.includes(attachment.id) && attachment.userId === session.user.id,
          );
          if (body.attachmentIds.length !== selectedAttachments.length) {
            return deps.json({ error: "One or more attachments were not found" }, 400);
          }
          for (const attachment of selectedAttachments) {
            await deps.db
              .update(supportChatAttachment)
              .set({
                messageId: createdUserMessage.id,
                metadata: JSON.stringify({
                  ...(deps.safeJsonParse(attachment.metadata) ?? {}),
                  attachedToMessageAt: new Date().toISOString(),
                }),
              })
              .where(eq(supportChatAttachment.id, attachment.id));
          }

          const crmContext = await deps.getSupportCrmContext(session.user.id);
          const threadContext = {
            session: {
              id: chatSession.id,
              status: chatSession.status,
              summary: chatSession.summary,
              ticketId: chatSession.ticketId,
              createdAt: chatSession.createdAt?.toISOString?.() ?? null,
              updatedAt: chatSession.updatedAt?.toISOString?.() ?? null,
            },
          };
          const conversationHistory = await deps.loadSupportChatHistory(chatSession.id);
          if (["admin", "owner"].includes(String(session.user.role ?? ""))) {
            conversationHistory.unshift({
              role: "system",
              content: [
                "ADMIN COPILOT ACCESS: this authenticated user has platform-wide access.",
                "Do not apply customer ownership restrictions to domain or Vultr lookups.",
                "Available admin tools include domain_dns, domain_dns_create, and domain_dns_delete for any domain, domain_info, owned_domains for all managed domains, website_lookup, website_deploy, website_remediate, vultr_instances, and vultr_action with start, stop, or reboot.",
                "For an authorized admin DNS or Vultr operation, execute the tool and never create a support ticket instead.",
                "Use website_lookup to inspect a managed website before deploying or remediating it. website_deploy and website_remediate require an explicit admin request; never trigger them autonomously.",
                "Use a tool when the admin asks you to inspect or fix a supported service; report the actual tool result and never claim success before it completes.",
              ].join(" "),
            });
          }
          const ragContext = await deps.retrieveSupportKnowledge({
            userId: session.user.id,
            message: body.message,
            context: crmContext,
          });
          const supportUser = await deps.db.query.user.findFirst({
            where: eq(user.id, session.user.id),
          });
          const isAdminSession = ["admin", "owner"].includes(String(session.user.role ?? ""));
          const currentAdminDnsTools = isAdminSession
            ? parseAdminDnsMutationRequest(body.message)
            : [];
          const priorAdminDnsTools =
            isAdminSession &&
            currentAdminDnsTools.length === 0 &&
            isAdminDnsStatusFollowup(body.message)
              ? ([...conversationHistory]
                  .reverse()
                  .filter((item: any) => item.role === "user" && item.body !== body.message)
                  .map((item: any) => parseAdminDnsMutationRequest(String(item.body ?? "")))
                  .find((toolCalls) => toolCalls.length > 0) ?? [])
              : [];
          const agentMessage = isAdminSession
            ? [
                "ADMIN OPERATION POLICY: You are authorized to perform platform-wide service operations.",
                "Never create a support ticket for a DNS or Vultr operation that an available tool can perform.",
                "For website status use website_lookup with the website ID or domain. For an explicit deployment request use website_deploy; for an explicit restart request use website_remediate with action restart. Never trigger deployment or remediation autonomously.",
                "To add DNS use toolCalls entries shaped as {type:'domain_dns_create',domain,recordType,name,content,ttl}.",
                "For A or AAAA records on a managed website, content may be omitted and the tool will resolve the assigned runtime IP; keep manual content when a specific target is intended.",
                "To delete DNS use {type:'domain_dns_delete',domain,dnsId}. For DNS inspection use {type:'domain_dns',domain}.",
                "Return the tool call first; only report success after toolResults confirm it.",
                "ADMIN REQUEST:",
                body.message,
              ].join("\n")
            : body.message;
          let aiResult: ReturnType<typeof normalizeSupportAgentResponse>;
          const attachmentPayload = selectedAttachments.map(attachmentDto);
          let walletReservation: any = null;
          if (!isAdminSession) {
            try {
              walletReservation = await deps.reserveWalletUsage({
                userId: session.user.id,
                featureKey: "support_chat",
                quantity: 1,
                sourceType: "support_chat",
                sourceId: userMessageId,
                requestIdempotencyKey: `support-chat:${chatSession.id}:${userMessageId}`,
                metadata: {
                  sessionId: chatSession.id,
                  messageId: userMessageId,
                },
              });
            } catch (error: any) {
              return deps.json(
                { error: error.message || "Insufficient token balance" },
                error.status ?? 500,
              );
            }
          }
          try {
            aiResult = await completeSupportChatTurn({
              sessionId: chatSession.id,
              userMessageId,
              userId: session.user.id,
              firstSend: () =>
                deps.sendN8nSupportChat({
                  sessionId: chatSession.id,
                  message: agentMessage,
                  user: {
                    id: session.user.id,
                    name: session.user.name ?? null,
                    email: session.user.email ?? null,
                    role: session.user.role ?? null,
                    whatsapp: supportUser?.whatsapp ?? null,
                    allowMutations: ["admin", "owner"].includes(String(session.user.role ?? "")),
                  },
                  threadContext,
                  conversationHistory,
                  context: crmContext,
                  ragContext,
                  attachments: attachmentPayload,
                  clientCapabilities: body.clientCapabilities,
                  idempotencyKey: `support-chat:${chatSession.id}:${userMessageId}`,
                }),
              secondSend: (toolResults) =>
                deps.sendN8nSupportChat({
                  sessionId: chatSession.id,
                  message: agentMessage,
                  user: {
                    id: session.user.id,
                    name: session.user.name ?? null,
                    email: session.user.email ?? null,
                    role: session.user.role ?? null,
                    whatsapp: supportUser?.whatsapp ?? null,
                    allowMutations: ["admin", "owner"].includes(String(session.user.role ?? "")),
                  },
                  threadContext,
                  conversationHistory,
                  context: crmContext,
                  ragContext,
                  attachments: attachmentPayload,
                  toolResults,
                  clientCapabilities: body.clientCapabilities,
                  event: "support.chat.tool_results",
                  idempotencyKey: `support-chat-tools:${chatSession.id}:${userMessageId}`,
                }),
              executeToolCalls: (toolCalls) =>
                deps.executeToolCalls(session.user.id, toolCalls, {
                  isAdmin: ["admin", "owner"].includes(String(session.user.role ?? "")),
                  actorUserId: session.user.id,
                }),
              fallbackToolCalls:
                currentAdminDnsTools.length > 0 ? currentAdminDnsTools : priorAdminDnsTools,
            });
            if (walletReservation) {
              await deps.commitWalletReservation({
                reservationId: walletReservation.reservation.id,
                sourceId: userMessageId,
                metadata: { sessionId: chatSession.id, messageId: userMessageId },
              });
            }
          } catch (error: any) {
            if (walletReservation) {
              await deps
                .releaseWalletReservation({
                  reservationId: walletReservation.reservation.id,
                  reason: "support_agent_webhook_failed",
                  metadata: { sessionId: chatSession.id, messageId: userMessageId },
                })
                .catch(() => undefined);
            }
            const shouldEscalate = shouldCreateEmergencyFallbackTicket(body.message);
            aiResult = {
              reply: shouldEscalate
                ? "I could not reach the AI assistant, so I have created a support ticket for the CloudMonkey team."
                : "I could not reach the AI assistant right now. You can try again in a moment or open a support ticket from the support page.",
              intent: shouldEscalate ? "support" : "general",
              createTicket: shouldEscalate,
              toolCalls: [],
              suggestedActions: shouldEscalate
                ? []
                : [{ label: "Open support", href: "/dashboard/support" }],
              subject: body.message.slice(0, 80),
              description: body.message,
              priority: "medium",
              category: "general",
              error: error.message,
            } as ReturnType<typeof normalizeSupportAgentResponse>;
          }

          const reply = String(
            aiResult?.reply ?? aiResult?.message ?? "I have logged this for the CloudMonkey team.",
          );
          const shouldCreateTicket = aiResult?.createTicket === true;
          let ticket = chatSession.ticketId
            ? await deps.db.query.supportTicket.findFirst({
                where: eq(supportTicket.id, chatSession.ticketId),
              })
            : null;

          if (shouldOpenNewSupportTicket(shouldCreateTicket, ticket)) {
            const subject =
              String(aiResult?.ticket?.subject ?? aiResult?.subject ?? body.message).slice(
                0,
                120,
              ) || "AI support request";
            const description = String(
              aiResult?.ticket?.description ?? aiResult?.description ?? body.message,
            );
            const priority = aiResult?.ticket?.priority ?? aiResult?.priority;
            const [createdTicket] = await deps.db
              .insert(supportTicket)
              .values({
                id: deps.makeId("ticket"),
                userId: session.user.id,
                subject,
                description,
                priority:
                  priority && ["low", "medium", "high", "urgent"].includes(priority)
                    ? priority
                    : "medium",
                status: ["open", "pending", "resolved", "closed"].includes(aiResult?.status)
                  ? aiResult.status
                  : "open",
                category: String(aiResult?.ticket?.category ?? aiResult?.category ?? "support"),
                source: "ai_chat",
                aiSessionId: chatSession.id,
                lastCustomerMessageAt: new Date(),
              })
              .returning();
            ticket = createdTicket;
            await deps.db
              .update(supportChatSession)
              .set({
                ticketId: createdTicket.id,
                summary: aiResult?.summary ? String(aiResult.summary) : subject,
                updatedAt: new Date(),
              })
              .where(eq(supportChatSession.id, chatSession.id));
          } else if (ticket) {
            await deps.db
              .update(supportTicket)
              .set({
                lastCustomerMessageAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(supportTicket.id, ticket.id));
          }

          if (ticket && aiResult?.internalNote) {
            await deps.db.insert(supportTicketComment).values({
              id: deps.makeId("comment"),
              ticketId: ticket.id,
              userId: session.user.id,
              body: `[AI] ${String(aiResult.internalNote)}`,
              isInternal: true,
            });
          }

          const [assistantMessage] = await deps.db
            .insert(supportChatMessage)
            .values({
              id: deps.makeId("chatmsg"),
              sessionId: chatSession.id,
              userId: session.user.id,
              role: "assistant",
              body: reply,
              metadata: JSON.stringify(aiResult ?? {}),
            })
            .returning();
          await deps.db
            .update(supportChatSession)
            .set({ updatedAt: new Date() })
            .where(eq(supportChatSession.id, chatSession.id));
          await deps.storeSupportLearning({
            userId: session.user.id,
            sessionId: chatSession.id,
            ticketId: ticket?.id ?? null,
            message: body.message,
            reply,
            intent: aiResult.intent,
            summary: aiResult.summary,
            createTicket: shouldCreateTicket,
          });

          return deps.json({
            session: await deps.db.query.supportChatSession.findFirst({
              where: eq(supportChatSession.id, chatSession.id),
            }),
            reply,
            ticket,
            messages: [createdUserMessage, assistantMessage],
            attachments: selectedAttachments.map(attachmentDto),
            suggestedActions: aiResult.suggestedActions,
            intent: aiResult.intent,
            audioReplyText: aiResult.audioReplyText,
          });
        } catch (error: any) {
          return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return deps.json({ error: "Method not allowed" }, 405);
    },
  };
}
