/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  invoice,
  registeredDomain,
  supportChatMessage,
  supportChatSession,
  supportKnowledgeChunk,
  supportKnowledgeSource,
  supportLearningEvent,
  subscription,
  supportTicket,
  user,
  vultrInstance,
} from "../src/db/schema";
import {
  executeSupportToolCalls,
  loadSupportChatHistory,
  normalizeSupportAgentResponse,
  parseAdminDnsMutationRequest,
  resolveSupportChatSession,
  retrieveSupportKnowledge,
  sendN8nSupportChat,
  shouldOpenNewSupportTicket,
  shouldCreateEmergencyFallbackTicket,
  storeSupportLearning,
  getSupportCrmContext,
} from "../src/lib/domain/support-chat";

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

async function createUser(userId: string) {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Support Chat Tester",
    email: `${userId}@test.local`,
    emailVerified: true,
    image: null,
    whatsapp: null,
    role: "customer",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  });
}

describe("support chat domain helpers", () => {
  test("parses explicit admin DNS additions into mutation tools", () => {
    expect(
      parseAdminDnsMutationRequest(
        `For cloudmonkey.co.za add:\n@ MX 10 mail.cloudmonkey.co.za.\n_dmarc TXT "v=DMARC1; p=none"`,
      ),
    ).toEqual([
      {
        type: "domain_dns_create",
        domain: "cloudmonkey.co.za",
        name: "@",
        recordType: "MX",
        content: "10 mail.cloudmonkey.co.za.",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "cloudmonkey.co.za",
        name: "_dmarc",
        recordType: "TXT",
        content: "v=DMARC1; p=none",
        ttl: 3600,
      },
    ]);

    const mailjet = parseAdminDnsMutationRequest(`for the same nexuserp.xyz

SPF Setup
Record Type
TXT
Hostname
@
Value
v=spf1 include:spf.mailjet.com ?all
DKIM Setup
Record Type
TXT
Hostname
mailjet._domainkey
Preview: mailjet._domainkey.nexuserp.xyz.
Value
2048 bits
k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAKE
Please make sure it stays on one line.`);
    expect(mailjet).toEqual([
      {
        type: "domain_dns_create",
        domain: "nexuserp.xyz",
        name: "@",
        recordType: "TXT",
        content: "v=spf1 include:spf.mailjet.com ?all",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "nexuserp.xyz",
        name: "mailjet._domainkey",
        recordType: "TXT",
        content: "k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAKE",
        ttl: 3600,
      },
    ]);

    expect(
      parseAdminDnsMutationRequest(`for geek247.co.za update MX:
Type
MX
Host
@
Value
mx01.mail.icloud.com.
Priority
10
MX:
Type
MX
Host
@
Value
mx02.mail.icloud.com.
Priority
10
TXT:
Type
TXT
Host
@
Value
apple-domain=7YJ2r9mvYSVutMsO
SPF:
Type
TXT
Host
@
Value
"v=spf1 include:icloud.com ~all"
DKIM:
Type
CNAME
Host
sig1._domainkey
Value
sig1.dkim.geek247.co.za.at.icloudmailadmin.com.`),
    ).toEqual([
      {
        type: "domain_dns_create",
        domain: "geek247.co.za",
        name: "@",
        recordType: "MX",
        content: "10 mx01.mail.icloud.com.",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "geek247.co.za",
        name: "@",
        recordType: "MX",
        content: "10 mx02.mail.icloud.com.",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "geek247.co.za",
        name: "@",
        recordType: "TXT",
        content: "apple-domain=7YJ2r9mvYSVutMsO",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "geek247.co.za",
        name: "@",
        recordType: "TXT",
        content: "v=spf1 include:icloud.com ~all",
        ttl: 3600,
      },
      {
        type: "domain_dns_create",
        domain: "geek247.co.za",
        name: "sig1._domainkey",
        recordType: "CNAME",
        content: "sig1.dkim.geek247.co.za.at.icloudmailadmin.com.",
        ttl: 3600,
      },
    ]);
  });
  test("resolveSupportChatSession returns the owned session and blocks foreign sessions", async () => {
    const ownerId = `support-owner-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const foreignId = `support-foreign-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const ownerSessionId = `support-session-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const foreignSessionId = `support-session-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

    await createUser(ownerId);
    await createUser(foreignId);

    try {
      const ownerSession = await db
        .insert(supportChatSession)
        .values({
          id: ownerSessionId,
          userId: ownerId,
          status: "open",
        })
        .returning();
      await db.insert(supportChatSession).values({
        id: foreignSessionId,
        userId: foreignId,
        status: "pending",
      });

      const owned = await resolveSupportChatSession({ db, makeId }, ownerId, ownerSessionId);
      expect(owned?.id).toBe(ownerSession[0].id);

      const blocked = await resolveSupportChatSession({ db, makeId }, ownerId, foreignSessionId);
      expect(blocked).toBeNull();
    } finally {
      await db.delete(supportChatSession).where(eq(supportChatSession.id, ownerSessionId));
      await db.delete(supportChatSession).where(eq(supportChatSession.id, foreignSessionId));
      await db.delete(user).where(eq(user.id, ownerId));
      await db.delete(user).where(eq(user.id, foreignId));
    }
  });

  test("loadSupportChatHistory returns messages oldest-first and parses metadata", async () => {
    const userId = `support-history-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const sessionId = `support-session-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

    await createUser(userId);

    try {
      await db.insert(supportChatSession).values({
        id: sessionId,
        userId,
        status: "open",
      });

      await db.insert(supportChatMessage).values([
        {
          id: `${sessionId}-b`,
          sessionId,
          userId,
          role: "assistant",
          body: "Second message",
          metadata: JSON.stringify({ turn: 2 }),
        },
        {
          id: `${sessionId}-a`,
          sessionId,
          userId,
          role: "user",
          body: "First message",
          metadata: JSON.stringify({ turn: 1 }),
        },
      ]);

      const history = await loadSupportChatHistory({ db }, sessionId, 20);
      expect(history).toHaveLength(2);
      expect(history[0]?.body).toBe("First message");
      expect(history[0]?.metadata).toEqual({ turn: 1 });
      expect(history[1]?.body).toBe("Second message");
      expect(history[1]?.metadata).toEqual({ turn: 2 });
      expect(typeof history[0]?.createdAt).toBe("string");
    } finally {
      await db.delete(supportChatMessage).where(eq(supportChatMessage.sessionId, sessionId));
      await db.delete(supportChatSession).where(eq(supportChatSession.id, sessionId));
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  test("executeSupportToolCalls resolves domain availability and owned domain lookups", async () => {
    const userId = `support-tools-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const domain = `tools-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.example.com`;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.DOMAINS_CO_ZA_API_KEY;

    await createUser(userId);
    await db.insert(registeredDomain).values({
      id: domain,
      userId,
      status: "active",
      expiryDate: null,
    });

    process.env.DOMAINS_CO_ZA_API_KEY = "test-domain-key";
    (globalThis as any).fetch = async (input: RequestInfo | URL) =>
      new Response(JSON.stringify({ requested: String(input) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    try {
      const results = await executeSupportToolCalls({ db }, userId, [
        { type: "domain_availability", domain },
        { type: "domain_dns", domain },
        { type: "domain_info", domain },
      ] as any);

      expect(results).toHaveLength(3);
      expect(results[0]?.ok).toBe(true);
      expect(results[0]?.data).toMatchObject({ domain });
      expect(results[1]?.ok).toBe(true);
      expect(results[1]?.data).toMatchObject({ domain });
      expect(results[2]?.ok).toBe(true);
      expect(results[2]?.data).toMatchObject({ domain });
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalApiKey == null) {
        delete process.env.DOMAINS_CO_ZA_API_KEY;
      } else {
        process.env.DOMAINS_CO_ZA_API_KEY = originalApiKey;
      }
      await db.delete(registeredDomain).where(eq(registeredDomain.id, domain));
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  test("normalizeSupportAgentResponse falls back on invalid payloads and fills defaults", () => {
    const invalid = normalizeSupportAgentResponse({ reply: "" });
    expect(invalid.reply).toContain("I could not process");
    expect(invalid.intent).toBe("general");
    expect(invalid.createTicket).toBe(false);

    const valid = normalizeSupportAgentResponse({
      message: "Hello",
      toolCalls: undefined,
      suggestedActions: undefined,
    });
    expect(valid.reply).toBe("Hello");
    expect(valid.createTicket).toBe(false);
    expect(valid.toolCalls).toEqual([]);
    expect(valid.suggestedActions).toEqual([]);

    const nested = normalizeSupportAgentResponse({
      reply: JSON.stringify({
        reply: "## DNS records\n\n- **A** cloudmonkey.co.za → `139.84.237.146`",
        intent: "dns_query",
      }),
    });
    expect(nested.reply).toStartWith("## DNS records");
    expect(nested.intent).toBe("dns_query");

    const truncated = normalizeSupportAgentResponse(
      '{ "reply": "Certainly. Here are the DNS records:\\n\\n- A Record: example.com -> 192.0.2.1", "intent": "dns_query", "suggestedActions": [{ "label": "Manage DNS", "href":',
    );
    expect(truncated.reply).toBe(
      "Certainly. Here are the DNS records:\n\n- A Record: example.com -> 192.0.2.1",
    );
  });

  test("shouldCreateEmergencyFallbackTicket recognizes escalation phrases", () => {
    expect(shouldCreateEmergencyFallbackTicket("The site is down and I need a human")).toBe(true);
    expect(shouldCreateEmergencyFallbackTicket("Please explain the invoice line items")).toBe(
      false,
    );
  });

  test("a new support request does not reuse a resolved or closed linked ticket", () => {
    expect(shouldOpenNewSupportTicket(true, null)).toBe(true);
    expect(shouldOpenNewSupportTicket(true, { status: "closed" })).toBe(true);
    expect(shouldOpenNewSupportTicket(true, { status: "resolved" })).toBe(true);
    expect(shouldOpenNewSupportTicket(true, { status: "open" })).toBe(false);
    expect(shouldOpenNewSupportTicket(false, { status: "closed" })).toBe(false);
  });

  test("sendN8nSupportChat sends the configured payload and parses the response", async () => {
    const originalFetch = globalThis.fetch;
    const originalWebhookUrl = process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL;
    const originalWebhookSecret = process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET;
    const originalCloudMonkeyApiToken = process.env.CLOUDMONKEY_API_TOKEN;
    const recorded: Array<Record<string, unknown>> = [];

    process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL = "https://example.test/webhook";
    process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET = "secret";
    process.env.CLOUDMONKEY_API_TOKEN = "internal-api-token";
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      recorded.push({
        url: String(input),
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries()),
        body: init?.body,
      });
      return new Response(JSON.stringify({ reply: "Webhook reply", toolCalls: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const response = await sendN8nSupportChat({
        sessionId: "session-1",
        message: "Help me",
        threadContext: { session: { id: "session-1" } },
        conversationHistory: [],
        user: { id: "user-1" },
        context: {},
        idempotencyKey: "support-chat:test",
      });

      expect(response.reply).toBe("Webhook reply");
      expect(recorded).toHaveLength(1);
      expect(recorded[0]?.url).toBe("https://example.test/webhook");
      expect(recorded[0]?.method).toBe("POST");
      expect((recorded[0]?.headers as Record<string, string>)["x-cloudmonkey-api-token"]).toBe(
        "internal-api-token",
      );
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalWebhookUrl == null) delete process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL;
      else process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL = originalWebhookUrl;
      if (originalWebhookSecret == null) delete process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET;
      else process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET = originalWebhookSecret;
      if (originalCloudMonkeyApiToken == null) delete process.env.CLOUDMONKEY_API_TOKEN;
      else process.env.CLOUDMONKEY_API_TOKEN = originalCloudMonkeyApiToken;
    }
  });

  test("getSupportCrmContext includes the customer's domains, tickets, subscriptions, and invoices", async () => {
    const userId = `support-crm-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const ticketId = `ticket-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const subscriptionId = `sub-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const invoiceId = `inv-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const instanceId = `inst-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await createUser(userId);

    try {
      await db.insert(registeredDomain).values({
        id: `crm-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.example.com`,
        userId,
        status: "active",
        expiryDate: null,
      });
      await db.insert(supportTicket).values({
        id: ticketId,
        userId,
        subject: "Support question",
        description: "Need help",
        priority: "medium",
        status: "open",
        category: "support",
        source: "manual",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(subscription).values({
        id: subscriptionId,
        userId,
        planId: null,
        bundleId: null,
        name: "Support Plan",
        status: "active",
        amount: 5000,
        interval: "month",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        agreementSigned: false,
        agreementSignedAt: null,
        requiredAgreementTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(invoice).values({
        id: invoiceId,
        userId,
        invoiceNumber: `INV-${invoiceId.slice(-6)}`,
        invoiceSource: "support",
        amount: 5000,
        status: "paid",
        dueDate: new Date(),
        issuedAt: new Date(),
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(),
        currency: "ZAR",
        vatRateBps: 0,
        customerName: "Support Chat Customer",
        customerEmail: `${userId}@test.local`,
        paymentMethod: "gateway",
        collectionStatus: "paid",
        collectionDayCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(vultrInstance).values({
        id: instanceId,
        userId,
        os: "Ubuntu 22.04",
        ram: 2048,
        disk: 40,
        mainIp: "10.0.0.1",
        region: "jnb1",
        status: "active",
        powerStatus: "running",
        label: "Support Instance",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context = await getSupportCrmContext({ db }, userId);
      expect(context.domains.length).toBeGreaterThan(0);
      expect(context.tickets[0]?.id).toBe(ticketId);
      expect(context.subscriptions[0]?.id).toBe(subscriptionId);
      expect(context.invoices[0]?.id).toBe(invoiceId);
      expect(context.servers[0]?.id).toBe(instanceId);
    } finally {
      await db.delete(vultrInstance).where(eq(vultrInstance.id, instanceId));
      await db.delete(invoice).where(eq(invoice.id, invoiceId));
      await db.delete(subscription).where(eq(subscription.id, subscriptionId));
      await db.delete(supportTicket).where(eq(supportTicket.id, ticketId));
      await db.delete(registeredDomain).where(eq(registeredDomain.userId, userId));
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  test("retrieveSupportKnowledge returns ranked knowledge when embeddings resolve", async () => {
    const originalFetch = globalThis.fetch;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    const embedding = Array.from({ length: 768 }, () => 0);

    process.env.GEMINI_API_KEY = "test-gemini-key";
    (globalThis as any).fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes(":embedContent")) {
        return new Response(JSON.stringify({ embedding: { values: embedding } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const context = await retrieveSupportKnowledge(
        {
          db: {
            execute: async () => [
              {
                id: "chunk_1",
                title: "Billing FAQ",
                sourceType: "faq",
                visibility: "customer",
                score: 0.91,
                confidence: 80,
                chunkText: "How billing works",
                metadata: JSON.stringify({ category: "billing" }),
              },
            ],
          } as any,
          makeId,
        },
        {
          userId: "support-user",
          message: "Need help",
          context: {
            domains: [],
            servers: [],
            websites: [],
            tickets: [],
            subscriptions: [],
            invoices: [],
          },
        },
      );

      expect(context.retrievedKnowledge).toHaveLength(1);
      expect(context.retrievedKnowledge[0]?.title).toBe("Billing FAQ");
      expect(context.dynamicContext.customerAssets.domains).toEqual([]);
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalGeminiKey == null) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  test("storeSupportLearning does not write knowledge when the turn is ticketed", async () => {
    const calls: string[] = [];
    await storeSupportLearning(
      {
        db: {
          insert: () => ({
            values: async () => {
              calls.push("insert");
            },
          }),
          execute: async () => {
            calls.push("execute");
          },
        } as any,
        makeId,
      },
      {
        userId: "support-user",
        sessionId: "session-1",
        message: "Need help",
        reply: "Sure",
        createTicket: true,
      },
    );

    expect(calls).toEqual([]);
  });

  test("storeSupportLearning stores support knowledge end-to-end for reusable non-ticketed turns", async () => {
    const originalFetch = globalThis.fetch;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    const userId = `support-learn-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const sessionId = `support-session-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const sourceIdPrefix = "ksrc_";
    const chunkIdPrefix = "kchunk_";
    const eventIdPrefix = "klearn_";
    const embedding = Array.from({ length: 768 }, () => 0);

    await createUser(userId);
    await db.insert(supportChatSession).values({
      id: sessionId,
      userId,
      status: "open",
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (globalThis as any).fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes(":embedContent")) {
        return new Response(JSON.stringify({ embedding: { values: embedding } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      await storeSupportLearning(
        { db, makeId },
        {
          userId,
          sessionId,
          message:
            "Please help me understand the latest invoice reconciliation and how to route my support request.",
          reply:
            "Here is a reusable answer for invoice reconciliation and support routing that can be stored safely.",
          intent: "billing",
          summary:
            "Customer asked about invoice reconciliation and support routing for an existing account. The reply explains the normal flow and can be reused in future.",
          createTicket: false,
        },
      );

      const sources = await db
        .select({ id: supportKnowledgeSource.id })
        .from(supportKnowledgeSource)
        .where(eq(supportKnowledgeSource.userId, userId));
      const chunks = await db
        .select({ id: supportKnowledgeChunk.id })
        .from(supportKnowledgeChunk)
        .where(eq(supportKnowledgeChunk.userId, userId));
      const events = await db
        .select({ id: supportLearningEvent.id })
        .from(supportLearningEvent)
        .where(eq(supportLearningEvent.userId, userId));

      expect(sources).toHaveLength(1);
      expect(chunks).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(sources[0]?.id).toContain(sourceIdPrefix);
      expect(chunks[0]?.id).toContain(chunkIdPrefix);
      expect(events[0]?.id).toContain(eventIdPrefix);
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalGeminiKey == null) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalGeminiKey;
      await db.delete(supportLearningEvent).where(eq(supportLearningEvent.userId, userId));
      await db.delete(supportKnowledgeChunk).where(eq(supportKnowledgeChunk.userId, userId));
      await db.delete(supportKnowledgeSource).where(eq(supportKnowledgeSource.userId, userId));
      await db.delete(supportChatSession).where(eq(supportChatSession.id, sessionId));
      await db.delete(user).where(eq(user.id, userId));
    }
  });
});
