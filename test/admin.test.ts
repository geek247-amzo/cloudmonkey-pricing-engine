import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  affiliate,
  affiliateCommission,
  affiliateReferral,
  auditLog,
  caesarChatSession,
  invoice,
  lead,
  proposal,
  proposalItem,
  subscription,
  supportTicket,
  tokenTopupIntent,
  tokenWallet,
  twoFactor,
  user,
} from "../src/db/schema";
import {
  createAdminHandlers,
  normalizeTicketAiOutcome,
  normalizeTicketAiSummary,
} from "../src/lib/domain/admin";

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

function makeAdminHandlers(role: "admin" | "customer" = "admin") {
  const sessionUserId = `${role}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const counters = new Map<string, number>();
  const sentEmails: Array<Record<string, unknown>> = [];

  return {
    sessionUserId,
    sentEmails,
    handlers: createAdminHandlers({
      db,
      json: jsonResponse,
      parseBody: async (request, schema) => schema.parse(await request.json()),
      requireAdmin: async () =>
        role === "admin"
          ? {
              session: {
                user: {
                  id: sessionUserId,
                  name: role === "admin" ? "Admin Tester" : "Customer Tester",
                  email: `${role}@test.local`,
                  role,
                },
              },
            }
          : {
              response: new Response("Forbidden", { status: 403 }),
            },
      recordAudit: async () => undefined,
      sendEmail: async (input) => {
        sentEmails.push(input);
      },
      makeId: (prefix) => {
        const next = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, next);
        return `${prefix}_${next}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
      },
      getWorkspaceSettings: async () => ({
        allowCustomerTicketCreation: true,
      }),
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
      resolveAdminChatSession: async () => null,
      loadAdminChatHistory: async () => [],
      sendN8nAdminChat: async () => ({ reply: "ok" }),
      sanitizeN8nIntegration: (row) => row,
      syncN8nWorkflows: async (integration) => integration,
      signMicrosoft365State: ({ userId, returnTo }) => `${userId}:${returnTo}`,
      verifyMicrosoft365State: (value) => {
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
      syncMicrosoft365Tenant: async (row) => row,
      microsoft365RedirectUri: () => "https://cloudmonkey.co.za/api/admin/m365/auth/callback",
    }),
  };
}

function requestJson(path: string, method: string, body?: Record<string, unknown>) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("admin handlers", () => {
  test("AI ticket outcomes remain private unless publication is explicit", () => {
    expect(normalizeTicketAiSummary({ reply: "Situation\nInvoice is pending" })).toBe(
      "Situation\nInvoice is pending",
    );
    expect(normalizeTicketAiOutcome({ reply: "Completed" })).toEqual({
      body: "Completed",
      makePublic: false,
      ticketStatus: null,
    });
    expect(
      normalizeTicketAiOutcome({
        reply: "Credit applied",
        makePublic: true,
        ticketStatus: "resolved",
      }),
    ).toEqual({ body: "Credit applied", makePublic: true, ticketStatus: "resolved" });

    expect(
      normalizeTicketAiOutcome({
        reply:
          '```json\n{"reply":"Credit applied","makePublic":true,"ticketStatus":"resolved"}\n```',
      }),
    ).toEqual({ body: "Credit applied", makePublic: true, ticketStatus: "resolved" });

    expect(
      normalizeTicketAiSummary(
        '{ "reply": "## DNS records\\n\\n- **A** example.com", "suggestedActions": [{ "href":',
      ),
    ).toBe("## DNS records\n\n- **A** example.com");
  });

  test("rejects role escalation from a non-admin session", async () => {
    const targetUserId = `customer_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const { handlers } = makeAdminHandlers("customer");

    await db.insert(user).values({
      id: targetUserId,
      name: "Target Customer",
      email: `target-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const response = await handlers.handleAdminUsers(
        requestJson("/api/admin/users/role", "PUT", {
          userId: targetUserId,
          role: "admin",
        }),
      );

      expect(response.status).toBe(403);
      const target = await db.query.user.findFirst({ where: eq(user.id, targetUserId) });
      expect(target?.role).toBe("customer");
    } finally {
      await db.delete(user).where(eq(user.id, targetUserId));
    }
  });

  test("admin product catalog includes bundle rows alongside plans", async () => {
    const { handlers } = makeAdminHandlers("admin");

    const response = await handlers.handleAdminProducts(requestJson("/api/admin/products", "GET"));

    expect(response.status).toBe(200);
    const products = await response.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.some((row: any) => row.service?.id === "bundle")).toBe(true);
    expect(products.some((row: any) => row.id === "bundle_full_service_growth")).toBe(true);
  });

  test("admin proposal creation accepts catalog-backed line items", async () => {
    const { handlers, sessionUserId } = makeAdminHandlers("admin");
    await db.insert(user).values({
      id: sessionUserId,
      name: "Admin Tester",
      email: `admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let createdProposalId: string | null = null;
    try {
      const response = await handlers.handleAdminProposals(
        requestJson("/api/admin/proposals", "POST", {
          lead: {
            name: "Proposal Lead",
            email: `proposal-${crypto.randomUUID().slice(0, 8)}@example.com`,
            company: "Proposal Co",
          },
          title: "Managed Services Proposal",
          introduction: "Intro",
          executiveSummary: "Summary",
          terms: "Terms",
          items: [
            {
              name: "Full-Service Growth",
              description: "Managed cloud, build, marketing, voice, AI, and support",
              productType: "bundle",
              productId: "bundle_full_service_growth",
              bundleId: "bundle_full_service_growth",
              quantity: 1,
              unitPrice: 275.98,
              setupPrice: 149.99,
              recurring: true,
              interval: "month",
            },
          ],
        }),
      );

      expect(response.status).toBe(201);
      const proposal = await response.json();
      createdProposalId = proposal.id;
      expect(proposal.items?.[0]?.name).toBe("Full-Service Growth");
      expect(proposal.items?.[0]?.unitPrice).toBe(27598);
      expect(proposal.items?.[0]?.setupPrice).toBe(14999);
      expect(proposal.items?.[0]?.productType).toBe("bundle");
      const serviceDefinition = JSON.parse(proposal.items?.[0]?.serviceDefinition ?? "{}");
      expect(serviceDefinition.packageRules?.coverage?.length).toBeGreaterThan(0);
      expect(serviceDefinition.standardTerms?.length).toBeGreaterThan(0);
    } finally {
      if (createdProposalId) {
        await db.delete(proposalItem).where(eq(proposalItem.proposalId, createdProposalId));
        await db.delete(proposal).where(eq(proposal.id, createdProposalId));
      }
      await db.delete(user).where(eq(user.id, sessionUserId));
    }
  });

  test("admin proposal send marks the proposal as sent and emails the customer", async () => {
    const { handlers, sessionUserId, sentEmails } = makeAdminHandlers("admin");
    await db.insert(user).values({
      id: sessionUserId,
      name: "Admin Tester",
      email: `admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let createdProposalId: string | null = null;
    try {
      const createResponse = await handlers.handleAdminProposals(
        requestJson("/api/admin/proposals", "POST", {
          lead: {
            name: "Proposal Lead",
            email: `proposal-${crypto.randomUUID().slice(0, 8)}@example.com`,
            company: "Proposal Co",
          },
          title: "Managed Services Proposal",
          introduction: "Intro",
          executiveSummary: "Summary",
          terms: "Terms",
          items: [
            {
              name: "Full-Service Growth",
              description: "Managed cloud, build, marketing, voice, AI, and support",
              productType: "bundle",
              productId: "bundle_full_service_growth",
              bundleId: "bundle_full_service_growth",
              quantity: 1,
              unitPrice: 275.98,
              setupPrice: 149.99,
              recurring: true,
              interval: "month",
            },
          ],
        }),
      );
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      createdProposalId = created.id;

      const sendResponse = await handlers.handleAdminProposals(
        requestJson(`/api/admin/proposals/${encodeURIComponent(createdProposalId)}/send`, "POST"),
      );

      expect(sendResponse.status).toBe(200);
      const sent = await sendResponse.json();
      expect(sent.status).toBe("sent");
      expect(sent.sentAt).toBeTruthy();
      expect(sent.publicUrl).toContain(`/api/proposals/${created.publicToken}`);
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]?.template).toBe("generic");
      expect(sentEmails[0]?.to).toBe(created.customerEmail);
      expect(String(sentEmails[0]?.data?.primaryCtaUrl ?? "")).toContain(created.publicToken);

      const stored = await db.query.proposal.findFirst({
        where: eq(proposal.id, createdProposalId),
      });
      expect(stored?.status).toBe("sent");
      expect(stored?.sentAt).toBeTruthy();
    } finally {
      if (createdProposalId) {
        await db.delete(proposalItem).where(eq(proposalItem.proposalId, createdProposalId));
        await db.delete(proposal).where(eq(proposal.id, createdProposalId));
      }
      await db.delete(user).where(eq(user.id, sessionUserId));
    }
  });

  test("admin proposal creation tolerates missing line names from stale clients", async () => {
    const { handlers, sessionUserId } = makeAdminHandlers("admin");
    await db.insert(user).values({
      id: sessionUserId,
      name: "Admin Tester",
      email: `admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let createdProposalId: string | null = null;
    try {
      const response = await handlers.handleAdminProposals(
        requestJson("/api/admin/proposals", "POST", {
          lead: {
            name: "Proposal Lead",
            email: `proposal-${crypto.randomUUID().slice(0, 8)}@example.com`,
            company: "Proposal Co",
          },
          title: "Managed Services Proposal",
          introduction: "Intro",
          executiveSummary: "Summary",
          terms: "Terms",
          items: [
            {
              productType: "bundle",
              productId: "bundle_full_service_growth",
              bundleId: "bundle_full_service_growth",
              quantity: 1,
              unitPrice: 275.98,
              setupPrice: 149.99,
              recurring: true,
              interval: "month",
            },
          ],
        }),
      );

      expect(response.status).toBe(201);
      const proposal = await response.json();
      createdProposalId = proposal.id;
      expect(proposal.items?.[0]?.name).toBe("Full-Service Growth");
      expect(proposal.items?.[0]?.unitPrice).toBe(27598);
      expect(proposal.items?.[0]?.serviceDefinition).toBeTruthy();
    } finally {
      if (createdProposalId) {
        await db.delete(proposalItem).where(eq(proposalItem.proposalId, createdProposalId));
        await db.delete(proposal).where(eq(proposal.id, createdProposalId));
      }
      await db.delete(user).where(eq(user.id, sessionUserId));
    }
  });

  test("admin ticket updates persist state transitions and resolution details", async () => {
    const customerId = `customer_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const ticketId = `ticket_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const { handlers } = makeAdminHandlers("admin");

    await db.insert(user).values({
      id: customerId,
      name: "Ticket Customer",
      email: `ticket-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(supportTicket).values({
      id: ticketId,
      userId: customerId,
      subject: "Server is down",
      description: "Please help",
      priority: "high",
      status: "open",
      category: "support",
      source: "manual",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const response = await handlers.handleAdminTickets(
        requestJson(`/api/admin/tickets/${ticketId}`, "PUT", {
          status: "resolved",
          resolutionSummary: "Service restored and verified",
        }),
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.status).toBe("resolved");
      expect(updated.resolutionSummary).toBe("Service restored and verified");

      const storedTicket = await db.query.supportTicket.findFirst({
        where: eq(supportTicket.id, ticketId),
      });
      expect(storedTicket?.status).toBe("resolved");
      expect(storedTicket?.resolutionSummary).toBe("Service restored and verified");
    } finally {
      await db.delete(supportTicket).where(eq(supportTicket.id, ticketId));
      await db.delete(user).where(eq(user.id, customerId));
    }
  });

  test("audit logs remain present when a user is deleted", async () => {
    const customerId = `customer_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const auditId = `audit_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const walletId = `wallet_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const topupId = `topup_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const leadId = `lead_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const caesarSessionId = `caesar_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const affiliateId = `affiliate_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const referralId = `referral_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const invoiceId = `invoice_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const subscriptionId = `subscription_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const commissionId = `commission_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const { handlers } = makeAdminHandlers("admin");

    await db.insert(user).values({
      id: customerId,
      name: "Delete Target",
      email: `delete-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(auditLog).values({
      id: auditId,
      actorUserId: customerId,
      action: "user.profile.updated",
      entityType: "user",
      entityId: customerId,
      level: "info",
      message: "Profile updated",
      metadata: JSON.stringify({ source: "test" }),
      createdAt: new Date(),
    });
    await db.insert(twoFactor).values({
      id: `twofactor_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      secret: "test-secret",
      backupCodes: "[]",
      userId: customerId,
      verified: true,
    });
    await db.insert(tokenWallet).values({ id: walletId, userId: customerId });
    await db.insert(tokenTopupIntent).values({
      id: topupId,
      walletId,
      userId: customerId,
      amountTokens: 100,
      paystackReference: `delete-test-${crypto.randomUUID()}`,
    });
    await db.insert(lead).values({
      id: leadId,
      userId: customerId,
      name: "Delete Target",
      email: `lead-${crypto.randomUUID().slice(0, 8)}@example.com`,
    });
    await db.insert(caesarChatSession).values({
      id: caesarSessionId,
      visitorTokenHash: crypto.randomUUID(),
      userId: customerId,
      leadId,
    });
    await db.insert(affiliate).values({
      id: affiliateId,
      fullName: "Independent Affiliate",
      email: `affiliate-${crypto.randomUUID().slice(0, 8)}@example.com`,
      referralCode: `DELETE${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
    });
    await db.insert(affiliateReferral).values({
      id: referralId,
      affiliateId,
      referralCode: `DELETE${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
      customerId,
    });
    await db.insert(invoice).values({
      id: invoiceId,
      userId: customerId,
      amount: 1_000,
      dueDate: new Date(),
    });
    await db.insert(subscription).values({
      id: subscriptionId,
      userId: customerId,
      name: "Deletion regression plan",
    });
    await db.insert(affiliateCommission).values({
      id: commissionId,
      affiliateId,
      referralId,
      customerId,
      invoiceId,
      subscriptionId,
      commissionType: "once_off",
      commissionRateBps: 1_000,
      commissionAmount: 100,
      holdUntilDate: new Date(),
    });

    try {
      const response = await handlers.handleAdminUsers(
        requestJson(`/api/admin/users/${customerId}`, "DELETE"),
      );

      expect(response.status).toBe(200);
      const deletedAudit = await db.query.auditLog.findFirst({ where: eq(auditLog.id, auditId) });
      expect(deletedAudit).toBeTruthy();
      expect(deletedAudit?.actorUserId).toBeNull();
      expect(await db.query.user.findFirst({ where: eq(user.id, customerId) })).toBeUndefined();
      expect(
        await db.query.tokenWallet.findFirst({ where: eq(tokenWallet.id, walletId) }),
      ).toBeUndefined();
      expect(
        await db.query.caesarChatSession.findFirst({
          where: eq(caesarChatSession.id, caesarSessionId),
        }),
      ).toBeUndefined();
      expect(
        await db.query.affiliateCommission.findFirst({
          where: eq(affiliateCommission.id, commissionId),
        }),
      ).toBeUndefined();
    } finally {
      await db.delete(affiliateCommission).where(eq(affiliateCommission.id, commissionId));
      await db.delete(affiliateReferral).where(eq(affiliateReferral.id, referralId));
      await db.delete(affiliate).where(eq(affiliate.id, affiliateId));
      await db.delete(subscription).where(eq(subscription.id, subscriptionId));
      await db.delete(invoice).where(eq(invoice.id, invoiceId));
      await db.delete(caesarChatSession).where(eq(caesarChatSession.id, caesarSessionId));
      await db.delete(lead).where(eq(lead.id, leadId));
      await db.delete(tokenTopupIntent).where(eq(tokenTopupIntent.id, topupId));
      await db.delete(tokenWallet).where(eq(tokenWallet.id, walletId));
      await db.delete(twoFactor).where(eq(twoFactor.userId, customerId));
      await db.delete(auditLog).where(eq(auditLog.id, auditId));
      await db.delete(user).where(eq(user.id, customerId));
    }
  });
});
