import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { db } from "../src/db";
import { invoice, invoiceItem, invoicePayment, subscription, user } from "../src/db/schema";
import { buildManualInvoiceEditSchema, createBillingHandlers } from "../src/lib/domain/billing";

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

function makeTestDeps() {
  const counters = new Map<string, number>();
  return createBillingHandlers({
    db,
    json: jsonResponse,
    parseBody: async (request) => (await request.json()) as any,
    requireSession: async () => ({ session: null, response: jsonResponse({ error: "Unauthorized" }, 401) }),
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
    makeId: (prefix) => {
      const current = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, current);
      return `${prefix}_${current}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    },
    initializePayment: async () => {
      throw new Error("initializePayment should not be called for EFT manual invoices");
    },
    verifyPayment: async () => ({ data: { status: "success", gateway_response: "Successful" } }),
    recordAudit: async () => undefined,
    sendEmail: async () => undefined,
    formatEmailDate: (value) => (value ? new Date(value).toISOString() : ""),
    upsertManualInvoiceLineSubscriptions: async () => undefined,
    createAffiliateCommissionForPayment: async () => undefined,
    tryRegisterPaidDomainOrder: async () => undefined,
    formatEmailMoney: (amount, currency = "ZAR") => `${currency} ${amount}`,
    agreementRequirementForProduct: async () => null,
    safeServiceDefinition: (value) => value,
    signedAgreementExists: async () => false,
    runInvoiceCollections: async () => ({ scanned: 0, reminded: 0, suspended: 0, skipped: 0 }),
    getWorkspaceSettings: async () => ({}),
    getWorkspaceBillingDetails: () => ({ bankName: "CloudMonkey", bankAccountName: "CloudMonkey", bankAccountNumber: "123", bankBranchCode: "000" }),
    captureInvoicePayment: async (input) => {
      const invoiceRow = await db.query.invoice.findFirst({ where: eq(invoice.id, input.invoiceId) });
      if (!invoiceRow) throw Object.assign(new Error("Invoice not found"), { status: 404 });
      if (["draft", "void", "cancelled"].includes(invoiceRow.status)) {
        throw Object.assign(new Error("Only published invoices can receive payments"), { status: 409 });
      }
      const [paymentRow] = await db
        .insert(invoicePayment)
        .values({
          id: `pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
          invoiceId: invoiceRow.id,
          userId: invoiceRow.userId,
          amount: input.amount ?? invoiceRow.amount,
          method: input.method,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          capturedByUserId: null,
          paidAt: input.paidAt ?? new Date(),
        })
        .returning();
      const [updatedInvoice] = await db
        .update(invoice)
        .set({
          status: "paid",
          paymentMethod: input.method === "gateway" ? "gateway" : "manual",
          collectionStatus: "paid",
          paidAt: input.paidAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoice.id, invoiceRow.id))
        .returning();
      return { invoice: updatedInvoice, payment: paymentRow, paid: true, totalPaid: updatedInvoice.amount };
    },
    sendInvoiceCollectionReminder: async () => undefined,
    getInvoiceDocumentPayload: async () => null,
    renderInvoicePdf: async () => new Uint8Array(),
    normalizeManualInvoiceLines: (body) => {
      const items = Array.isArray(body.items) && body.items.length
        ? body.items
        : [
            {
              description: body.name ?? "Manual CloudMonkey invoice",
              quantity: 1,
              unitPrice: body.amount ?? 0,
              recurring: Boolean(body.planId || body.bundleId),
              interval: body.interval ?? "month",
              planId: body.planId ?? null,
              bundleId: body.bundleId ?? null,
              websitePackageType: body.websitePackageType ?? null,
            },
          ];
      return items.map((item: any) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
        return {
          description: String(item.description ?? "Manual CloudMonkey invoice"),
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
          planId: item.planId ?? null,
          bundleId: item.bundleId ?? null,
          recurring: Boolean(item.recurring),
          interval: item.interval ?? "month",
          websitePackageType: item.websitePackageType ?? null,
        };
      });
    },
    manualInvoiceSchema: {} as any,
    manualPaymentCaptureSchema: z.object({
      idempotencyKey: z.string().min(16).max(200),
      amount: z.coerce.number().int().positive().optional().nullable(),
      method: z.enum(["eft", "cash", "manual", "gateway"]).default("eft"),
      reference: z.string().max(160).optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
      paidAt: z.string().optional().nullable(),
    }),
    invoiceVoidSchema: z.object({
      reason: z.string().optional().nullable(),
    }),
    subscriptionSchema: z.object({
      userId: z.string().min(1),
      name: z.string().min(1),
      status: z.enum(["pending", "active", "trialing", "past_due", "suspended", "cancelled"]).default("pending"),
      amount: z.coerce.number().int().nonnegative(),
      interval: z.enum(["month", "year"]).default("month"),
      minimumTermMonths: z.coerce.number().int().positive().optional().nullable(),
      planId: z.string().optional().nullable(),
      bundleId: z.string().optional().nullable(),
      currentPeriodEnd: z.string().optional().nullable(),
    }),
    invoice,
    invoiceItem,
    invoicePayment,
    subscription,
    domainOrder: {} as never,
    user,
    servicePlan: {} as never,
    bundle: {} as never,
    addMonths: (date, months) => {
      const next = new Date(date);
      next.setMonth(next.getMonth() + months);
      return next;
    },
  });
}

async function requestJson(path: string, method: string, body?: JsonBody) {
  return new Request(`https://cloudmonkey.co.za${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("manual invoice lifecycle", () => {
  test("manual invoice edit schema accepts partial edits and rejects unknown fields", () => {
    const schema = buildManualInvoiceEditSchema();

    expect(
      schema.safeParse({
        userId: "cust_123",
        amount: 18000,
        paymentMethod: "eft",
      }).success,
    ).toBe(true);

    const invalid = schema.safeParse({
      userId: "cust_123",
      amount: 18000,
      unexpectedField: "not allowed",
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(
        invalid.error.issues.some(
          (issue) =>
            issue.code === "unrecognized_keys" &&
            Array.isArray((issue as { keys?: string[] }).keys) &&
            (issue as { keys?: string[] }).keys?.includes("unexpectedField"),
        ),
      ).toBe(true);
    }
  });

  test("create, edit, publish, pay, and reject void after payment", async () => {
    const adminUserId = `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const customerUserId = `cust_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const timestamp = new Date();
    const customerEmail = `billing-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const handlers = makeTestDeps();

    await db.insert(user).values([
      {
        id: adminUserId,
        name: "Admin Tester",
        email: `admin-${crypto.randomUUID().slice(0, 8)}@example.com`,
        emailVerified: true,
        role: "admin",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: customerUserId,
        name: "Billing Customer",
        email: customerEmail,
        emailVerified: true,
        role: "customer",
        twoFactorEnabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);

    let invoiceId = "";

    try {
      const createResponse = await handlers.handleAdminManualInvoices(
        await requestJson("/api/admin/manual-invoices", "POST", {
          userId: customerUserId,
          name: "Managed Cloud Service",
          amount: 15000,
          interval: "month",
          paymentMethod: "eft",
          notes: "Lifecycle test",
        }),
      );
      expect(createResponse.status).toBe(201);
      const createdInvoice = (await createResponse.json()) as { id: string; status: string; invoiceSource: string; amount: number };
      invoiceId = createdInvoice.id;
      expect(createdInvoice.invoiceSource).toBe("manual");
      expect(createdInvoice.status).toBe("draft");
      expect(createdInvoice.amount).toBe(15000);

      const editResponse = await handlers.handleAdminManualInvoices(
        await requestJson(`/api/admin/manual-invoices/${invoiceId}`, "PUT", {
          userId: customerUserId,
          name: "Managed Cloud Service Updated",
          amount: 18000,
          paymentMethod: "eft",
        }),
      );
      expect(editResponse.status).toBe(200);
      const editedInvoice = (await editResponse.json()) as { amount: number; status: string };
      expect(editedInvoice.amount).toBe(18000);
      expect(editedInvoice.status).toBe("draft");

      const publishResponse = await handlers.handleAdminManualInvoices(
        await requestJson(`/api/admin/manual-invoices/${invoiceId}/publish`, "POST"),
      );
      expect(publishResponse.status).toBe(200);
      const published = (await publishResponse.json()) as {
        invoice?: { status: string; paymentMethod: string; publishedAt: string | null };
        reference: string | null;
      };
      expect(published.invoice?.status).toBe("pending");
      expect(published.invoice?.paymentMethod).toBe("eft");
      expect(published.reference).toBeNull();

      const paymentResponse = await handlers.handleAdminInvoices(
        await requestJson(`/api/admin/invoices/${invoiceId}/payments`, "POST", {
          idempotencyKey: "EFT-LIFECYCLE-IDEMPOTENCY-001",
          method: "eft",
          reference: "EFT-LIFECYCLE-001",
          notes: "Manual EFT capture",
        }),
      );
      expect(paymentResponse.status).toBe(201);
      const paymentResult = (await paymentResponse.json()) as {
        paid: boolean;
        invoice: { id: string; status: string; paidAt: string | null };
        payment: { method: string; reference: string | null };
      };
      expect(paymentResult.paid).toBe(true);
      expect(paymentResult.invoice.status).toBe("paid");
      expect(paymentResult.payment.method).toBe("eft");
      expect(paymentResult.payment.reference).toBe("EFT-LIFECYCLE-001");

      const voidResponse = await handlers.handleAdminManualInvoices(
        await requestJson(`/api/admin/manual-invoices/${invoiceId}/void`, "POST", {
          reason: "Should not void after payment",
        }),
      );
      expect(voidResponse.status).toBe(409);
      const voidResult = (await voidResponse.json()) as { error: string };
      expect(voidResult.error).toContain("Paid invoices cannot be voided");

      const finalInvoice = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
      expect(finalInvoice?.status).toBe("paid");
      const finalPayments = await db.query.invoicePayment.findMany({ where: eq(invoicePayment.invoiceId, invoiceId) });
      expect(finalPayments).toHaveLength(1);
    } finally {
      if (invoiceId) {
        await db.delete(invoicePayment).where(eq(invoicePayment.invoiceId, invoiceId));
        await db.delete(invoiceItem).where(eq(invoiceItem.invoiceId, invoiceId));
        await db.delete(subscription).where(eq(subscription.id, invoiceId));
        await db.delete(invoice).where(eq(invoice.id, invoiceId));
      }
      await db.delete(user).where(eq(user.id, customerUserId));
      await db.delete(user).where(eq(user.id, adminUserId));
    }
  });
});
