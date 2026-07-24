import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { invoice, invoicePayment } from "../db/schema";

export type InvoicePaymentCaptureInput = {
  invoiceId: string;
  amount?: number | null;
  method: "eft" | "cash" | "manual" | "gateway";
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
  capturedByUserId?: string | null;
  idempotencyKey: string;
};

export async function captureInvoicePaymentAtomically(db: any, input: InvoicePaymentCaptureInput) {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`
      select 1
      from ${invoice}
      where ${invoice.id} = ${input.invoiceId}
      for update
    `);

    const invoiceRow = await tx.query.invoice.findFirst({
      where: eq(invoice.id, input.invoiceId),
    });
    if (!invoiceRow) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (["draft", "void", "cancelled"].includes(invoiceRow.status)) {
      throw Object.assign(new Error("Only published invoices can receive payments"), {
        status: 409,
      });
    }

    const existingPayment = await tx.query.invoicePayment.findFirst({
      where: and(
        eq(invoicePayment.invoiceId, input.invoiceId),
        eq(invoicePayment.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existingPayment) {
      const payments = await tx.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, invoiceRow.id),
      });
      const totalPaid = payments.reduce(
        (sum: number, row: any) => sum + Math.max(0, Number(row.amount) || 0),
        0,
      );
      return {
        invoice: invoiceRow,
        payment: existingPayment,
        paid: invoiceRow.status === "paid",
        totalPaid,
        shouldActivate: false,
      };
    }

    if (invoiceRow.status === "paid") {
      const payments = await tx.query.invoicePayment.findMany({
        where: eq(invoicePayment.invoiceId, invoiceRow.id),
      });
      return {
        invoice: invoiceRow,
        payment: null,
        paid: true,
        totalPaid: payments.reduce(
          (sum: number, row: any) => sum + Math.max(0, Number(row.amount) || 0),
          0,
        ),
        shouldActivate: false,
      };
    }

    const payments = await tx.query.invoicePayment.findMany({
      where: eq(invoicePayment.invoiceId, invoiceRow.id),
    });
    const existingPaid = payments.reduce(
      (sum: number, row: any) => sum + Math.max(0, Number(row.amount) || 0),
      0,
    );
    const remaining = Math.max(0, invoiceRow.amount - existingPaid);
    const amount = Math.min(input.amount ?? remaining, remaining);
    if (amount <= 0) {
      throw Object.assign(new Error("Invoice has no outstanding balance"), { status: 409 });
    }

    const paidAt = input.paidAt ?? new Date();
    const [paymentRow] = await tx
      .insert(invoicePayment)
      .values({
        id: `invpay_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        invoiceId: invoiceRow.id,
        userId: invoiceRow.userId,
        amount,
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey,
        capturedByUserId: input.capturedByUserId ?? null,
        paidAt,
      })
      .returning();

    const totalPaid = existingPaid + amount;
    const [updatedInvoice] = await tx
      .update(invoice)
      .set({
        ...(totalPaid >= invoiceRow.amount
          ? {
              status: "paid",
              paymentMethod: input.method === "gateway" ? "gateway" : "manual",
              collectionStatus: "paid",
              paidAt,
            }
          : {
              paymentMethod: input.method === "gateway" ? "gateway" : "manual",
            }),
        updatedAt: new Date(),
      })
      .where(eq(invoice.id, invoiceRow.id))
      .returning();

    return {
      invoice: updatedInvoice,
      payment: paymentRow,
      paid: totalPaid >= invoiceRow.amount,
      totalPaid,
      shouldActivate: totalPaid >= invoiceRow.amount,
    };
  });
}
