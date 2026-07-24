import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import {
  domainOrder,
  registeredDomain,
  service,
  serviceCategory,
  servicePlan,
  supportTicket,
  user,
  invoice,
  invoiceItem,
  subscription,
} from "../src/db/schema";
import { createDomainsHandlers, registerPaidDomainOrder } from "../src/lib/domain/domains";

type JsonBody = Record<string, unknown>;

function jsonResponse(data: unknown, init?: ResponseInit | number) {
  const normalized =
    typeof init === "number" ? { status: init } : init ?? { status: 200 };
  return new Response(JSON.stringify(data), {
    ...normalized,
    headers: {
      "content-type": "application/json",
      ...(normalized.headers ?? {}),
    },
  });
}

function normalizeMinimumTermMonths(input: {
  minimumTermMonths?: number | string | null;
  minimumTerm?: string | null;
}) {
  const candidate = input.minimumTermMonths ?? input.minimumTerm;
  if (candidate == null) return null;
  if (typeof candidate === "number") return candidate > 0 ? candidate : null;
  const trimmed = candidate.trim().toLowerCase();
  if (!trimmed) return null;
  const numeric = Number.parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return trimmed.includes("year") ? numeric * 12 : numeric;
}

function makeDomainHandlers(sessionUserId = "customer-test-user") {
  const counters = new Map<string, number>();
  return createDomainsHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request, schema) => schema.parse(await request.json()),
    requireSession: async () => ({
      session: {
        user: {
          id: sessionUserId,
          name: "Domain Tester",
          email: "domain@test.local",
          role: "customer",
        },
      },
    }),
    requireAdmin: async () => ({
      session: {
        user: {
          id: "admin-test-user",
          name: "Admin Tester",
          email: "admin@test.local",
          role: "admin",
        },
      },
    }),
    initializePayment: async () => ({
      data: {
        reference: `pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        authorization_url: "https://paystack.example/auth",
        access_code: "test_access_code",
      },
    }),
    sendEmail: async () => undefined,
    formatEmailDate: (value) => (value ? new Date(value).toISOString() : ""),
    formatEmailMoney: (amount, currency = "ZAR") => `${currency} ${amount}`,
    getWorkspaceSettings: async () => ({ billingInvoiceNotes: "Test note" }),
    getWorkspaceBillingDetails: () => ({
      bankName: "CloudMonkey",
      bankAccountName: "CloudMonkey",
      bankAccountNumber: "123",
      bankBranchCode: "000",
    }),
    servicePlan,
    invoice,
    invoiceItem,
    subscription,
    addMonths: (date, months) => {
      const next = new Date(date);
      next.setMonth(next.getMonth() + months);
      return next;
    },
    normalizeMinimumTermMonths,
    recordAudit: async () => undefined,
    makeId: (prefix) => {
      const current = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, current);
      return `${prefix}_${current}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    },
    registeredDomain,
    domainOrder,
    supportTicket,
    user,
  });
}

async function requestJson(path: string, method: string, body?: JsonBody) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function cleanupUsers(ids: string[]) {
  for (const id of ids) {
    await db.delete(domainOrder).where(eq(domainOrder.userId, id));
    await db.delete(subscription).where(eq(subscription.userId, id));
    const invoices = await db.query.invoice.findMany({ where: eq(invoice.userId, id) });
    for (const row of invoices) {
      await db.delete(invoiceItem).where(eq(invoiceItem.invoiceId, row.id));
    }
    await db.delete(invoice).where(eq(invoice.userId, id));
    await db.delete(supportTicket).where(eq(supportTicket.userId, id));
    await db.delete(registeredDomain).where(eq(registeredDomain.userId, id));
  }

  for (const id of ids) {
    await db.delete(servicePlan).where(eq(servicePlan.id, id));
  }

  for (const id of ids) {
    await db.delete(service).where(eq(service.id, id));
  }

  for (const id of ids) {
    await db.delete(serviceCategory).where(eq(serviceCategory.id, id));
  }

  for (const id of ids) {
    await db.delete(user).where(eq(user.id, id));
  }
}

describe("domain handlers", () => {
  test("domain order checkout creates invoice, subscription, and a minimum-term subscription", async () => {
    const customerUserId = `cust_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const categoryId = `cat_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const planId = `plan_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const handlers = makeDomainHandlers(customerUserId);
    const existingService = await db.query.service.findFirst({ where: eq(service.id, "domains") });
    const shouldCleanupService = !existingService;

    await db.insert(user).values({
      id: customerUserId,
      name: "Domain Customer",
      email: `domains-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (!existingService) {
      await db.insert(serviceCategory).values({
        id: categoryId,
        name: "Domains",
        tagline: "Domain registration",
        accent: "cloud",
        note: "Domain services",
        sortOrder: 1,
        active: true,
      });
      await db.insert(service).values({
        id: "domains",
        categoryId,
        name: "Domains",
        description: "Domain registration and management",
        note: null,
        sortOrder: 1,
        active: true,
      });
    }
    await db.insert(servicePlan).values({
      id: planId,
      serviceId: "domains",
      name: "co.za Domain",
      priceZar: "99",
      setupPriceZar: "0",
      unit: "year",
      billingFrequency: "year",
      minimumTerm: "12 months",
      minimumTermMonths: 12,
      billingType: "recurring",
      priceLabel: "R99/year",
      isBundle: false,
      sortOrder: 1,
      serviceNote: "Managed domain registration",
      active: true,
    });

    try {
      const response = await handlers.handleUserDomainOrders(
        await requestJson("/api/user/domain-orders", "POST", {
          domainName: "example.co.za",
          domainPlanId: planId,
          addonPlanIds: [],
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.reference).toBeTruthy();

      const order = await db.query.domainOrder.findFirst({
        where: eq(domainOrder.domainName, "example.co.za"),
      });
      expect(order?.status).toBe("pending_payment");
      expect(order?.subscriptionId).toBeTruthy();

      const subscriptionRow = await db.query.subscription.findFirst({
        where: eq(subscription.id, String(order?.subscriptionId)),
      });
      expect(subscriptionRow?.minimumTermMonths).toBe(12);
      expect(subscriptionRow?.minimumTermEndsAt).toBeTruthy();

      const invoiceRow = await db.query.invoice.findFirst({
        where: eq(invoice.id, String(order?.invoiceId)),
      });
      expect(invoiceRow?.amount).toBe(99);
      expect(invoiceRow?.invoiceSource).toBe("domain");
    } finally {
      await cleanupUsers([customerUserId, planId]);
      if (shouldCleanupService) {
        await db.delete(service).where(eq(service.id, "domains"));
        await db.delete(serviceCategory).where(eq(serviceCategory.id, categoryId));
      }
    }
  });

  test("registrar failure is retry-safe and only creates one follow-up ticket", async () => {
    const customerUserId = `cust_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const orderId = `order_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const handlers = makeDomainHandlers(customerUserId);
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.DOMAINS_CO_ZA_API_KEY;
    const originalRegisterUrl = process.env.DOMAINS_CO_ZA_REGISTER_URL;

    await db.insert(user).values({
      id: customerUserId,
      name: "Domain Customer",
      email: `domains-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: "customer",
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(domainOrder).values({
      id: orderId,
      userId: customerUserId,
      domainName: "failing-example.co.za",
      domainPlanId: null,
      addonPlanIds: JSON.stringify([]),
      invoiceId: null,
      subscriptionId: null,
      status: "paid",
    });

    process.env.DOMAINS_CO_ZA_API_KEY = "test-key";
    process.env.DOMAINS_CO_ZA_REGISTER_URL = "https://domains.example/register";
    globalThis.fetch = async () =>
      new Response("registrar failed", {
        status: 502,
        headers: { "content-type": "text/plain" },
      });

    try {
      const order = await db.query.domainOrder.findFirst({ where: eq(domainOrder.id, orderId) });
      expect(order).toBeTruthy();
      if (!order) throw new Error("Domain order fixture missing");

      await registerPaidDomainOrder(
        {
          db,
          makeId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
          recordAudit: async () => undefined,
          registeredDomain,
          domainOrder,
          supportTicket,
        },
        order,
        "https://cloudmonkey.co.za/dashboard/domains/new",
      );
      await registerPaidDomainOrder(
        {
          db,
          makeId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
          recordAudit: async () => undefined,
          registeredDomain,
          domainOrder,
          supportTicket,
        },
        order,
        "https://cloudmonkey.co.za/dashboard/domains/new",
      );

      const failedOrder = await db.query.domainOrder.findFirst({
        where: eq(domainOrder.id, orderId),
      });
      expect(failedOrder?.status).toBe("registration_failed");

      const tickets = await db.query.supportTicket.findMany({
        where: eq(supportTicket.aiSessionId, `domain-order:${orderId}`),
      });
      expect(tickets).toHaveLength(1);
      expect(tickets[0]?.category).toBe("domains");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.DOMAINS_CO_ZA_API_KEY;
      } else {
        process.env.DOMAINS_CO_ZA_API_KEY = originalKey;
      }
      if (originalRegisterUrl === undefined) {
        delete process.env.DOMAINS_CO_ZA_REGISTER_URL;
      } else {
        process.env.DOMAINS_CO_ZA_REGISTER_URL = originalRegisterUrl;
      }
      await cleanupUsers([customerUserId]);
      await db.delete(domainOrder).where(eq(domainOrder.id, orderId));
      await db.delete(supportTicket).where(eq(supportTicket.aiSessionId, `domain-order:${orderId}`));
    }
  });

  test("DNS access is blocked for domains not assigned to the current user", async () => {
    const ownerUserId = `owner_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const otherUserId = `other_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const domainName = `blocked-${crypto.randomUUID().slice(0, 6)}.co.za`;
    const handlers = makeDomainHandlers(ownerUserId);

    await db.insert(user).values([
      {
        id: ownerUserId,
        name: "Owner User",
        email: `owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherUserId,
        name: "Other User",
        email: `other-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await db.insert(registeredDomain).values({
      id: domainName,
      userId: otherUserId,
      status: "active",
      expiryDate: null,
    });

    try {
      const response = await handlers.handleUserDomainsDns(
        await requestJson(`/api/user/domains/dns?domain=${encodeURIComponent(domainName)}`, "GET"),
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
    } finally {
      await cleanupUsers([ownerUserId, otherUserId]);
      await db.delete(registeredDomain).where(eq(registeredDomain.id, domainName));
    }
  });
});
