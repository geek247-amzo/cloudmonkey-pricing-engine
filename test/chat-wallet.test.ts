/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  completeSupportChatTurn,
  executeSupportToolCalls,
  normalizeSupportAgentResponse,
} from "../src/lib/domain/support-chat";
import { createAdminHandlers } from "../src/lib/domain/admin";

function jsonResponse(data: unknown, init?: ResponseInit | number) {
  const normalized = typeof init === "number" ? { status: init } : (init ?? { status: 200 });
  return new Response(JSON.stringify(data), {
    ...normalized,
    headers: {
      "content-type": "application/json",
      ...(normalized.headers ?? {}),
    },
  });
}

describe("CloudMonkey copilot internal usage", () => {
  test("support chat completes tool turns without a customer wallet", async () => {
    const order: string[] = [];
    const result = await completeSupportChatTurn({
      sessionId: "support-session-1",
      userMessageId: "chatmsg-1",
      userId: "customer-1",
      firstSend: async () => {
        order.push("send");
        return { reply: "checking", toolCalls: [{ type: "owned_domains" }] };
      },
      secondSend: async (toolResults) => {
        order.push("reply");
        expect(toolResults).toEqual([{ ok: true }]);
        return { reply: "done", toolCalls: [] };
      },
      executeToolCalls: async () => {
        order.push("tool");
        return [{ ok: true }];
      },
    });

    expect(result.reply).toBe("done");
    expect(order).toEqual(["send", "tool", "reply"]);
  });

  test("admin domain tools bypass customer ownership while customer tools remain scoped", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.DOMAINS_CO_ZA_API_KEY;
    process.env.DOMAINS_CO_ZA_API_KEY = "company-domain-token";
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ records: [{ type: "A", value: "203.0.113.10" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const deps = {
      db: {
        query: {
          registeredDomain: {
            findFirst: async () => null,
            findMany: async () => [],
          },
        },
      },
    } as any;

    try {
      const customerResult = await executeSupportToolCalls(deps, "customer-1", [
        { type: "domain_dns", domain: "cloudmonkey.co.za" },
      ]);
      expect(customerResult[0]?.ok).toBe(false);

      const adminResult = await executeSupportToolCalls(
        deps,
        "admin-1",
        [{ type: "domain_dns", domain: "cloudmonkey.co.za" }],
        { isAdmin: true, actorUserId: "admin-1" },
      );
      expect(adminResult[0]?.ok).toBe(true);
      expect(adminResult[0]?.data).toMatchObject({ domain: "cloudmonkey.co.za" });

      const normalized = normalizeSupportAgentResponse({
        reply: "I will inspect the server.",
        toolCalls: [{ type: "vultr_action", instanceId: "instance-1", action: "reboot" }],
      });
      expect(normalized.toolCalls[0]).toMatchObject({ type: "vultr_action", action: "reboot" });
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalApiKey == null) delete process.env.DOMAINS_CO_ZA_API_KEY;
      else process.env.DOMAINS_CO_ZA_API_KEY = originalApiKey;
    }
  });
});

describe("admin copilot and internal generation usage", () => {
  function makeAdminHandlers(
    sessionUserId: string,
    overrides?: {
      sendN8nAdminChat?: (input: any) => Promise<any>;
      generateGeminiText?: (prompt: string, systemInstruction?: string) => Promise<string>;
    },
  ) {
    const counters = new Map<string, number>();
    const sharedAdminDeps = {
      db,
      json: jsonResponse,
      parseBody: async (request: Request, schema: any) => schema.parse(await request.json()),
      requireAdmin: async () => ({
        session: {
          user: {
            id: sessionUserId,
            name: "Admin Tester",
            email: "admin@test.local",
            role: "admin",
          },
        },
      }),
      recordAudit: async () => undefined,
      makeId: (prefix: string) => {
        const next = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, next);
        return `${prefix}_${next}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
      },
      getWorkspaceSettings: async () => ({ allowCustomerTicketCreation: true }),
      getWorkspaceBillingDetails: () => ({}),
      getSupportCrmContext: async () => ({
        domains: [],
        servers: [],
        websites: [],
        agents: [],
        tickets: [],
        subscriptions: [],
        invoices: [],
      }),
      getAdminServerStatus: async () => ({}),
      resolveAdminChatSession: async () => ({
        id: `chat_${sessionUserId}`,
        userId: sessionUserId,
        status: "open",
        summary: null,
        ticketId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      loadAdminChatHistory: async () => [],
      sendN8nAdminChat:
        overrides?.sendN8nAdminChat ?? (async () => ({ reply: "ok", toolCalls: [] })),
      generateGeminiText: overrides?.generateGeminiText ?? (async () => "Generated proposal text"),
      sendEmail: async () => undefined,
      sanitizeN8nIntegration: (row: any) => row,
      syncN8nWorkflows: async (integration: any) => integration,
      signMicrosoft365State: ({ userId, returnTo }: { userId: string; returnTo: string }) =>
        `${userId}:${returnTo}`,
      verifyMicrosoft365State: (value: string | null) => {
        if (!value) throw new Error("Missing state");
        const [userId, returnTo] = value.split(":");
        return { userId, returnTo, ts: Date.now() };
      },
      microsoft365ClientConfig: () => ({ clientId: "client", clientSecret: "secret" }),
      microsoft365Scopes: () => "scope",
      exchangeMicrosoft365Code: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        scope: "scope",
      }),
      syncMicrosoft365Tenant: async (row: any) => row,
      microsoft365RedirectUri: () => "https://cloudmonkey.co.za/api/admin/m365/auth/callback",
    };

    return {
      handlers: createAdminHandlers(sharedAdminDeps),
      failingHandlers: (
        sendImpl: () => Promise<any>,
        sessionOverride = sessionUserId,
        generateImpl?: (prompt: string, systemInstruction?: string) => Promise<string>,
      ) =>
        createAdminHandlers({
          ...sharedAdminDeps,
          requireAdmin: async () => ({
            session: {
              user: {
                id: sessionOverride,
                name: "Admin Tester",
                email: "admin@test.local",
                role: "admin",
              },
            },
          }),
          sendN8nAdminChat: sendImpl,
          generateGeminiText:
            generateImpl ??
            (async () => {
              throw new Error("Gemini unavailable");
            }),
        }),
    };
  }

  test("admin copilot does not consume customer wallet tokens", async () => {
    const sessionUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const { handlers, failingHandlers } = makeAdminHandlers(sessionUserId);

    const response = await handlers.handleAdminChat(
      new Request("https://cloudmonkey.co.za/api/admin/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: null,
          message: "Need admin help",
          contextType: "support",
          contextId: "ticket-1",
          conversationHistory: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.botMessage.body).toBe("ok");

    const failedHandlers = failingHandlers(async () => {
      throw new Error("admin assistant unavailable");
    });
    const failedResponse = await failedHandlers.handleAdminChat(
      new Request("https://cloudmonkey.co.za/api/admin/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: `chat_${sessionUserId}`,
          message: "Need admin help",
          contextType: "support",
          contextId: "ticket-1",
          conversationHistory: [],
        }),
      }),
    );

    expect(failedResponse.status).toBe(500);
  });

  test("proposal generation is internal admin usage and does not require wallet credit", async () => {
    const sessionUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const { handlers, failingHandlers } = makeAdminHandlers(sessionUserId);

    try {
      const successResponse = await handlers.handleAdminProposals(
        new Request("https://cloudmonkey.co.za/api/admin/proposals/generate-fields", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leadName: "Acme Co",
            leadCompany: "Acme Co",
            services: ["Managed Cloud"],
            type: "introduction",
            customContext: "Focus on reliability",
          }),
        }),
      );

      expect(successResponse.status).toBe(200);
      const successBody = await successResponse.json();
      expect(successBody.aiConfigured).toBe(true);
      expect(successBody.tokensCharged).toBe(0);

      const failedHandlers = failingHandlers(
        async () => ({ reply: "unused", toolCalls: [] }),
        sessionUserId,
        async () => {
          throw new Error("Gemini unavailable");
        },
      );
      const failedResponse = await failedHandlers.handleAdminProposals(
        new Request("https://cloudmonkey.co.za/api/admin/proposals/generate-fields", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leadName: "Acme Co",
            leadCompany: "Acme Co",
            services: ["Managed Cloud"],
            type: "executiveSummary",
            customContext: "Focus on reliability",
          }),
        }),
      );

      expect(failedResponse.status).toBe(500);
    } finally {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });
});
