import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import { db } from "../src/db";
import { invoice, invoicePayment, user } from "../src/db/schema";
import { captureInvoicePaymentAtomically } from "../src/lib/invoice-payment-capture";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function makeFixture(amount = 1000) {
  const userId = id("payment-user");
  const invoiceId = id("payment-invoice");
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Payment Capture Test",
    email: `${userId}@example.com`,
    emailVerified: true,
    role: "customer",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(invoice).values({
    id: invoiceId,
    userId,
    invoiceSource: "manual",
    amount,
    status: "pending",
    dueDate: now,
    currency: "ZAR",
    paymentMethod: "eft",
    collectionStatus: "current",
    createdAt: now,
    updatedAt: now,
  });
  return { invoiceId, userId };
}

async function cleanup(fixture: { invoiceId: string; userId: string }) {
  await db.delete(invoicePayment).where(eq(invoicePayment.invoiceId, fixture.invoiceId));
  await db.delete(invoice).where(eq(invoice.id, fixture.invoiceId));
  await db.delete(user).where(eq(user.id, fixture.userId));
}

const capture = (invoiceId: string, idempotencyKey: string, amount?: number) =>
  captureInvoicePaymentAtomically(db, {
    invoiceId,
    idempotencyKey,
    amount,
    method: "eft",
    reference: `REF-${idempotencyKey}`,
    notes: "idempotency test",
    capturedByUserId: null,
  });

describe("atomic invoice payment capture", () => {
  test("duplicate full-payment request returns the original payment without inserting twice", async () => {
    const fixture = await makeFixture();
    try {
      const first = await capture(fixture.invoiceId, "full-payment-key-001");
      const second = await capture(fixture.invoiceId, "full-payment-key-001");
      const rows = await db.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, fixture.invoiceId),
      });

      expect(first.payment?.id).toBe(second.payment?.id);
      expect(second.paid).toBe(true);
      expect(rows).toHaveLength(1);
    } finally {
      await cleanup(fixture);
    }
  });

  test("duplicate partial-payment request returns the original payment without inserting twice", async () => {
    const fixture = await makeFixture(1000);
    try {
      const first = await capture(fixture.invoiceId, "partial-payment-key-001", 400);
      const second = await capture(fixture.invoiceId, "partial-payment-key-001", 400);
      const rows = await db.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, fixture.invoiceId),
      });

      expect(first.payment?.id).toBe(second.payment?.id);
      expect(second.totalPaid).toBe(400);
      expect(rows).toHaveLength(1);
    } finally {
      await cleanup(fixture);
    }
  });

  test("concurrent distinct captures serialize on the invoice row and do not overpay", async () => {
    const fixture = await makeFixture(1000);
    try {
      const results = await Promise.all([
        capture(fixture.invoiceId, "concurrent-payment-key-a", 600),
        capture(fixture.invoiceId, "concurrent-payment-key-b", 600),
      ]);
      const rows = await db.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, fixture.invoiceId),
      });
      const total = rows.reduce((sum, row) => sum + row.amount, 0);

      expect(rows).toHaveLength(2);
      expect(total).toBe(1000);
      expect(results.map((result) => result.totalPaid).sort((a, b) => a - b)).toEqual([600, 1000]);
    } finally {
      await cleanup(fixture);
    }
  });

  test("retry after a successful response returns the same result key", async () => {
    const fixture = await makeFixture();
    try {
      const key = "response-lost-retry-key-001";
      const first = await capture(fixture.invoiceId, key);
      const retry = await capture(fixture.invoiceId, key);

      expect(retry.payment?.id).toBe(first.payment?.id);
      expect(retry.totalPaid).toBe(first.totalPaid);
    } finally {
      await cleanup(fixture);
    }
  });

  test("distinct sequential partial payments remain valid", async () => {
    const fixture = await makeFixture(1000);
    try {
      const first = await capture(fixture.invoiceId, "sequential-payment-key-a", 300);
      const second = await capture(fixture.invoiceId, "sequential-payment-key-b", 400);
      const rows = await db.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, fixture.invoiceId),
      });

      expect(first.paid).toBe(false);
      expect(second.paid).toBe(false);
      expect(second.totalPaid).toBe(700);
      expect(rows).toHaveLength(2);
    } finally {
      await cleanup(fixture);
    }
  });
});
