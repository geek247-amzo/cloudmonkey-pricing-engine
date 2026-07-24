/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from "drizzle-orm";
import { z } from "zod";

export type DomainRegistrationDeps = {
  db: any;
  makeId: (prefix: string) => string;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  registeredDomain: any;
  domainOrder: any;
  supportTicket: any;
};

export type DomainsDeps = DomainRegistrationDeps & {
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  initializePayment: (input: any) => Promise<any>;
  sendEmail: (input: any) => Promise<void> | void;
  formatEmailDate: (value: string | Date | null | undefined) => string;
  formatEmailMoney: (amount: number, currency?: string) => string;
  getWorkspaceSettings: () => Promise<any>;
  getWorkspaceBillingDetails: (settings: any) => any;
  servicePlan: any;
  invoice: any;
  invoiceItem: any;
  subscription: any;
  addMonths: (date: Date, months: number) => Date;
  normalizeMinimumTermMonths: (input: {
    minimumTermMonths?: number | string | null;
    minimumTerm?: string | null;
  }) => number | null;
};

const domainOrderSchema = z.object({
  domainName: z.string().min(3),
  domainPlanId: z.string().min(1),
  addonPlanIds: z.array(z.string().min(1)).optional().default([]),
});

const adminAssignDomainSchema = z.object({
  domainName: z.string().min(1),
  userId: z.string().min(1),
  status: z.string().optional().default("active"),
  expiryDate: z.union([z.string(), z.number(), z.date()]).optional().nullable(),
});

export function splitDomainName(domain: string) {
  const value = domain.trim().toLowerCase();
  const parts = value.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw Object.assign(new Error("Invalid domain format"), { status: 400 });
  }
  return { domain: value, sld: parts[0], tld: parts.slice(1).join(".") };
}

export function parseProviderDate(value: unknown) {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && value.trim() !== "") {
      return parseProviderDate(numericValue);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

export async function registerPaidDomainOrder(
  deps: DomainRegistrationDeps,
  order: any,
  requestUrl: string,
) {
  const domainName = order.domainName.toLowerCase();
  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  const registerUrl = process.env.DOMAINS_CO_ZA_REGISTER_URL;

  if (!apiKey || !registerUrl) {
    await createDomainRegistrationTicket(
      deps,
      order,
      "Domains API registration endpoint is not configured",
      requestUrl,
    );
    return;
  }

  try {
    const response = await fetch(registerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, domain: domainName, orderId: order.id }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Domains API returned ${response.status}: ${text}`);

    await deps.db.transaction(async (tx: any) => {
      await tx
        .insert(deps.registeredDomain)
        .values({
          id: domainName,
          userId: order.userId,
          status: "active",
          expiryDate: null,
        })
        .onConflictDoUpdate({
          target: deps.registeredDomain.id,
          set: {
            userId: order.userId,
            status: "active",
            updatedAt: new Date(),
          },
        });
      await tx
        .update(deps.domainOrder)
        .set({
          status: "registered",
          providerResponse: text,
          registeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(deps.domainOrder.id, order.id));
    });
  } catch (error: any) {
    await deps.db
      .update(deps.domainOrder)
      .set({
        status: "registration_failed",
        providerError: error.message,
        updatedAt: new Date(),
      })
      .where(eq(deps.domainOrder.id, order.id));
    await createDomainRegistrationTicket(deps, order, error.message, requestUrl);
  }
}

async function createDomainRegistrationTicket(
  deps: DomainRegistrationDeps,
  order: any,
  errorMessage: string,
  requestUrl: string,
) {
  const existing = await deps.db.query.supportTicket.findFirst({
    where: eq(deps.supportTicket.aiSessionId, `domain-order:${order.id}`),
  });
  if (existing) return existing;

  const [created] = await deps.db
    .insert(deps.supportTicket)
    .values({
      id: deps.makeId("ticket"),
      userId: order.userId,
      subject: `Domain registration follow-up: ${order.domainName}`,
      description: `Domain order ${order.id} was paid but needs manual registration follow-up.\n\n${errorMessage}`,
      priority: "high",
      status: "open",
      category: "domains",
      source: "system",
      aiSessionId: `domain-order:${order.id}`,
    })
    .returning();

  await deps.recordAudit({
    action: "domain.registration_followup.created",
    entityType: "domain_order",
    entityId: order.id,
    message: `Domain registration follow-up created for ${order.domainName}`,
    level: "warning",
    metadata: { ticketId: created.id, error: errorMessage, url: requestUrl },
  });
  return created;
}

function domainOrderSummaryLabel(domainName: string, planName: string) {
  return `Domain registration: ${domainName} (${planName})`;
}

export function createDomainsHandlers(deps: DomainsDeps) {
  async function handleUserDomainOrders(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    if (request.method === "GET") {
      const rows = await deps.db.query.domainOrder.findMany({
        where: eq(deps.domainOrder.userId, session.user.id),
        with: { invoice: true, subscription: true, plan: true },
        orderBy: (domainOrder: any, { desc }: any) => [desc(domainOrder.createdAt)],
      });
      return deps.json(rows);
    }

    if (request.method === "POST") {
      try {
        const body = await deps.parseBody(request, domainOrderSchema);
        const domainName = body.domainName.trim().toLowerCase();
        const email = session.user.email ?? "";
        if (!email) return deps.json({ error: "User email is required for checkout" }, 400);

        const domainPlan = await deps.db.query.servicePlan.findFirst({
          where: eq(deps.servicePlan.id, body.domainPlanId),
          with: { service: true },
        });
        if (!domainPlan || domainPlan.service?.id !== "domains") {
          return deps.json({ error: "Valid domain plan is required" }, 400);
        }

        const addonPlans = [] as Array<any>;
        for (const planId of body.addonPlanIds ?? []) {
          const plan = await deps.db.query.servicePlan.findFirst({
            where: eq(deps.servicePlan.id, planId),
            with: { service: true },
          });
          if (plan) addonPlans.push(plan);
        }

        const domainAmount = Number.parseInt(domainPlan.priceZar ?? "0", 10);
        const domainMinimumTermMonths = deps.normalizeMinimumTermMonths(domainPlan);
        const addonAmount = addonPlans.reduce(
          (total, plan) => total + Number.parseInt(plan.priceZar ?? "0", 10),
          0,
        );
        const amount = domainAmount + addonAmount;
        if (amount <= 0)
          return deps.json({ error: "Domain checkout requires a payable price" }, 400);

        const invoiceId = deps.makeId("inv");
        const subscriptionId = invoiceId;
        const orderId = deps.makeId("domainorder");
        const issuedAt = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const billingPeriodEnd = new Date(issuedAt);
        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
        const settings = await deps.getWorkspaceSettings();
        const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId
          .replace(/^inv[_-]?/i, "")
          .replace(/[^a-z0-9]/gi, "")
          .slice(-6)
          .toUpperCase()}`;
        const name = domainOrderSummaryLabel(domainName, domainPlan.name);
        const callbackUrl = `${new URL(request.url).origin}/dashboard/domains/new?payment=return&subscription=${encodeURIComponent(subscriptionId)}&domainOrder=${encodeURIComponent(orderId)}`;

        await deps.db.transaction(async (tx: any) => {
          await tx.insert(deps.invoice).values({
            id: invoiceId,
            userId: session.user.id,
            invoiceNumber,
            invoiceSource: "domain",
            amount,
            status: "pending",
            dueDate,
            issuedAt,
            billingPeriodStart: issuedAt,
            billingPeriodEnd,
            currency: "ZAR",
            vatRateBps: 0,
            customerName: session.user.name ?? null,
            customerEmail: email,
            workspaceBillingSnapshot: JSON.stringify(deps.getWorkspaceBillingDetails(settings)),
            notes: settings?.billingInvoiceNotes ?? null,
          });
          await tx.insert(deps.subscription).values({
            id: subscriptionId,
            userId: session.user.id,
            planId: domainPlan.id,
            name,
            status: "pending",
            amount,
            interval: "year",
            minimumTermMonths: domainMinimumTermMonths,
            minimumTermEndsAt: domainMinimumTermMonths
              ? deps.addMonths(issuedAt, domainMinimumTermMonths)
              : null,
            currentPeriodStart: issuedAt,
            currentPeriodEnd: billingPeriodEnd,
          });
          await tx.insert(deps.invoiceItem).values({
            id: deps.makeId("invitem"),
            invoiceId,
            description: `${domainName} - ${domainPlan.name}`,
            quantity: 1,
            unitPrice: domainAmount,
            amount: domainAmount,
          });
          for (const plan of addonPlans) {
            const planAmount = Number.parseInt(plan.priceZar ?? "0", 10);
            await tx.insert(deps.invoiceItem).values({
              id: deps.makeId("invitem"),
              invoiceId,
              description: `${plan.service?.name ?? "Service"} - ${plan.name}`,
              quantity: 1,
              unitPrice: planAmount,
              amount: planAmount,
            });
          }
          await tx.insert(deps.domainOrder).values({
            id: orderId,
            userId: session.user.id,
            domainName,
            domainPlanId: domainPlan.id,
            addonPlanIds: JSON.stringify(addonPlans.map((plan) => plan.id)),
            invoiceId,
            subscriptionId,
            status: "pending_payment",
          });
        });

        let payment: Awaited<ReturnType<typeof deps.initializePayment>>;
        try {
          payment = await deps.initializePayment({
            email,
            amountCents: amount,
            invoiceId,
            subscriptionId,
            userId: session.user.id,
            planId: domainPlan.id,
            callbackUrl,
          });
        } catch (error) {
          await deps.db
            .update(deps.invoice)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(deps.invoice.id, invoiceId));
          await deps.db
            .update(deps.subscription)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(deps.subscription.id, subscriptionId));
          await deps.db
            .update(deps.domainOrder)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(deps.domainOrder.id, orderId));
          throw error;
        }

        const [updatedInvoice] = await deps.db
          .update(deps.invoice)
          .set({
            paystackReference: payment.data.reference,
            paystackUrl: payment.data.authorization_url,
            updatedAt: new Date(),
          })
          .where(eq(deps.invoice.id, invoiceId))
          .returning();

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "domain_order.checkout.started",
          entityType: "domain_order",
          entityId: orderId,
          message: `Domain checkout started for ${domainName}`,
          metadata: {
            invoiceId,
            reference: payment.data.reference,
            addonPlanIds: addonPlans.map((plan) => plan.id),
          },
        });

        Promise.resolve(
          deps.sendEmail({
            template: "invoice_created",
            to: email,
            subject: `CloudMonkey invoice ${updatedInvoice.invoiceNumber ?? updatedInvoice.id}`,
            data: {
              firstName: session.user.name,
              customerName: session.user.name,
              invoiceId,
              invoiceNumber: updatedInvoice.invoiceNumber ?? invoiceId,
              productName: name,
              subscriptionName: name,
              totalDue: deps.formatEmailMoney(
                updatedInvoice.amount,
                updatedInvoice.currency ?? "ZAR",
              ),
              dueDate: deps.formatEmailDate(updatedInvoice.dueDate),
              primaryCtaText: "View invoice",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`,
            },
            idempotencyKey: `domain-order:${orderId}:invoice`,
          }),
        ).catch((error) => console.error("Domain invoice email failed:", error));

        return deps.json(
          {
            order: await deps.db.query.domainOrder.findFirst({
              where: eq(deps.domainOrder.id, orderId),
            }),
            invoice: updatedInvoice,
            subscriptionId,
            authorization_url: payment.data.authorization_url,
            access_code: payment.data.access_code,
            reference: payment.data.reference,
          },
          201,
        );
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleUserDomainsDns(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const domainName = url.searchParams.get("domain");
    if (!domainName) return deps.json({ error: "Domain required" }, 400);

    const ownership = await deps.db.query.registeredDomain.findFirst({
      where: eq(deps.registeredDomain.id, domainName),
    });

    if (!ownership || (ownership.userId !== session.user.id && session.user.role !== "admin")) {
      return deps.json({ error: "Forbidden" }, 403);
    }

    const parts = splitDomainName(domainName);
    const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;

    if (request.method === "GET") {
      try {
        const response = await fetch(
          `https://api.domains.co.za/api/domain/dns?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&key=${apiKey}`,
        );
        const data = await response.json();
        return deps.json(data);
      } catch (error) {
        return deps.json({ error: "Failed to fetch DNS" }, 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const response = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sld: parts.sld, tld: parts.tld, ...body }),
          },
        );
        const data = await response.json();
        return deps.json(data);
      } catch (error) {
        return deps.json({ error: "Failed to add record" }, 500);
      }
    }

    if (request.method === "DELETE") {
      const dnsId = url.searchParams.get("dnsId");
      try {
        const response = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&dnsId=${encodeURIComponent(dnsId ?? "")}&key=${apiKey}`,
          {
            method: "DELETE",
          },
        );
        const data = await response.json();
        return deps.json(data);
      } catch (error) {
        return deps.json({ error: "Failed to delete record" }, 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleUserDomainsInfo(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const domainName = url.searchParams.get("domain");
    if (!domainName) return deps.json({ error: "Domain required" }, 400);

    const ownership = await deps.db.query.registeredDomain.findFirst({
      where: eq(deps.registeredDomain.id, domainName),
    });

    if (!ownership || (ownership.userId !== session.user.id && session.user.role !== "admin")) {
      return deps.json({ error: "Forbidden" }, 403);
    }

    const parts = splitDomainName(domainName);
    const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;

    try {
      const response = await fetch(
        `https://api.domains.co.za/api/domain/info?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&key=${apiKey}`,
      );
      const data = await response.json();
      return deps.json(data);
    } catch (error) {
      return deps.json({ error: "Failed to fetch domain info" }, 500);
    }
  }

  async function handleUserDomains(request: Request): Promise<Response> {
    const { session, response } = await deps.requireSession(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const domains = await deps.db.query.registeredDomain.findMany({
      where: eq(deps.registeredDomain.userId, session.user.id),
    });
    return deps.json(domains);
  }

  async function handleAdminAssignDomain(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    try {
      const body = await deps.parseBody(request, adminAssignDomainSchema);
      const expiryDate = parseProviderDate(body.expiryDate);
      await deps.db
        .insert(deps.registeredDomain)
        .values({
          id: body.domainName,
          userId: body.userId,
          status: body.status || "active",
          expiryDate: expiryDate ? new Date(expiryDate) : null,
        })
        .onConflictDoUpdate({
          target: deps.registeredDomain.id,
          set: {
            userId: body.userId,
            status: body.status || "active",
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            updatedAt: new Date(),
          },
        });
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "domain.assigned",
        entityType: "registered_domain",
        entityId: body.domainName,
        message: `Domain assigned: ${body.domainName}`,
        metadata: { userId: body.userId },
      });
      return deps.json({ success: true });
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }

  async function handleAdminDomainsDns(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const domainName = url.searchParams.get("domain");
    if (!domainName) return deps.json({ error: "Domain required" }, 400);
    const parts = splitDomainName(domainName);
    const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
    if (!apiKey) return deps.json({ error: "Domains API is not configured" }, 503);

    try {
      if (request.method === "GET") {
        const providerResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&key=${apiKey}`,
        );
        const data = await providerResponse.json();
        return deps.json(data, providerResponse.status);
      }

      if (request.method === "POST") {
        const body = await request.json();
        const providerResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sld: parts.sld, tld: parts.tld, ...body }),
          },
        );
        const data = await providerResponse.json();
        if (providerResponse.ok) {
          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "copilot.domain.dns_created",
            entityType: "registered_domain",
            entityId: parts.domain,
            message: `Admin API added a DNS record for ${parts.domain}`,
            metadata: { source: "cloudmonkey_api" },
          });
        }
        return deps.json(data, providerResponse.status);
      }

      if (request.method === "DELETE") {
        const dnsId = url.searchParams.get("dnsId");
        if (!dnsId) return deps.json({ error: "dnsId is required" }, 400);
        const providerResponse = await fetch(
          `https://api.domains.co.za/api/domain/dns/entry?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&dnsId=${encodeURIComponent(dnsId)}&key=${apiKey}`,
          { method: "DELETE" },
        );
        const data = await providerResponse.json();
        if (providerResponse.ok) {
          await deps.recordAudit({
            actorUserId: session.user.id,
            action: "copilot.domain.dns_deleted",
            entityType: "registered_domain",
            entityId: parts.domain,
            message: `Admin API deleted DNS record ${dnsId} for ${parts.domain}`,
            metadata: { source: "cloudmonkey_api", dnsId },
          });
        }
        return deps.json(data, providerResponse.status);
      }

      return deps.json({ error: "Method not allowed" }, 405);
    } catch (error: any) {
      return deps.json({ error: error.message ?? "Domains API request failed" }, 502);
    }
  }

  async function handleAdminDomainsInfo(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (!session) return deps.json({ error: "Unauthorized" }, 401);
    if (request.method !== "GET") return deps.json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const domainName = url.searchParams.get("domain");
    if (!domainName) return deps.json({ error: "Domain required" }, 400);
    const parts = splitDomainName(domainName);
    const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
    if (!apiKey) return deps.json({ error: "Domains API is not configured" }, 503);

    try {
      const providerResponse = await fetch(
        `https://api.domains.co.za/api/domain/info?sld=${encodeURIComponent(parts.sld)}&tld=${encodeURIComponent(parts.tld)}&key=${apiKey}`,
      );
      return deps.json(await providerResponse.json(), providerResponse.status);
    } catch (error: any) {
      return deps.json({ error: error.message ?? "Domains API request failed" }, 502);
    }
  }

  return {
    handleUserDomainOrders,
    handleUserDomainsDns,
    handleUserDomainsInfo,
    handleUserDomains,
    handleAdminAssignDomain,
    handleAdminDomainsDns,
    handleAdminDomainsInfo,
  };
}
