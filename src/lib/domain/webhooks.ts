/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { processPaystackTopUpWebhook } from "./wallet";

export type WebhookDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  sendEmail: (input: any) => Promise<void> | void;
  verifyMailjetWebhookSignature: (
    request: Request,
    bodyText: string,
  ) => { ok: true } | { ok: false; status: number; error: string };
  verifyIntelligenceWebhook: (request: Request) => boolean;
  persistIntelligenceWebhookResult: (body: any) => Promise<{ project: { id: string } }>;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  intelligenceWebhookResultSchema: any;
  proposal: any;
  invoice: any;
  subscription: any;
  domainOrder: any;
  user: any;
  formatEmailMoney: (amount: number, currency?: string) => string;
  createAffiliateCommissionForPayment: (input: any) => Promise<void>;
  upsertManualInvoiceLineSubscriptions: (input: any) => Promise<void>;
  tryRegisterPaidDomainOrder: (input: any, requestUrl: string) => Promise<void>;
  makeId: (prefix: string) => string;
  tokenWallet: any;
  tokenWalletLedger: any;
  tokenWalletReservation: any;
  tokenFeatureRate: any;
  tokenTopupIntent: any;
};

export function toPublicDomainAvailability(
  data: unknown,
  domain: string,
  sld: string,
  tld: string,
) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid domain availability response");
  }

  const upstream = data as Record<string, unknown>;
  const availability = upstream.isAvailable;
  if (
    availability !== true &&
    availability !== false &&
    availability !== "true" &&
    availability !== "false"
  ) {
    throw new Error("Domain availability response is missing availability");
  }

  const isAvailable = availability === true || availability === "true";
  const upstreamMessage =
    typeof upstream.strMessage === "string" ? upstream.strMessage.trim().slice(0, 200) : "";
  const premium = upstream.isPremium;

  return {
    domain,
    sld,
    tld,
    isAvailable,
    strMessage: upstreamMessage || (isAvailable ? "Domain Available" : "Domain Unavailable"),
    isPremium: premium === true || premium === "true",
  };
}

export function createWebhookHandlers(deps: WebhookDeps) {
  async function handleMailjetWebhook(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);

    try {
      const bodyText = await request.text();
      const signatureCheck = deps.verifyMailjetWebhookSignature(request, bodyText);
      if (!signatureCheck.ok)
        return deps.json({ error: signatureCheck.error }, signatureCheck.status);

      const events = JSON.parse(bodyText);
      if (!Array.isArray(events)) return deps.json({ error: "Invalid payload" }, 400);

      for (const event of events) {
        if (!event.CustomID || !event.CustomID.startsWith("proposal:")) continue;
        const proposalId = event.CustomID.split(":")[1];
        const time = event.time ? new Date(event.time * 1000) : new Date();

        if (event.event === "sent" || event.event === "delivered") {
          await deps.db
            .update(deps.proposal)
            .set({ deliveredAt: time })
            .where(eq(deps.proposal.id, proposalId));
        } else if (event.event === "open" || event.event === "click") {
          await deps.db
            .update(deps.proposal)
            .set({ viewedAt: time })
            .where(eq(deps.proposal.id, proposalId));
        }
      }
      return deps.json({ ok: true });
    } catch (error: any) {
      console.error("Mailjet webhook error:", error);
      return deps.json({ error: "Internal error" }, 500);
    }
  }

  async function handlePaystackWebhook(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const signature = request.headers.get("x-paystack-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return new Response("Paystack is not configured", { status: 503 });

    const bodyText = await request.text();
    const hash = crypto.createHmac("sha512", secret).update(bodyText).digest("hex");

    if (hash !== signature) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 400 });
    }

    try {
      const event = JSON.parse(bodyText);
      console.log("Paystack Event Received:", event.event);

      if (event.event === "charge.success") {
        const data = event.data;
        const invoiceId =
          data.metadata?.invoice_id ??
          data.metadata?.custom_fields?.find((f: any) => f.variable_name === "invoice_id")?.value;

        if (invoiceId) {
          const existingInvoice = await deps.db.query.invoice.findFirst({
            where: eq(deps.invoice.id, invoiceId),
          });

          if (existingInvoice) {
            if (existingInvoice.status !== "paid") {
              await deps.db
                .update(deps.invoice)
                .set({
                  status: "paid",
                  paidAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(deps.invoice.id, invoiceId));
            }

            const existingSubscription = await deps.db.query.subscription.findFirst({
              where: eq(deps.subscription.id, invoiceId),
            });

            if (existingSubscription) {
              await deps.db
                .update(deps.subscription)
                .set({
                  status: "active",
                  updatedAt: new Date(),
                  currentPeriodStart: new Date(),
                })
                .where(eq(deps.subscription.id, invoiceId));
            }

            await deps.upsertManualInvoiceLineSubscriptions({
              invoiceId,
              userId: existingInvoice.userId,
              billingPeriodStart: new Date(),
              billingPeriodEnd: existingInvoice.billingPeriodEnd,
              status: "active",
            });
            await deps.createAffiliateCommissionForPayment({
              invoiceId,
              customerId: existingInvoice.userId,
              amount: existingInvoice.amount,
              subscriptionId: existingSubscription?.id ?? invoiceId,
              paymentId: data.reference ?? invoiceId,
            });
            await deps.recordAudit({
              action: "subscription.activated",
              entityType: "subscription",
              entityId: invoiceId,
              message: `Subscription activated after Paystack payment for invoice ${invoiceId}`,
              metadata: { reference: data.reference, invoiceId },
            });
            const existingUser = await deps.db.query.user.findFirst({
              where: eq(deps.user.id, existingInvoice.userId),
            });
            if (existingUser?.email && existingSubscription) {
              Promise.resolve(
                deps.sendEmail({
                  template: "payment_received",
                  to: existingUser.email,
                  subject: `Payment received for ${existingSubscription.name}`,
                  data: {
                    firstName: existingUser.name,
                    productName: existingSubscription.name,
                    subscriptionName: existingSubscription.name,
                    totalDue: deps.formatEmailMoney(
                      existingInvoice.amount,
                      existingInvoice.currency ?? "ZAR",
                    ),
                    primaryCtaText: "Open dashboard",
                    primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
                  },
                  idempotencyKey: `payment:${invoiceId}:received`,
                }),
              ).catch((emailError) => {
                console.error("Failed to send payment received email", emailError);
              });
            }
            const paidDomainOrder = await deps.db.query.domainOrder.findFirst({
              where: eq(deps.domainOrder.invoiceId, invoiceId),
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
                console.error("Domain registration follow-up failed after payment", error);
              });
            }
            console.log(`Invoice ${invoiceId} marked as paid and subscription activated.`);
          }
        }

        const walletTopUp = await processPaystackTopUpWebhook(deps, {
          reference: String(data.reference ?? ""),
          metadata: data.metadata ?? {},
          amountTokens: Number(data.amount ?? 0),
        });
        if (walletTopUp.ok && !walletTopUp.skipped) {
          await deps.recordAudit({
            action: "wallet.topup.credited",
            entityType: "token_topup_intent",
            entityId: walletTopUp.intent.id,
            message: `Wallet top-up credited for Paystack reference ${data.reference}`,
            metadata: { reference: data.reference, amountTokens: walletTopUp.intent.amountTokens },
          });
        }
      }

      return new Response("Webhook received", { status: 200 });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response("Internal error", { status: 500 });
    }
  }

  async function handleDomainsCheck(request: Request): Promise<Response> {
    if (request.method !== "GET") return deps.json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim().toLowerCase();

    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain parameter is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parts = domain.split(".");
    const validLabel = (value: string) =>
      value.length > 0 && value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value);
    if (domain.length > 253 || parts.length < 2 || !parts.every(validLabel)) {
      return new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sld = parts[0];
    const tld = parts.slice(1).join(".");

    const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
    if (!apiKey || apiKey === "your_domains_co_za_key") {
      return deps.json({ error: "Domain availability is not configured" }, 503);
    }

    try {
      const response = await fetch(
        `https://api.domains.co.za/api/domain/check?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${encodeURIComponent(apiKey)}`,
      );

      if (!response.ok) {
        throw new Error(`Domains API error: ${response.status}`);
      }

      const data = await response.json();
      return deps.json(toPublicDomainAvailability(data, domain, sld, tld));
    } catch (error) {
      console.error("Domains API error:", error);
      return new Response(JSON.stringify({ error: "Failed to check domain" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  async function handleIntelligenceWebhook(request: Request): Promise<Response> {
    if (request.method !== "POST") return deps.json({ error: "Method not allowed" }, 405);
    if (!deps.verifyIntelligenceWebhook(request))
      return deps.json({ error: "Invalid webhook secret" }, 401);

    try {
      const body = await deps.parseBody(request, deps.intelligenceWebhookResultSchema);
      const result = await deps.persistIntelligenceWebhookResult(body);
      await deps.recordAudit({
        action: `intelligence.webhook.${body.status}`,
        entityType: "intelligence_job",
        entityId: body.jobId,
        message: `Competitor intelligence job ${body.status}`,
        metadata: { projectId: result.project.id, externalRunId: body.externalRunId },
      });
      return deps.json({ ok: true, ...result });
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  return {
    handleMailjetWebhook,
    handlePaystackWebhook,
    handleDomainsCheck,
    handleIntelligenceWebhook,
  };
}
