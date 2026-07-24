import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  caesarChatMessage,
  caesarChatSession,
  lead,
} from "../../db/schema";

const CAESAR_HISTORY_LIMIT = 18;
const CAESAR_SESSION_MESSAGE_LIMIT = 40;
const CAESAR_IP_MESSAGES_PER_HOUR = 30;
const ALLOWED_ACTION_PATHS = new Set([
  "/pricing",
  "/domains",
  "/build",
  "/cloud",
  "/business",
  "/marketing",
  "/voice",
  "/ai",
  "/ai-agents",
  "/auth/sign-up",
  "/auth/sign-in",
  "/dashboard",
  "/dashboard/ai-wizard",
]);

const serviceInterestSchema = z.enum([
  "cloud",
  "build",
  "domains",
  "business_it",
  "marketing",
  "voice",
  "ai",
  "not_sure",
]);

export const caesarQualificationSchema = z.object({
  fullName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  serviceInterests: z.array(serviceInterestSchema).max(4).optional().default([]),
  businessNeed: z.string().trim().max(800).optional().nullable(),
  budgetRange: z.string().trim().max(80).optional().nullable(),
  timeline: z.string().trim().max(80).optional().nullable(),
  consentToContact: z.boolean().optional().default(false),
});

const caesarAgentResponseSchema = z.object({
  reply: z.string().trim().min(1).max(1800),
  intent: z
    .enum([
      "discover",
      "recommend",
      "pricing",
      "domains",
      "registration",
      "handoff",
      "out_of_scope",
    ])
    .default("discover"),
  stage: z.enum(["discover", "qualify", "recommend", "register", "complete"]).default("discover"),
  qualification: caesarQualificationSchema.partial().optional().default({}),
  summary: z.string().trim().max(1200).optional().nullable(),
  suggestedActions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        href: z.string().trim().min(1).max(200),
      }),
    )
    .max(3)
    .optional()
    .default([]),
});

const caesarIntents = [
  "discover",
  "recommend",
  "pricing",
  "domains",
  "registration",
  "handoff",
  "out_of_scope",
] as const;
const caesarStages = ["discover", "qualify", "recommend", "register", "complete"] as const;

const publicCaesarSchema = z.object({
  action: z.enum(["resume", "message"]).default("message"),
  sessionId: z.string().trim().max(100).optional().nullable(),
  sessionToken: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().max(800).optional().default(""),
});

const claimCaesarSchema = z.object({
  sessionId: z.string().trim().min(1).max(100),
  sessionToken: z.string().trim().min(20).max(200),
});

type CaesarDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  makeId: (prefix: string) => string;
  recordAudit: (input: any) => Promise<void>;
};

type RateEntry = { count: number; resetsAt: number };
const ipRateLimits = new Map<string, RateEntry>();

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function secretHash(value: string) {
  const pepper = process.env.BETTER_AUTH_SECRET ?? "cloudmonkey-caesar";
  return crypto.createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function enforceIpRateLimit(request: Request) {
  const now = Date.now();
  const key = secretHash(clientIp(request));
  const current = ipRateLimits.get(key);
  if (!current || current.resetsAt <= now) {
    ipRateLimits.set(key, { count: 1, resetsAt: now + 60 * 60 * 1000 });
    return { key, allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > CAESAR_IP_MESSAGES_PER_HOUR) {
    return {
      key,
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
    };
  }
  return { key, allowed: true, retryAfter: 0 };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function compactQualification(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const stringFields = [
    ["fullName", 120],
    ["phone", 40],
    ["company", 160],
    ["country", 80],
    ["businessNeed", 800],
    ["budgetRange", 80],
    ["timeline", 80],
  ] as const;
  for (const [field, max] of stringFields) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) result[field] = value.trim().slice(0, max);
  }
  const email = z.string().trim().email().max(180).safeParse(source.email);
  if (email.success) result.email = email.data;
  if (Array.isArray(source.serviceInterests)) {
    const interests = source.serviceInterests
      .map((value) => serviceInterestSchema.safeParse(value))
      .filter((value) => value.success)
      .map((value) => value.data)
      .slice(0, 4);
    if (interests.length) result.serviceInterests = [...new Set(interests)];
  }
  if (typeof source.consentToContact === "boolean") {
    result.consentToContact = source.consentToContact;
  }
  return result;
}

export function normalizeCaesarAgentResponse(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const reply = typeof source.reply === "string" ? source.reply.trim().slice(0, 1800) : "";
  const intent = caesarIntents.includes(source.intent as any)
    ? source.intent as (typeof caesarIntents)[number]
    : "discover";
  const stage = caesarStages.includes(source.stage as any)
    ? source.stage as (typeof caesarStages)[number]
    : "discover";
  const summary = typeof source.summary === "string"
    ? source.summary.trim().slice(0, 1200) || null
    : null;
  const suggestedActions = Array.isArray(source.suggestedActions)
    ? source.suggestedActions.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const action = item as Record<string, unknown>;
        if (typeof action.label !== "string" || typeof action.href !== "string") return [];
        const label = action.label.trim().slice(0, 60);
        const href = action.href.trim().slice(0, 200);
        return label && href ? [{ label, href }] : [];
      }).slice(0, 3)
    : [];

  return caesarAgentResponseSchema.parse({
    reply: reply || "I lost my place in the canopy for a moment. Tell me which CloudMonkey service you are considering and I’ll continue.",
    intent,
    stage,
    qualification: compactQualification(source.qualification),
    summary,
    suggestedActions,
  });
}

function mergeQualification(current: unknown, incoming: unknown) {
  const previous = compactQualification(current);
  const next = compactQualification(incoming);
  return caesarQualificationSchema.parse({
    ...previous,
    ...next,
    serviceInterests:
      "serviceInterests" in next ? next.serviceInterests : previous.serviceInterests ?? [],
  });
}

export function isCaesarLeadReady(qualification: z.infer<typeof caesarQualificationSchema>) {
  return Boolean(
    qualification.fullName &&
      qualification.email &&
      qualification.company &&
      qualification.country &&
      qualification.businessNeed &&
      qualification.serviceInterests.length > 0 &&
      qualification.consentToContact,
  );
}

export function filterCaesarActions(
  actions: z.infer<typeof caesarAgentResponseSchema>["suggestedActions"],
  leadReady: boolean,
) {
  const filtered = actions.filter((action) => {
    try {
      const parsed = new URL(action.href, "https://cloudmonkey.local");
      return (
        parsed.origin === "https://cloudmonkey.local" &&
        ALLOWED_ACTION_PATHS.has(parsed.pathname)
      );
    } catch {
      return false;
    }
  });

  if (leadReady && !filtered.some((action) => action.href.startsWith("/auth/sign-up"))) {
    filtered.unshift({ label: "Create my account", href: "/auth/sign-up" });
  }
  return filtered.slice(0, 3);
}

function initialReply() {
  return {
    reply:
      "I’m Caesar, CloudMonkey’s digital guide. Tell me what you want your business to build, improve, automate, host, or protect, and I’ll help you find the right next step.",
    intent: "discover",
    stage: "discover",
    suggestedActions: [
      { label: "Explore pricing", href: "/pricing" },
      { label: "Find a domain", href: "/domains" },
    ],
  };
}

async function sendN8nCaesar(input: {
  sessionId: string;
  message: string;
  history: Array<Record<string, unknown>>;
  qualification: Record<string, unknown>;
  productContext: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl =
    process.env.N8N_CAESAR_AGENT_WEBHOOK_URL ??
    "http://n8n:5678/webhook/cloudmonkey/caesar/agent";
  const webhookSecret =
    process.env.N8N_CAESAR_AGENT_WEBHOOK_SECRET ??
    process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) throw new Error("Caesar workflow is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CloudMonkey-Webhook-Secret": webhookSecret,
        "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({ event: "caesar.sales.message", ...input }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Caesar workflow failed with status ${response.status}`);
    let parsed: unknown = {};
    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.warn("Caesar workflow returned non-JSON output; using a safe fallback");
    }
    return normalizeCaesarAgentResponse(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadHistory(deps: CaesarDeps, sessionId: string) {
  const rows = await deps.db.query.caesarChatMessage.findMany({
    where: eq(caesarChatMessage.sessionId, sessionId),
    orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
    limit: CAESAR_HISTORY_LIMIT,
  });
  return rows.reverse().map((row: any) => ({
    ...parseJson(row.metadata, {}),
    id: row.id,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }));
}

async function resolveSession(
  deps: CaesarDeps,
  requestedId?: string | null,
  requestedToken?: string | null,
) {
  if (requestedId || requestedToken) {
    if (!requestedId || !requestedToken) return { error: "Incomplete Caesar session" } as const;
    const existing = await deps.db.query.caesarChatSession.findFirst({
      where: eq(caesarChatSession.id, requestedId),
    });
    if (!existing || !safeEqual(existing.visitorTokenHash, secretHash(requestedToken))) {
      return { error: "Caesar session not found" } as const;
    }
    return { session: existing, sessionToken: requestedToken, created: false } as const;
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const [session] = await deps.db
    .insert(caesarChatSession)
    .values({
      id: deps.makeId("caesar"),
      visitorTokenHash: secretHash(token),
      status: "open",
      stage: "discover",
      qualification: JSON.stringify({ serviceInterests: [], consentToContact: false }),
    })
    .returning();
  return { session, sessionToken: token, created: true } as const;
}

async function persistLead(
  deps: CaesarDeps,
  session: any,
  qualification: z.infer<typeof caesarQualificationSchema>,
  summary?: string | null,
) {
  if (!qualification.fullName || !qualification.email || !qualification.consentToContact) {
    return session.leadId ?? null;
  }
  const leadReady = isCaesarLeadReady(qualification);
  const values = {
    userId: session.userId ?? null,
    name: qualification.fullName,
    email: qualification.email.toLowerCase(),
    company: qualification.company ?? null,
    phone: qualification.phone ?? null,
    country: qualification.country ?? null,
    businessNeed: qualification.businessNeed ?? null,
    budgetRange: qualification.budgetRange ?? null,
    timeline: qualification.timeline ?? null,
    source: "caesar",
    status: leadReady ? "qualified" : "captured",
    qualification: JSON.stringify({ ...qualification, summary: summary ?? null }),
    services: JSON.stringify(qualification.serviceInterests),
    setupStyle: qualification.timeline ?? null,
    updatedAt: new Date(),
  };

  if (session.leadId) {
    await deps.db.update(lead).set(values).where(eq(lead.id, session.leadId));
    return session.leadId;
  }

  const [created] = await deps.db
    .insert(lead)
    .values({ id: deps.makeId("lead"), ...values })
    .returning();
  return created.id;
}

export function createCaesarHandlers(
  deps: CaesarDeps,
  productContext: () => Record<string, unknown>,
) {
  return {
    async handlePublicCaesar(request: Request) {
      if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);
      const rate = enforceIpRateLimit(request);
      if (!rate.allowed) {
        return deps.json(
          { error: "Caesar needs a short banana break. Please try again in a few minutes." },
          { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
        );
      }

      try {
        const body = await deps.parseBody(request, publicCaesarSchema);
        const resolved = await resolveSession(deps, body.sessionId, body.sessionToken);
        if ("error" in resolved) return deps.json({ error: resolved.error }, 403);
        const { session, sessionToken } = resolved;
        const history = await loadHistory(deps, session.id);
        const qualification = caesarQualificationSchema.parse(
          parseJson(session.qualification, { serviceInterests: [], consentToContact: false }),
        );

        if (body.action === "resume") {
          return deps.json({
            sessionId: session.id,
            sessionToken,
            messages: history,
            qualification,
            stage: session.stage,
            leadReady: isCaesarLeadReady(qualification),
            welcome: history.length ? null : initialReply(),
          });
        }
        if (!body.message) return deps.json({ error: "Message is required" }, 400);
        if (session.messageCount >= CAESAR_SESSION_MESSAGE_LIMIT) {
          return deps.json(
            {
              error:
                "We’ve covered a lot. Create your account and the CloudMonkey team can continue from my notes.",
              suggestedActions: [{ label: "Create my account", href: "/auth/sign-up" }],
            },
            429,
          );
        }

        const userMessageId = deps.makeId("caesarmsg");
        const response = await sendN8nCaesar({
          sessionId: session.id,
          message: body.message,
          history: [...history, { role: "user", body: body.message }],
          qualification,
          productContext: productContext(),
          idempotencyKey: `${session.id}:${userMessageId}`,
        });
        const mergedQualification = mergeQualification(
          qualification,
          response.qualification,
        );
        const leadReady = isCaesarLeadReady(mergedQualification);
        const leadId = await persistLead(
          deps,
          session,
          mergedQualification,
          response.summary,
        );
        const actions = filterCaesarActions(response.suggestedActions, leadReady);
        const assistantMessageId = deps.makeId("caesarmsg");

        await deps.db.transaction(async (tx: any) => {
          await tx.insert(caesarChatMessage).values({
            id: userMessageId,
            sessionId: session.id,
            role: "user",
            body: body.message,
          });
          await tx.insert(caesarChatMessage).values({
            id: assistantMessageId,
            sessionId: session.id,
            role: "assistant",
            body: response.reply,
            metadata: JSON.stringify({
              intent: response.intent,
              stage: response.stage,
              suggestedActions: actions,
            }),
          });
          await tx
            .update(caesarChatSession)
            .set({
              leadId,
              intent: response.intent,
              stage: leadReady ? "register" : response.stage,
              qualification: JSON.stringify(mergedQualification),
              summary: response.summary ?? session.summary,
              messageCount: session.messageCount + 1,
              lastIpHash: rate.key,
              updatedAt: new Date(),
            })
            .where(eq(caesarChatSession.id, session.id));
        });

        return deps.json({
          sessionId: session.id,
          sessionToken,
          message: { id: userMessageId, role: "user", body: body.message },
          reply: {
            id: assistantMessageId,
            role: "assistant",
            body: response.reply,
            suggestedActions: actions,
          },
          qualification: mergedQualification,
          stage: leadReady ? "register" : response.stage,
          leadReady,
        });
      } catch (error: any) {
        console.error("Caesar chat failed:", error);
        return deps.json(
          {
            error:
              error?.name === "AbortError"
                ? "Caesar took too long to answer. Please try again."
                : "Caesar could not answer right now. Please try again shortly.",
          },
          error?.status ?? 500,
        );
      }
    },

    async handleClaimCaesar(request: Request) {
      if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);
      const { session: userSession, response } = await deps.requireSession(request);
      if (response) return response;
      try {
        const body = await deps.parseBody(request, claimCaesarSchema);
        const resolved = await resolveSession(deps, body.sessionId, body.sessionToken);
        if ("error" in resolved) return deps.json({ error: resolved.error }, 403);
        const chatSession = resolved.session;
        if (chatSession.userId && chatSession.userId !== userSession.user.id) {
          return deps.json({ error: "Caesar session is already linked" }, 409);
        }

        await deps.db.transaction(async (tx: any) => {
          await tx
            .update(caesarChatSession)
            .set({ userId: userSession.user.id, status: "converted", updatedAt: new Date() })
            .where(eq(caesarChatSession.id, chatSession.id));
          if (chatSession.leadId) {
            await tx
              .update(lead)
              .set({ userId: userSession.user.id, status: "registered", updatedAt: new Date() })
              .where(and(eq(lead.id, chatSession.leadId), eq(lead.source, "caesar")));
          }
        });
        await deps.recordAudit({
          actorUserId: userSession.user.id,
          action: "caesar.session.claimed",
          entityType: "caesar_chat_session",
          entityId: chatSession.id,
          message: "Caesar sales conversation linked to registered account",
          metadata: { leadId: chatSession.leadId ?? null },
        });
        return deps.json({ ok: true, sessionId: chatSession.id, leadId: chatSession.leadId });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    },
  };
}
