/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { sql } from "drizzle-orm";

type InternalToolsDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  recordInternalToolAudit: (entry: Record<string, unknown>) => Promise<void>;
  getRequestIp: (request: Request) => string | null;
  getRequestUserAgent: (request: Request) => string | null;
  verifyInternalSqlConsoleAccess: (
    request: Request,
    bodyText?: string,
  ) => { ok: true } | { ok: false; status: number; error: string };
  verifyInternalAdminSecondFactor: (
    request: Request,
    bodyText?: string,
  ) => { ok: true } | { ok: false; status: number; error: string };
  sendInvoiceCollectionReminder: (input: any) => Promise<void>;
  invoice: any;
  user: any;
  eq: (...args: any[]) => any;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
};

export function createInternalToolsHandlers(deps: InternalToolsDeps) {
  async function handleSqlConsole(
    request: Request,
    session: { user: { id: string; email?: string | null; role?: string | null } },
  ) {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const bodyText = await request.text();
      const access = deps.verifyInternalSqlConsoleAccess(request, bodyText);
      if (!access.ok) return deps.json({ error: access.error }, access.status);

      const body = bodyText ? JSON.parse(bodyText) : {};
      const queryText = String(body.query || "").trim();
      if (!queryText) {
        return deps.json({ error: "query is required" }, 400);
      }

      const cleanQuery = queryText
        .replace(/\s+LIMIT\s+\d+\s*;?\s*$/i, "")
        .replace(/\s+LIMIT\s+\d+\s+OFFSET\s+\d+\s*;?\s*$/i, "");
      const queryHash = crypto.createHash("sha256").update(cleanQuery).digest("hex");
      await deps.recordInternalToolAudit({
        action: "internal_sql.execute",
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role ?? null,
        remoteIp: deps.getRequestIp(request),
        userAgent: deps.getRequestUserAgent(request),
        method: request.method,
        pathname: new URL(request.url).pathname,
        queryHash,
        query: cleanQuery,
      });

      const result = await deps.db.execute(sql.raw(cleanQuery));
      const responsePayload =
        Array.isArray(result) && result.length === 0
          ? [
              {
                success: true,
                message: "Command executed successfully. No rows returned.",
                rowsAffected: (result as any).count ?? 0,
              },
            ]
          : result;

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      await deps
        .recordInternalToolAudit({
          action: "internal_sql.failed",
          actorUserId: session?.user?.id ?? null,
          actorEmail: session?.user?.email ?? null,
          remoteIp: deps.getRequestIp(request),
          userAgent: deps.getRequestUserAgent(request),
          pathname: new URL(request.url).pathname,
          error: err.message,
        })
        .catch(() => undefined);
      return deps.json({ error: err.message }, 400);
    }
  }

  async function handleSendReminder(
    request: Request,
    session: { user: { id: string; email?: string | null; role?: string | null } },
  ) {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const bodyText = await request.text();
      const body = bodyText ? JSON.parse(bodyText) : {};
      const access = deps.verifyInternalAdminSecondFactor(request, bodyText);
      if (!access.ok) return deps.json({ error: access.error }, access.status);

      const invoiceId = body.invoiceId;
      if (!invoiceId) {
        return deps.json({ error: "invoiceId is required" }, 400);
      }

      const invoiceRow = await deps.db.query.invoice.findFirst({
        where: deps.eq(deps.invoice.id, invoiceId),
      });
      if (!invoiceRow) {
        return deps.json({ error: "Invoice not found" }, 404);
      }

      const customer = await deps.db.query.user.findFirst({
        where: deps.eq(deps.user.id, invoiceRow.userId),
      });
      if (!customer) {
        return deps.json({ error: "Customer not found" }, 404);
      }

      const origin = new URL(request.url).origin;
      const dayCount = invoiceRow.collectionDayCount ? invoiceRow.collectionDayCount + 1 : 1;

      await deps.recordInternalToolAudit({
        action: "internal_send_reminder",
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
        actorRole: session.user.role ?? null,
        remoteIp: deps.getRequestIp(request),
        userAgent: deps.getRequestUserAgent(request),
        pathname: new URL(request.url).pathname,
        invoiceId,
        invoiceNumber: invoiceRow.invoiceNumber ?? null,
        customerEmail: customer.email,
        collectionDayCount: dayCount,
      });

      await deps.sendInvoiceCollectionReminder({
        invoiceRow,
        customer,
        day: dayCount,
        origin,
      });

      const now = new Date();
      await deps.db
        .update(deps.invoice)
        .set({
          lastReminderAt: now,
          collectionDayCount: dayCount,
          firstReminderAt: invoiceRow.firstReminderAt ?? now,
        })
        .where(deps.eq(deps.invoice.id, invoiceId));

      await deps.recordAudit({
        actorUserId: null,
        action: "invoice.reminder_sent",
        entityType: "invoice",
        entityId: invoiceId,
        message: `Payment reminder email sent to ${customer.email} for invoice ${invoiceRow.invoiceNumber ?? invoiceId} (triggered via admin copilot)`,
        metadata: {
          invoiceNumber: invoiceRow.invoiceNumber,
          customerEmail: customer.email,
          collectionDayCount: dayCount,
        },
      });

      return deps.json({
        success: true,
        message: `Payment reminder email sent successfully to ${customer.email} for invoice ${invoiceRow.invoiceNumber ?? invoiceId}.`,
      });
    } catch (err: any) {
      await deps
        .recordInternalToolAudit({
          action: "internal_send_reminder.failed",
          actorUserId: session?.user?.id ?? null,
          actorEmail: session?.user?.email ?? null,
          remoteIp: deps.getRequestIp(request),
          userAgent: deps.getRequestUserAgent(request),
          pathname: new URL(request.url).pathname,
          error: err.message,
        })
        .catch(() => undefined);
      return deps.json({ error: err.message }, 500);
    }
  }

  return {
    handleSqlConsole,
    handleSendReminder,
  };
}
