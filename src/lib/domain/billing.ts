/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from "drizzle-orm";
import { z } from "zod";

export type BillingDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  makeId: (prefix: string) => string;
  initializePayment: (input: any) => Promise<any>;
  verifyPayment: (reference: string) => Promise<any>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  sendEmail: (input: any) => Promise<void> | void;
  formatEmailDate: (value: string | Date | null | undefined) => string;
  upsertManualInvoiceLineSubscriptions: (input: any) => Promise<void>;
  createAffiliateCommissionForPayment: (input: any) => Promise<void>;
  tryRegisterPaidDomainOrder: (input: any, requestUrl: string) => Promise<void>;
  formatEmailMoney: (amount: number, currency?: string) => string;
  agreementRequirementForProduct: (input: any) => Promise<any>;
  safeServiceDefinition: (value: string | null | undefined) => unknown;
  signedAgreementExists: (input: any) => Promise<boolean>;
  runInvoiceCollections: (input: { origin: string; actorUserId?: string | null }) => Promise<any>;
  getWorkspaceSettings: () => Promise<any>;
  getWorkspaceBillingDetails: (settings: any) => any;
  captureInvoicePayment: (input: any) => Promise<any>;
  sendInvoiceCollectionReminder: (input: any) => Promise<void>;
  getInvoiceDocumentPayload: (invoiceId: string, session: any, origin: string) => Promise<any>;
  renderInvoicePdf: (document: any) => Promise<Uint8Array | Buffer | ArrayBuffer | Blob>;
  normalizeManualInvoiceLines: (body: any) => Array<any>;
  manualInvoiceSchema: any;
  manualPaymentCaptureSchema: any;
  invoiceVoidSchema: any;
  subscriptionSchema: any;
  invoice: any;
  invoiceItem: any;
  invoicePayment: any;
  subscription: any;
  domainOrder: any;
  user: any;
  servicePlan: any;
  bundle: any;
  addMonths: (date: Date, months: number) => Date;
};

export function buildManualInvoiceEditSchema() {
  return z
    .object({
    userId: z.string().min(1),
    name: z.string().min(1).optional(),
    amount: z.coerce.number().int().positive().optional(),
    interval: z.enum(["month", "year"]).optional(),
    planId: z.string().optional().nullable(),
    bundleId: z.string().optional().nullable(),
    websitePackageType: z.enum(["website", "ecommerce"]).optional().nullable(),
    items: z
      .array(
        z.object({
          description: z.string().min(1),
          quantity: z.coerce.number().int().positive().default(1),
          unitPrice: z.coerce.number().int().positive(),
          planId: z.string().optional().nullable(),
          bundleId: z.string().optional().nullable(),
          recurring: z.coerce.boolean().default(false),
          interval: z.enum(["month", "year"]).default("month"),
          websitePackageType: z.enum(["website", "ecommerce"]).optional().nullable(),
        }),
      )
      .optional(),
    billingPeriodStart: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    billingPeriodEnd: z.string().optional().nullable(),
    paymentMethod: z.enum(["gateway", "eft"]).optional(),
    notes: z.string().optional().nullable(),
    customerCompany: z.string().optional().nullable(),
    customerAddress: z.string().optional().nullable(),
    customerVatNumber: z.string().optional().nullable(),
    })
    .strict();
}

export function createBillingHandlers(deps: BillingDeps) {
  async function handleSubscriptionVerify(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    try {
      const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
      const url = new URL(request.url);
      const reference = url.searchParams.get("reference") ?? body.reference;
      const subscriptionId = url.searchParams.get("subscription") ?? body.subscriptionId;

      const targetInvoice = reference
        ? await deps.db.query.invoice.findFirst({
            where: eq(deps.invoice.paystackReference, reference),
          })
        : subscriptionId
          ? await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, subscriptionId) })
          : null;
      const targetSubscription = targetInvoice
        ? await deps.db.query.subscription.findFirst({
            where: eq(deps.subscription.id, targetInvoice.id),
            with: { plan: { with: { service: true } }, bundle: true },
          })
        : subscriptionId
          ? await deps.db.query.subscription.findFirst({
              where: eq(deps.subscription.id, subscriptionId),
              with: { plan: { with: { service: true } }, bundle: true },
            })
          : null;

      if (targetInvoice && targetInvoice.userId !== session.user.id) {
        return deps.json({ error: "Payment record not found" }, 404);
      }

      if (!targetInvoice) {
        if (!targetSubscription || targetSubscription.userId !== session.user.id) {
          return deps.json({ error: "Subscription not found" }, 404);
        }
        if (targetSubscription.status === "trialing") {
          return deps.json(
            { verified: true, invoice: null, subscription: targetSubscription },
            200,
          );
        }
        return deps.json({ error: "Payment record not found" }, 404);
      }

      if (!targetSubscription && targetInvoice.invoiceSource !== "manual") {
        return deps.json({ error: "Subscription not found" }, 404);
      }
      if (targetSubscription && targetSubscription.userId !== session.user.id) {
        return deps.json({ error: "Subscription not found" }, 404);
      }

      if (
        targetInvoice.status === "paid" &&
        (targetInvoice.invoiceSource === "manual" || targetSubscription?.status === "active")
      ) {
        return deps.json({
          verified: true,
          invoice: targetInvoice,
          subscription: targetSubscription,
        });
      }

      if (!targetInvoice.paystackReference) {
        return deps.json(
          { verified: false, invoice: targetInvoice, subscription: targetSubscription },
          200,
        );
      }

      const verification = await deps.verifyPayment(targetInvoice.paystackReference);
      const paid =
        verification?.data?.status === "success" ||
        verification?.data?.gateway_response === "Successful";
      if (!paid) {
        return deps.json(
          {
            verified: false,
            invoice: targetInvoice,
            subscription: targetSubscription,
            payment: verification?.data ?? null,
          },
          200,
        );
      }

      const [updatedInvoice] = await deps.db
        .update(deps.invoice)
        .set({
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(deps.invoice.id, targetInvoice.id))
        .returning();

      const [updatedSubscription] = targetSubscription
        ? await deps.db
            .update(deps.subscription)
            .set({
              status: "active",
              updatedAt: new Date(),
              currentPeriodStart: new Date(),
            })
            .where(eq(deps.subscription.id, targetSubscription.id))
            .returning()
        : [null];

      await deps.upsertManualInvoiceLineSubscriptions({
        invoiceId: updatedInvoice.id,
        userId: updatedInvoice.userId,
        billingPeriodStart: new Date(),
        billingPeriodEnd: updatedInvoice.billingPeriodEnd,
        status: "active",
      });

      await deps.createAffiliateCommissionForPayment({
        invoiceId: updatedInvoice.id,
        customerId: updatedInvoice.userId,
        amount: updatedInvoice.amount,
        subscriptionId: updatedSubscription?.id ?? updatedInvoice.id,
        paymentId: updatedInvoice.paystackReference ?? updatedInvoice.id,
      });

      const paidDomainOrder = await deps.db.query.domainOrder.findFirst({
        where: eq(deps.domainOrder.invoiceId, targetInvoice.id),
      });
      if (
        paidDomainOrder &&
        !["registered", "registration_failed"].includes(paidDomainOrder.status)
      ) {
        await deps.db
          .update(deps.domainOrder)
          .set({
            status: "paid",
            updatedAt: new Date(),
          })
          .where(eq(deps.domainOrder.id, paidDomainOrder.id));
        deps.tryRegisterPaidDomainOrder(paidDomainOrder, request.url).catch((error) => {
          console.error("Domain registration follow-up failed:", error);
        });
      }

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "subscription.verified",
        entityType: "subscription",
        entityId: targetSubscription?.id ?? targetInvoice.id,
        message: `Subscription payment verified for ${targetSubscription?.name ?? targetInvoice.invoiceNumber ?? targetInvoice.id}`,
        metadata: { reference: targetInvoice.paystackReference },
      });

      deps
        .sendEmail({
          template: "payment_received",
          to: session.user.email ?? "",
          subject: `Payment received for ${targetSubscription?.name ?? targetInvoice.invoiceNumber ?? "manual invoice"}`,
          data: {
            firstName: session.user.name,
            productName:
              targetSubscription?.name ?? targetInvoice.invoiceNumber ?? "Manual invoice",
            subscriptionName:
              targetSubscription?.name ?? targetInvoice.invoiceNumber ?? "Manual invoice",
            totalDue: deps.formatEmailMoney(
              updatedInvoice.amount,
              updatedInvoice.currency ?? "ZAR",
            ),
            primaryCtaText: "Open dashboard",
            primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
          },
          idempotencyKey: `payment:${targetInvoice.id}:received`,
        })
        .catch((error: any) => console.error("Payment receipt email failed:", error));

      return deps.json({
        verified: true,
        invoice: updatedInvoice,
        subscription: updatedSubscription,
      });
    } catch (error: any) {
      return deps.json({ error: error.message }, 500);
    }
  }

  async function handleAgreementRequirement(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const planId = url.searchParams.get("planId");
    const bundleId = url.searchParams.get("bundleId");
    if ((planId && bundleId) || (!planId && !bundleId)) {
      return deps.json({ error: "Choose either a planId or bundleId" }, 400);
    }

    const productType = planId ? "plan" : "bundle";
    const productId = planId ?? bundleId!;
    const product =
      productType === "plan"
        ? await deps.db.query.servicePlan.findFirst({
            where: eq(deps.servicePlan.id, productId),
            with: { service: true },
          })
        : await deps.db.query.bundle.findFirst({ where: eq(deps.bundle.id, productId) });
    if (!product) return deps.json({ error: "Selected product was not found" }, 404);

    const productName =
      productType === "plan"
        ? `${"service" in product ? (product.service?.name ?? "Service") : "Service"} - ${product.name}`
        : product.name;
    const requirement = await deps.agreementRequirementForProduct({
      productType,
      productId,
      productName,
      serviceDefinition: deps.safeServiceDefinition(product.serviceDefinition),
    });
    if (!requirement) return deps.json({ required: false });

    const hasSigned = await deps.signedAgreementExists({
      userId: session.user.id,
      templateId: requirement.template.id,
      documentHash: requirement.documentHash,
      productType,
      productId,
    });

    return deps.json({
      required: true,
      signed: hasSigned,
      productType,
      productId,
      productName,
      template: {
        id: requirement.template.id,
        title: requirement.template.title,
        version: requirement.template.version,
        documentType: requirement.template.documentType,
        body: requirement.template.body,
      },
      consentText: requirement.consentText,
      documentHash: requirement.documentHash,
      serviceDefinition: deps.safeServiceDefinition(product.serviceDefinition),
    });
  }

  async function handleBillingCollectionsRun(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    const secret = process.env.BILLING_COLLECTIONS_SECRET;
    const suppliedSecret =
      request.headers.get("x-cloudmonkey-cron-secret") ??
      new URL(request.url).searchParams.get("secret");
    const secretAllowed = Boolean(secret && suppliedSecret && suppliedSecret === secret);
    let actorUserId: string | null = null;

    if (!secretAllowed) {
      const { session, response } = await deps.requireAdmin(request);
      if (response) return response;
      actorUserId = session.user.id;
    }

    try {
      const result = await deps.runInvoiceCollections({
        origin: new URL(request.url).origin,
        actorUserId,
      });
      return deps.json(result);
    } catch (error: any) {
      return deps.json({ error: error.message }, error.status ?? 500);
    }
  }

  async function handleInvoices(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const invoiceId = parts[2];

    if (invoiceId) {
      const origin = `${url.protocol}//${url.host}`;
      const payload = await deps.getInvoiceDocumentPayload(
        decodeURIComponent(invoiceId),
        session,
        origin,
      );
      if (!payload) return deps.json({ error: "Invoice not found" }, 404);

      if (parts[3] === "pdf") {
        try {
          const pdf = await deps.renderInvoicePdf(payload.document);
          return new Response(pdf, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${payload.document.invoice.invoiceNumber}.pdf"`,
            },
          });
        } catch (error: any) {
          console.error("Invoice PDF failed:", error);
          return deps.json({ error: error.message || "Failed to generate PDF" }, 500);
        }
      }

      return deps.json(payload);
    }

    const userInvoices = await deps.db.query.invoice.findMany({
      where: eq(deps.invoice.userId, session.user.id),
      orderBy: (invoice: any, { desc }: any) => [desc(invoice.createdAt)],
    });
    return new Response(JSON.stringify(userInvoices.filter((row: any) => row.status !== "draft")), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handleAdminInvoices(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const invoiceId = parts[3];
    const action = parts[4];

    if (invoiceId && action === "send-reminder" && request.method === "POST") {
      try {
        const id = decodeURIComponent(invoiceId);
        const invoiceRow = await deps.db.query.invoice.findFirst({
          where: eq(deps.invoice.id, id),
        });
        if (!invoiceRow) return deps.json({ error: "Invoice not found" }, 404);

        const customer = await deps.db.query.user.findFirst({
          where: eq(deps.user.id, invoiceRow.userId),
        });
        if (!customer) return deps.json({ error: "Customer not found" }, 404);

        const origin = new URL(request.url).origin;
        const dayCount = invoiceRow.collectionDayCount ? invoiceRow.collectionDayCount + 1 : 1;

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
          .where(eq(deps.invoice.id, id));

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "invoice.reminder_sent",
          entityType: "invoice",
          entityId: id,
          message: `Manual payment reminder email sent to ${customer.email} for invoice ${invoiceRow.invoiceNumber ?? id}`,
          metadata: {
            invoiceNumber: invoiceRow.invoiceNumber,
            customerEmail: customer.email,
            collectionDayCount: dayCount,
          },
        });

        return deps.json({
          success: true,
          message: `Payment reminder email sent successfully to ${customer.email}.`,
        });
      } catch (error: any) {
        return deps.json({ error: error.message }, error.status ?? 500);
      }
    }

    if (invoiceId && action === "payments" && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.manualPaymentCaptureSchema);
        const result = await deps.captureInvoicePayment({
          invoiceId: decodeURIComponent(invoiceId),
          idempotencyKey: body.idempotencyKey,
          amount: body.amount ?? null,
          method: body.method,
          reference: body.reference ?? null,
          notes: body.notes ?? null,
          paidAt: body.paidAt ? new Date(body.paidAt) : null,
          capturedByUserId: session.user.id,
          origin: new URL(request.url).origin,
        });
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "invoice.payment_captured",
          entityType: "invoice",
          entityId: invoiceId,
          message: `${body.method.toUpperCase()} payment captured against invoice ${invoiceId}`,
          metadata: {
            amount: result.payment?.amount ?? null,
            reference: body.reference ?? null,
            paid: result.paid,
          },
        });
        return deps.json(result, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminManualInvoices(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const invoiceId = parts[3];
    const action = parts[4];

    if (request.method === "GET") {
      const userId = url.searchParams.get("userId");
      const rows = await deps.db.query.invoice.findMany({
        where: userId ? eq(deps.invoice.userId, userId) : undefined,
        orderBy: (invoice: any, { desc }: any) => [desc(invoice.createdAt)],
      });
      return deps.json(rows.filter((row: any) => row.invoiceSource === "manual"));
    }

    if (invoiceId && action === "void" && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.invoiceVoidSchema);
        const existing = await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, invoiceId) });
        if (!existing || existing.invoiceSource !== "manual")
          return deps.json({ error: "Invoice not found" }, 404);
        if (existing.status === "void") return deps.json({ invoice: existing });
        if (existing.status === "paid")
          return deps.json({ error: "Paid invoices cannot be voided" }, 409);

        const [updated] = await deps.db
          .update(deps.invoice)
          .set({
            status: "void",
            paystackUrl: null,
            updatedAt: new Date(),
          })
          .where(eq(deps.invoice.id, invoiceId))
          .returning();

        const linkedSubscription = await deps.db.query.subscription.findFirst({
          where: eq(deps.subscription.id, invoiceId),
        });
        if (linkedSubscription && linkedSubscription.status !== "active") {
          await deps.db
            .update(deps.subscription)
            .set({
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(deps.subscription.id, invoiceId));
        }

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "manual_invoice.voided",
          entityType: "invoice",
          entityId: invoiceId,
          message: `Manual invoice voided: ${existing.invoiceNumber ?? invoiceId}`,
          metadata: { reason: body.reason ?? null },
        });
        return deps.json({ invoice: updated });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (!invoiceId && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.manualInvoiceSchema);
        const targetUser = await deps.db.query.user.findFirst({ where: eq(deps.user.id, body.userId) });
        if (!targetUser) return deps.json({ error: "User not found" }, 404);
        const lines = deps.normalizeManualInvoiceLines(body);
        if (!lines.length || lines.some((item: any) => item.amount <= 0)) {
          return deps.json({ error: "Add at least one invoice line item with a positive amount" }, 400);
        }
        const settings = await deps.getWorkspaceSettings();
        const issuedAt = new Date();
        const billingPeriodStart = body.billingPeriodStart ? new Date(body.billingPeriodStart) : issuedAt;
        const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const billingPeriodEnd = body.billingPeriodEnd
          ? new Date(body.billingPeriodEnd)
          : (() => {
              const end = new Date(billingPeriodStart);
              end.setMonth(end.getMonth() + (body.interval === "year" ? 12 : 1));
              return end;
            })();
        const createdId = deps.makeId("inv");
        const invoiceNumber = `INV-${issuedAt.getFullYear()}-${createdId
          .replace(/^inv[_-]?/i, "")
          .replace(/[^a-z0-9]/gi, "")
          .slice(-6)
          .toUpperCase()}`;
        const invoiceTotal = lines.reduce((sum: number, item: any) => sum + item.amount, 0);
        const [created] = await deps.db.transaction(async (tx: any) => {
          const [createdInvoice] = await tx
            .insert(deps.invoice)
            .values({
              id: createdId,
              userId: body.userId,
              invoiceNumber,
              invoiceSource: "manual",
              amount: invoiceTotal,
              status: "draft",
              dueDate,
              issuedAt,
              billingPeriodStart,
              billingPeriodEnd,
              currency: "ZAR",
              vatRateBps: 0,
              customerName: targetUser.name,
              customerEmail: targetUser.email,
              customerCompany: body.customerCompany ?? null,
              customerAddress: body.customerAddress ?? null,
              customerVatNumber: body.customerVatNumber ?? null,
              workspaceBillingSnapshot: JSON.stringify(deps.getWorkspaceBillingDetails(settings)),
              paymentMethod: body.paymentMethod,
              notes: body.notes ?? settings?.billingInvoiceNotes ?? null,
            })
            .returning();
          await tx.insert(deps.invoiceItem).values(
            lines.map((line: any) => ({
              id: deps.makeId("invitem"),
              invoiceId: createdId,
              planId: line.planId ?? null,
              bundleId: line.bundleId ?? null,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: line.amount,
              recurring: line.recurring,
              interval: line.interval,
              websitePackageType: line.websitePackageType ?? null,
            })),
          );
          return [createdInvoice];
        });
        await deps.upsertManualInvoiceLineSubscriptions({
          invoiceId: created.id,
          userId: body.userId,
          billingPeriodStart,
          billingPeriodEnd,
          status: "pending",
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "manual_invoice.created",
          entityType: "invoice",
          entityId: created.id,
          message: `Manual invoice draft created for ${targetUser.email}`,
          metadata: { userId: body.userId, amount: invoiceTotal, lines: lines.length },
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (invoiceId && request.method === "PUT") {
      try {
        const body = await deps.parseBody(request, buildManualInvoiceEditSchema());
        const existing = await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, invoiceId) });
        if (!existing || existing.invoiceSource !== "manual")
          return deps.json({ error: "Invoice not found" }, 404);
        if (existing.status !== "draft")
          return deps.json({ error: "Only draft manual invoices can be edited" }, 409);

        const updateValues: Partial<typeof deps.invoice.$inferInsert> = {
          amount: body.amount ?? existing.amount,
          billingPeriodStart: body.billingPeriodStart
            ? new Date(body.billingPeriodStart)
            : existing.billingPeriodStart,
          dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
          billingPeriodEnd: body.billingPeriodEnd ? new Date(body.billingPeriodEnd) : existing.billingPeriodEnd,
          customerCompany: body.customerCompany ?? existing.customerCompany,
          customerAddress: body.customerAddress ?? existing.customerAddress,
          customerVatNumber: body.customerVatNumber ?? existing.customerVatNumber,
          paymentMethod: body.paymentMethod ?? existing.paymentMethod,
          notes: body.notes ?? existing.notes,
          updatedAt: new Date(),
        };
        const [updated] = await deps.db
          .update(deps.invoice)
          .set(updateValues)
          .where(eq(deps.invoice.id, invoiceId))
          .returning();
        if (body.name || body.amount) {
          const existingItem = await deps.db.query.invoiceItem.findFirst({
            where: eq(deps.invoiceItem.invoiceId, invoiceId),
          });
          if (existingItem) {
            await deps.db
              .update(deps.invoiceItem)
              .set({
                description: body.name ?? existingItem.description,
                unitPrice: body.amount ?? existingItem.unitPrice,
                amount: body.amount ?? existingItem.amount,
              })
              .where(eq(deps.invoiceItem.id, existingItem.id));
          }
        }
        return deps.json(updated);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (invoiceId && action === "publish" && request.method === "POST") {
      try {
        const existing = await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, invoiceId) });
        if (!existing || existing.invoiceSource !== "manual")
          return deps.json({ error: "Invoice not found" }, 404);
        if (existing.status !== "draft")
          return deps.json({ error: "Invoice is already published" }, 409);
        const targetUser = await deps.db.query.user.findFirst({ where: eq(deps.user.id, existing.userId) });
        if (!targetUser?.email) return deps.json({ error: "Customer email is required" }, 400);
        const callbackUrl = `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`;
        const shouldUseGateway = existing.paymentMethod !== "eft";
        const payment = shouldUseGateway
          ? await deps.initializePayment({
              email: targetUser.email,
              amountCents: existing.amount,
              invoiceId,
              subscriptionId: invoiceId,
              userId: existing.userId,
              callbackUrl,
            })
          : null;

        await deps.db.transaction(async (tx: any) => {
          await tx
            .update(deps.invoice)
            .set({
              status: "pending",
              publishedAt: new Date(),
              paystackReference: payment?.data.reference ?? null,
              paystackUrl: payment?.data.authorization_url ?? null,
              updatedAt: new Date(),
            })
            .where(eq(deps.invoice.id, invoiceId));
        });
        await deps.upsertManualInvoiceLineSubscriptions({
          invoiceId,
          userId: existing.userId,
          billingPeriodStart: existing.billingPeriodStart ?? new Date(),
          billingPeriodEnd: existing.billingPeriodEnd,
          status: "pending",
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "manual_invoice.published",
          entityType: "invoice",
          entityId: invoiceId,
          message: `Manual invoice published for ${targetUser.email}`,
          metadata: { reference: payment?.data.reference ?? null, paymentMethod: existing.paymentMethod },
        });

        const updated = await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, invoiceId) });
        return deps.json({
          invoice: updated,
          authorization_url: payment?.data.authorization_url ?? null,
          reference: payment?.data.reference ?? null,
        });
      } catch (error: any) {
        return deps.json({ error: error.message }, 500);
      }
    }

    if (invoiceId && action === "email" && request.method === "POST") {
      try {
        const existing = await deps.db.query.invoice.findFirst({ where: eq(deps.invoice.id, invoiceId) });
        if (!existing || existing.invoiceSource !== "manual")
          return deps.json({ error: "Invoice not found" }, 404);
        if (existing.status === "draft")
          return deps.json({ error: "Publish the invoice before emailing it" }, 409);
        if (existing.paymentMethod !== "eft" && !existing.paystackUrl)
          return deps.json({ error: "Invoice does not have a payment link yet" }, 409);
        const targetUser = await deps.db.query.user.findFirst({ where: eq(deps.user.id, existing.userId) });
        if (!targetUser?.email) return deps.json({ error: "Customer email is required" }, 400);
        const item = await deps.db.query.invoiceItem.findFirst({
          where: eq(deps.invoiceItem.invoiceId, invoiceId),
        });

        await deps.sendEmail({
          template: "invoice_created",
          to: targetUser.email,
          subject: `CloudMonkey invoice ${existing.invoiceNumber ?? existing.id}`,
          data: {
            firstName: targetUser.name,
            customerName: targetUser.name,
            invoiceId,
            invoiceNumber: existing.invoiceNumber ?? invoiceId,
            productName: item?.description ?? "CloudMonkey services",
            subscriptionName: item?.description ?? "CloudMonkey services",
            totalDue: deps.formatEmailMoney(existing.amount, existing.currency ?? "ZAR"),
            dueDate: deps.formatEmailDate(existing.dueDate),
            primaryCtaText: "View and pay invoice",
            primaryCtaUrl: `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`,
          },
          idempotencyKey: `manual-invoice:${invoiceId}:email:${Date.now()}`,
        });

        const [updated] = await deps.db
          .update(deps.invoice)
          .set({
            emailedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deps.invoice.id, invoiceId))
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "manual_invoice.emailed",
          entityType: "invoice",
          entityId: invoiceId,
          message: `Manual invoice emailed to ${targetUser.email}`,
        });
        return deps.json(updated);
      } catch (error: any) {
        console.error("EMAIL ENDPOINT ERROR:", error);
        return deps.json({ error: error.message }, 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminSubscriptions(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const subscriptionId = parts[3];
    const action = parts[4];

    if (subscriptionId && action === "cancel" && request.method === "POST") {
      try {
        const existing = await deps.db.query.subscription.findFirst({
          where: eq(deps.subscription.id, subscriptionId),
        });
        if (!existing) return deps.json({ error: "Subscription not found" }, 404);
        if (existing.status === "cancelled") return deps.json({ subscription: existing });

        const [updated] = await deps.db
          .update(deps.subscription)
          .set({
            status: "cancelled",
            currentPeriodEnd: existing.currentPeriodEnd ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deps.subscription.id, subscriptionId))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "subscription.cancelled",
          entityType: "subscription",
          entityId: subscriptionId,
          message: `Subscription cancelled: ${existing.name}`,
          metadata: { userId: existing.userId },
        });

        return deps.json({ subscription: updated });
      } catch (error: any) {
        return deps.json({ error: error.message }, 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await deps.parseBody(request, deps.subscriptionSchema);
        const periodStart = new Date();
        const [created] = await deps.db
          .insert(deps.subscription)
          .values({
            id: deps.makeId("sub"),
            ...body,
            minimumTermEndsAt: body.minimumTermMonths
              ? deps.addMonths(periodStart, body.minimumTermMonths)
              : null,
            currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : null,
          })
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "subscription.created",
          entityType: "subscription",
          entityId: created.id,
          message: `Subscription created for ${created.name}`,
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const rows = await deps.db.query.subscription.findMany({
      with: { user: true, plan: true, bundle: true },
      orderBy: (subscription: any, { desc }: any) => [desc(subscription.createdAt)],
    });
    return deps.json(rows);
  }

  return {
    handleSubscriptionVerify,
    handleAgreementRequirement,
    handleBillingCollectionsRun,
    handleInvoices,
    handleAdminInvoices,
    handleAdminManualInvoices,
    handleAdminSubscriptions,
  };
}
