/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { extractAiResponseText, unwrapAiResponseEnvelope } from "../ai-response";
import {
  BUNDLES,
  CATEGORIES,
  PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY,
  PROPOSAL_DEFAULT_INTRODUCTION,
  buildProposalTerms,
} from "../pricing";
import { listPlans } from "../vultr";
import {
  account,
  affiliate,
  affiliateCommission,
  affiliateFraudFlag,
  affiliatePayout,
  affiliateReferral,
  aiAgent,
  auditLog,
  bundle,
  bundleFeature,
  caesarChatMessage,
  caesarChatSession,
  domainOrder,
  invoice,
  invoiceItem,
  invoicePayment,
  lead,
  microsoft365Tenant,
  microsoft365TenantScan,
  platformApiCredential,
  platformApiUsage,
  pitchDeck,
  pitchDeckAudio,
  project,
  projectMilestone,
  projectTask,
  projectDeliverable,
  proposal,
  proposalItem,
  registeredDomain,
  service,
  serviceCategory,
  serviceFeature,
  servicePlan,
  serverContainer,
  serverDatabase,
  serverN8nIntegration,
  serverN8nWorkflow,
  serverSecurityFinding,
  serverTelemetrySnapshot,
  session as sessionTable,
  subscription,
  supportTicket,
  supportTicketComment,
  tokenTopupIntent,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  twoFactor,
  user,
  vultrInstance,
  website,
  websiteApprovalToken,
  websiteDesignOption,
  websiteDomain,
  websitePluginInstall,
  websiteReviewRequest,
  websiteStore,
  websiteStoreDatabase,
  workspaceSettings,
  adminChatMessage,
} from "../../db/schema";
import { STI_ELECTRICAL_PHASE_2_DECK, STI_RISK_PRODUCT_PROPOSAL_DECK } from "../pitch-deck-content";
import { PLATFORM_CREDENTIAL_STATUSES, PLATFORM_PROVIDERS } from "../platform-usage";

function toCentsFromZarInput(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100).toString();
}

function formatEmailMoney(cents: number, currency = "ZAR") {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type AdminDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  sendEmail: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  encryptSecret: (value: string) => string;
  decryptSecret: (value: string) => string;
  getWorkspaceSettings: () => Promise<any>;
  getWorkspaceBillingDetails: (settings: any) => any;
  getSupportCrmContext: (userId: string) => Promise<any>;
  getAdminServerStatus: () => Promise<any>;
  getAdminWebsiteHealth: () => Promise<any>;
  resolveAdminChatSession: (userId: string, requestedSessionId?: string | null) => Promise<any>;
  loadAdminChatHistory: (sessionId: string, limit?: number) => Promise<any[]>;
  sendN8nAdminChat: (input: any) => Promise<any>;
  generateGeminiText: (prompt: string, systemInstruction?: string) => Promise<string>;
  generateGeminiSpeech: (input: {
    text: string;
    voice?: string;
  }) => Promise<{ audioData: string; mimeType: string; model: string; voice: string }>;
  sanitizeN8nIntegration: (row: any) => any;
  syncN8nWorkflows: (integration: any) => Promise<any>;
  signMicrosoft365State: (input: { userId: string; returnTo: string }) => string;
  verifyMicrosoft365State: (
    value: string | null,
    userId: string,
  ) => { userId: string; returnTo?: string; ts: number };
  microsoft365ClientConfig: () => { clientId: string; clientSecret: string };
  microsoft365Scopes: () => string;
  exchangeMicrosoft365Code: (input: { code: string; redirectUri: string }) => Promise<{
    access_token: string;
    refresh_token: string;
    scope?: string;
  }>;
  syncMicrosoft365Tenant: (row: any) => Promise<any>;
  microsoft365RedirectUri: (request: Request) => string;
  adminChatMessage?: any;
};

const adminUserUpdateSchema = z.object({
  whatsapp: z.string().max(80).optional().nullable(),
});

const roleUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "support", "finance", "customer"]),
});

const ticketUpdateSchema = z
  .object({
    subject: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    category: z.string().min(1).optional(),
    assignedToUserId: z.string().optional().nullable(),
    resolutionSummary: z.string().optional().nullable(),
  })
  .strict();

const adminChatSchema = z.object({
  sessionId: z.string().optional().nullable(),
  message: z.string().min(1, "Message is required"),
  contextType: z.string().optional().nullable(),
  contextId: z.string().optional().nullable(),
  conversationHistory: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  proactive: z.boolean().optional().default(false),
  customerUserId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
});

const ticketAiInstructionSchema = z.object({
  instruction: z.string().trim().min(3).max(4000),
});

function buildTicketAiDatabaseContext(context: any) {
  const rows = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    invoices: rows(context?.invoices)
      .slice(0, 10)
      .map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        dueDate: row.dueDate,
        collectionStatus: row.collectionStatus,
      })),
    subscriptions: rows(context?.subscriptions)
      .slice(0, 20)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        amount: row.amount,
        interval: row.interval,
        currentPeriodEnd: row.currentPeriodEnd,
        agreementSigned: row.agreementSigned,
      })),
    domains: rows(context?.domains)
      .slice(0, 20)
      .map((row: any) => ({
        domain: row.id,
        status: row.status,
        expiryDate: row.expiryDate,
        autoRenew: row.autoRenew,
      })),
    websites: rows(context?.websites)
      .slice(0, 20)
      .map((row: any) => ({
        id: row.id,
        domain: row.domain,
        name: row.name,
        plan: row.plan,
        status: row.status,
        aiGenerationStatus: row.aiGenerationStatus,
        containerStatus: row.containerStatus,
      })),
    servers: rows(context?.servers)
      .slice(0, 20)
      .map((row: any) => ({
        id: row.id,
        label: row.label,
        status: row.status,
        powerStatus: row.powerStatus,
        region: row.region,
        suspendedAt: row.suspendedAt,
        suspensionReason: row.suspensionReason,
      })),
    recentTickets: rows(context?.tickets)
      .slice(0, 10)
      .map((row: any) => ({
        id: row.id,
        subject: row.subject,
        category: row.category,
        priority: row.priority,
        status: row.status,
        resolutionSummary: row.resolutionSummary,
        updatedAt: row.updatedAt,
      })),
    salesContext: context?.caesar ?? null,
  };
}

export function normalizeTicketAiSummary(response: any) {
  return extractAiResponseText(response, "No AI summary was returned for this ticket.");
}

export function normalizeTicketAiOutcome(response: any) {
  const normalized = unwrapAiResponseEnvelope(response) as any;
  const body = extractAiResponseText(
    normalized,
    "The AI agent completed the instruction without returning additional feedback.",
  );
  const makePublic =
    normalized?.makePublic === true ||
    normalized?.visibility === "public" ||
    normalized?.noteVisibility === "public";
  const requestedStatus = String(normalized?.ticketStatus ?? "").toLowerCase();
  const ticketStatus = ["open", "pending", "resolved", "closed"].includes(requestedStatus)
    ? requestedStatus
    : null;
  return { body, makePublic, ticketStatus };
}

const adminProposalGenerateSchema = z.object({
  leadName: z.string().optional().nullable(),
  leadCompany: z.string().optional().nullable(),
  services: z.array(z.string()).optional().default([]),
  type: z.enum(["introduction", "executiveSummary", "terms"]),
  customContext: z.string().optional().nullable(),
});

const settingsSchema = z.object({
  workspaceName: z.string().min(1),
  adminNotificationEmail: z.string().email().optional().nullable(),
  securityContactEmail: z.string().email().optional().nullable(),
  billingLegalName: z.string().optional().nullable(),
  billingEmail: z.string().email().optional().nullable(),
  billingPhone: z.string().optional().nullable(),
  billingWebsite: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  billingRegistrationNumber: z.string().optional().nullable(),
  billingVatNumber: z.string().optional().nullable(),
  billingBankName: z.string().optional().nullable(),
  billingBankAccountName: z.string().optional().nullable(),
  billingBankAccountNumber: z.string().optional().nullable(),
  billingBankBranchCode: z.string().optional().nullable(),
  billingInvoiceNotes: z.string().optional().nullable(),
  defaultTicketPriority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  allowCustomerTicketCreation: z.boolean().default(true),
});

const serverN8nSchema = z.object({
  instanceId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

const proposalLineSchema = z.object({
  name: z.string().min(1).optional().nullable(),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  setupPrice: z.coerce.number().nonnegative().optional().default(0),
  recurringPrice: z.coerce.number().nonnegative().optional().default(0),
  billingFrequency: z.enum(["month", "year", "once_off"]).default("month"),
  productId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
  productType: z.enum(["plan", "bundle", "custom"]).optional(),
  recurring: z.boolean().optional(),
  interval: z.enum(["month", "year"]).optional(),
});

const proposalCreateSchema = z.object({
  leadId: z.string().optional().nullable(),
  lead: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      company: z.string().optional().nullable(),
    })
    .optional(),
  title: z.string().min(1).default("CloudMonkey Managed Services Proposal"),
  introduction: z.string().optional().nullable(),
  executiveSummary: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  items: z.array(proposalLineSchema).min(1),
});

function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function money(cents: number | null | undefined) {
  return Number.isFinite(cents ?? NaN) ? Math.round((cents ?? 0) / 100) : 0;
}

function toCents(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function normalizeUserSummary(rows: {
  domains?: any[];
  servers?: any[];
  websites?: any[];
  agents?: any[];
  tickets?: any[];
  subscriptions?: any[];
  invoices?: any[];
}) {
  const domains = Array.isArray(rows?.domains) ? rows.domains : [];
  const servers = Array.isArray(rows?.servers) ? rows.servers : [];
  const websites = Array.isArray(rows?.websites) ? rows.websites : [];
  const agents = Array.isArray(rows?.agents) ? rows.agents : [];
  const tickets = Array.isArray(rows?.tickets) ? rows.tickets : [];
  const subscriptions = Array.isArray(rows?.subscriptions) ? rows.subscriptions : [];
  const invoices = Array.isArray(rows?.invoices) ? rows.invoices : [];

  const activeServices =
    domains.filter((row) => row.status === "active").length +
    servers.filter((row) => ["active", "running", "online"].includes(String(row.status))).length +
    websites.filter((row) => ["online", "live", "running"].includes(String(row.status))).length +
    agents.filter((row) => row.status === "active").length +
    subscriptions.filter((row) => row.status === "active" || row.status === "trialing").length;

  const problemServices =
    servers.filter((row) => ["error", "failed", "suspended"].includes(String(row.status))).length +
    websites.filter((row) => ["offline", "maintenance", "failed"].includes(String(row.status)))
      .length;

  const unpaidInvoices = invoices.filter((row) => !["paid", "void"].includes(String(row.status)));
  return {
    totalServices:
      domains.length + servers.length + websites.length + agents.length + subscriptions.length,
    activeServices,
    problemServices,
    openTickets: tickets.filter((row) => !["resolved", "closed"].includes(String(row.status)))
      .length,
    billingStatus: unpaidInvoices.length ? "pending" : "current",
    unpaidInvoiceCount: unpaidInvoices.length,
    unpaidInvoiceAmount: unpaidInvoices.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  };
}

function servicePlanRow(plan: any, serviceRow: any, categoryRow: any, features: any[]) {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    priceZar: plan.priceZar,
    setupPriceZar: plan.setupPriceZar,
    unit: plan.unit,
    billingFrequency: plan.billingFrequency,
    minimumTerm: plan.minimumTerm,
    minimumTermMonths: plan.minimumTermMonths,
    billingType: plan.billingType,
    priceLabel: plan.priceLabel,
    isBundle: plan.isBundle,
    sortOrder: plan.sortOrder,
    serviceNote: plan.serviceNote,
    active: plan.active,
    trialDays: plan.trialDays,
    highlighted: plan.highlighted,
    badge: plan.badge,
    serviceDefinition: safeJsonParse(plan.serviceDefinition),
    agreementTemplateId: plan.agreementTemplateId,
    features,
    service: {
      id: serviceRow.id,
      name: serviceRow.name,
      categoryId: categoryRow.id,
      category: {
        id: categoryRow.id,
        name: categoryRow.name,
      },
    },
  };
}

function bundleRow(row: any, features: any[]) {
  return {
    id: row.id,
    name: row.name,
    priceZar: row.priceZar,
    setupPriceZar: row.setupPriceZar,
    unit: row.unit,
    billingFrequency: row.billingFrequency,
    minimumTerm: row.minimumTerm,
    minimumTermMonths: row.minimumTermMonths,
    billingType: row.billingType,
    priceLabel: row.priceLabel,
    isBundle: row.isBundle,
    sortOrder: row.sortOrder,
    categoryNote: row.categoryNote,
    serviceNote: row.serviceNote,
    active: row.active,
    highlighted: row.highlighted,
    badge: row.badge,
    serviceDefinition: safeJsonParse(row.serviceDefinition),
    agreementTemplateId: row.agreementTemplateId,
    features,
    service: {
      id: "bundle",
      name: "Bundle",
      categoryId: "quote-services",
    },
  };
}

export function createAdminHandlers(deps: AdminDeps) {
  async function handleAdminUsers(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const userId = parts[3];
    const isRoleUpdate =
      url.pathname.startsWith("/api/admin/users/role") && request.method === "PUT";
    const isList =
      url.pathname.startsWith("/api/admin/users") && request.method === "GET" && !userId;
    const isDetail =
      url.pathname.startsWith("/api/admin/users/") && request.method === "GET" && !!userId;
    const isUpdate =
      url.pathname.startsWith("/api/admin/users/") &&
      request.method === "PUT" &&
      !url.pathname.endsWith("/role");
    const isDelete = url.pathname.startsWith("/api/admin/users/") && request.method === "DELETE";

    if (isList) {
      const users = await deps.db.query.user.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
      });
      return deps.json(users);
    }

    if (isDetail) {
      const row = await deps.db.query.user.findFirst({ where: eq(user.id, userId) });
      if (!row) return deps.json({ error: "User not found" }, 404);
      const [
        sessions,
        accounts,
        domains,
        servers,
        websites,
        agents,
        tickets,
        subscriptions,
        invoices,
      ] = await Promise.all([
        deps.db.query.session.findMany({ where: eq(sessionTable.userId, userId) }),
        deps.db.query.account.findMany({ where: eq(account.userId, userId) }),
        deps.db.query.registeredDomain.findMany({ where: eq(registeredDomain.userId, userId) }),
        deps.db.query.vultrInstance.findMany({ where: eq(vultrInstance.userId, userId) }),
        deps.db.query.website.findMany({ where: eq(website.userId, userId) }),
        deps.db.query.aiAgent.findMany({ where: eq(aiAgent.userId, userId) }),
        deps.db.query.supportTicket.findMany({ where: eq(supportTicket.userId, userId) }),
        deps.db.query.subscription.findMany({ where: eq(subscription.userId, userId) }),
        deps.db.query.invoice.findMany({
          where: eq(invoice.userId, userId),
          orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
        }),
      ]);
      return deps.json({
        user: row,
        sessions,
        accounts,
        domains,
        servers,
        websites,
        agents,
        tickets,
        subscriptions,
        invoices,
      });
    }

    if (isUpdate) {
      if (!userId) return deps.json({ error: "User not found" }, 404);
      try {
        const body = await deps.parseBody(request, adminUserUpdateSchema);
        const [updated] = await deps.db
          .update(user)
          .set({ whatsapp: body.whatsapp ?? null, updatedAt: new Date() })
          .where(eq(user.id, userId))
          .returning();
        if (!updated) return deps.json({ error: "User not found" }, 404);
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "user.whatsapp.updated",
          entityType: "user",
          entityId: updated.id,
          message: `${updated.email} WhatsApp updated`,
          metadata: { whatsapp: updated.whatsapp ?? null },
        });
        return deps.json(updated);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (isRoleUpdate) {
      try {
        const body = await deps.parseBody(request, roleUpdateSchema);
        const [updated] = await deps.db
          .update(user)
          .set({ role: body.role, updatedAt: new Date() })
          .where(eq(user.id, body.userId))
          .returning();
        if (!updated) return deps.json({ error: "User not found" }, 404);
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "user.role.updated",
          entityType: "user",
          entityId: updated.id,
          message: `${updated.email} role changed to ${updated.role}`,
        });
        return deps.json(updated);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (isDelete) {
      const deleteId = userId;
      if (!deleteId) return deps.json({ error: "User ID is required" }, 400);
      if (deleteId === session.user.id) {
        return deps.json({ error: "You cannot delete your own administrative account" }, 400);
      }

      try {
        await deps.db.transaction(async (tx: any) => {
          const ownedLeads = await tx
            .select({ id: lead.id })
            .from(lead)
            .where(eq(lead.userId, deleteId));
          const ownedLeadIds = ownedLeads.map((row: any) => row.id);

          const ownedProposals = await tx
            .select({ id: proposal.id })
            .from(proposal)
            .where(
              ownedLeadIds.length > 0
                ? or(eq(proposal.customerUserId, deleteId), inArray(proposal.leadId, ownedLeadIds))
                : eq(proposal.customerUserId, deleteId),
            );
          const ownedProposalIds = ownedProposals.map((row: any) => row.id);
          if (ownedProposalIds.length > 0) {
            await tx.delete(proposalItem).where(inArray(proposalItem.proposalId, ownedProposalIds));
            await tx.delete(proposal).where(inArray(proposal.id, ownedProposalIds));
          }
          await tx
            .update(proposal)
            .set({ createdByUserId: null })
            .where(eq(proposal.createdByUserId, deleteId));

          const caesarSessions = await tx
            .select({ id: caesarChatSession.id })
            .from(caesarChatSession)
            .where(
              ownedLeadIds.length > 0
                ? or(
                    eq(caesarChatSession.userId, deleteId),
                    inArray(caesarChatSession.leadId, ownedLeadIds),
                  )
                : eq(caesarChatSession.userId, deleteId),
            );
          const caesarSessionIds = caesarSessions.map((row: any) => row.id);
          if (caesarSessionIds.length > 0) {
            await tx
              .delete(caesarChatMessage)
              .where(inArray(caesarChatMessage.sessionId, caesarSessionIds));
            await tx
              .delete(caesarChatSession)
              .where(inArray(caesarChatSession.id, caesarSessionIds));
          }

          const affiliateRows = await tx
            .select({ id: affiliate.id })
            .from(affiliate)
            .where(eq(affiliate.userId, deleteId));
          const affiliateIds = affiliateRows.map((row: any) => row.id);
          if (affiliateIds.length > 0) {
            await tx
              .delete(affiliateCommission)
              .where(inArray(affiliateCommission.affiliateId, affiliateIds));
            await tx
              .delete(affiliateFraudFlag)
              .where(inArray(affiliateFraudFlag.affiliateId, affiliateIds));
            await tx
              .delete(affiliateReferral)
              .where(inArray(affiliateReferral.affiliateId, affiliateIds));
            await tx
              .delete(affiliatePayout)
              .where(inArray(affiliatePayout.affiliateId, affiliateIds));
            await tx.delete(affiliate).where(eq(affiliate.userId, deleteId));
          }
          const customerReferrals = await tx
            .select({ id: affiliateReferral.id })
            .from(affiliateReferral)
            .where(eq(affiliateReferral.customerId, deleteId));
          const customerReferralIds = customerReferrals.map((row: any) => row.id);
          await tx.delete(affiliateCommission).where(eq(affiliateCommission.customerId, deleteId));
          await tx.delete(affiliateFraudFlag).where(eq(affiliateFraudFlag.customerId, deleteId));
          if (customerReferralIds.length > 0) {
            await tx
              .delete(affiliateCommission)
              .where(inArray(affiliateCommission.referralId, customerReferralIds));
            await tx
              .delete(affiliateFraudFlag)
              .where(inArray(affiliateFraudFlag.referralId, customerReferralIds));
            await tx
              .delete(affiliateReferral)
              .where(inArray(affiliateReferral.id, customerReferralIds));
          }
          if (ownedLeadIds.length > 0) {
            await tx
              .delete(affiliateReferral)
              .where(inArray(affiliateReferral.leadId, ownedLeadIds));
          }

          const tickets = await tx
            .select({ id: supportTicket.id })
            .from(supportTicket)
            .where(eq(supportTicket.userId, deleteId));
          const ticketIds = tickets.map((row: any) => row.id);
          if (ticketIds.length > 0) {
            await tx
              .delete(supportTicketComment)
              .where(inArray(supportTicketComment.ticketId, ticketIds));
            await tx.delete(supportTicket).where(eq(supportTicket.userId, deleteId));
          }

          const websites = await tx
            .select({ id: website.id })
            .from(website)
            .where(eq(website.userId, deleteId));
          const websiteIds = websites.map((row: any) => row.id);
          if (websiteIds.length > 0) {
            await tx.delete(websiteDomain).where(inArray(websiteDomain.websiteId, websiteIds));
            await tx
              .delete(websiteDesignOption)
              .where(inArray(websiteDesignOption.websiteId, websiteIds));
            await tx
              .delete(websitePluginInstall)
              .where(inArray(websitePluginInstall.websiteId, websiteIds));
            await tx
              .delete(websiteReviewRequest)
              .where(inArray(websiteReviewRequest.websiteId, websiteIds));
            await tx
              .delete(websiteApprovalToken)
              .where(inArray(websiteApprovalToken.websiteId, websiteIds));
            const stores = await tx
              .select({ id: websiteStore.id })
              .from(websiteStore)
              .where(inArray(websiteStore.websiteId, websiteIds));
            const storeIds = stores.map((row: any) => row.id);
            if (storeIds.length > 0) {
              const orders = await tx
                .select({ id: invoice.id })
                .from(invoice)
                .where(eq(invoice.userId, deleteId));
              const orderIds = orders.map((row: any) => row.id);
              if (orderIds.length > 0) {
                await tx.delete(invoiceItem).where(inArray(invoiceItem.invoiceId, orderIds));
                await tx.delete(invoicePayment).where(inArray(invoicePayment.invoiceId, orderIds));
              }
              await tx
                .delete(websiteStoreDatabase)
                .where(inArray(websiteStoreDatabase.storeId, storeIds));
              await tx.delete(websiteStore).where(inArray(websiteStore.websiteId, websiteIds));
            }
            await tx.delete(website).where(eq(website.userId, deleteId));
          }

          const userInvoices = await tx
            .select({ id: invoice.id })
            .from(invoice)
            .where(eq(invoice.userId, deleteId));
          const invoiceIds = userInvoices.map((row: any) => row.id);
          if (invoiceIds.length > 0) {
            await tx
              .delete(affiliateCommission)
              .where(inArray(affiliateCommission.invoiceId, invoiceIds));
            await tx
              .update(proposal)
              .set({ invoiceId: null })
              .where(inArray(proposal.invoiceId, invoiceIds));
            await tx.delete(invoiceItem).where(inArray(invoiceItem.invoiceId, invoiceIds));
            await tx.delete(invoicePayment).where(inArray(invoicePayment.invoiceId, invoiceIds));
            await tx.delete(invoice).where(eq(invoice.userId, deleteId));
          }

          await tx.delete(serverContainer).where(eq(serverContainer.userId, deleteId));
          await tx.delete(serverDatabase).where(eq(serverDatabase.userId, deleteId));
          await tx.delete(serverSecurityFinding).where(eq(serverSecurityFinding.userId, deleteId));
          await tx
            .delete(serverTelemetrySnapshot)
            .where(eq(serverTelemetrySnapshot.userId, deleteId));
          await tx.delete(subscription).where(eq(subscription.userId, deleteId));
          await tx.delete(registeredDomain).where(eq(registeredDomain.userId, deleteId));
          await tx.delete(domainOrder).where(eq(domainOrder.userId, deleteId));
          await tx.delete(vultrInstance).where(eq(vultrInstance.userId, deleteId));
          await tx.delete(aiAgent).where(eq(aiAgent.userId, deleteId));
          if (ownedLeadIds.length > 0) {
            await tx.delete(lead).where(inArray(lead.id, ownedLeadIds));
          }
          await tx.delete(tokenTopupIntent).where(eq(tokenTopupIntent.userId, deleteId));
          await tx.delete(tokenWalletLedger).where(eq(tokenWalletLedger.userId, deleteId));
          await tx
            .delete(tokenWalletReservation)
            .where(eq(tokenWalletReservation.userId, deleteId));
          await tx.delete(tokenWallet).where(eq(tokenWallet.userId, deleteId));
          await tx.delete(twoFactor).where(eq(twoFactor.userId, deleteId));
          await tx.delete(sessionTable).where(eq(sessionTable.userId, deleteId));
          await tx.delete(account).where(eq(account.userId, deleteId));
          await tx
            .update(auditLog)
            .set({ actorUserId: null })
            .where(eq(auditLog.actorUserId, deleteId));
          await tx.delete(user).where(eq(user.id, deleteId));
        });

        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "user.deleted",
          entityType: "user",
          entityId: deleteId,
          message: `User ${deleteId} deleted by administrator`,
        });
        return deps.json({ success: true });
      } catch (error: any) {
        console.error(`Admin user deletion failed for ${deleteId}:`, error);
        return deps.json({ error: error.message }, 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminLeads(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const rows = await deps.db.query.lead.findMany({
      orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
    });
    return deps.json(rows);
  }

  async function handleAdminProposals(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const origin = new URL(request.url).origin;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const proposalId = parts[3];
    const action = parts[4];

    if (proposalId === "generate-fields" && request.method === "POST") {
      try {
        const body = adminProposalGenerateSchema.parse(await request.json());
        const fromCompany = body.leadCompany ? `from ${body.leadCompany}` : "";
        const servicesList =
          body.services.length > 0
            ? body.services.join(", ")
            : "managed cloud and business services";
        const contextText = body.customContext
          ? `\n\nBACKGROUND CONTEXT (incorporate this only where relevant): ${body.customContext}`
          : "";

        let systemPrompt = "";
        let userPrompt = "";
        if (body.type === "introduction") {
          systemPrompt =
            "You are a professional CloudMonkey proposal writer. Write a concise introduction.";
          userPrompt = `Write a professional proposal introduction (exactly 2 to 3 sentences) for ${body.leadName ?? "the client"} ${fromCompany}. The proposal is for: ${servicesList}.${contextText}\n\nTask: Write ONLY the introduction paragraph. Keep it professional, direct, and welcoming.`;
        } else if (body.type === "executiveSummary") {
          systemPrompt =
            "You are a professional CloudMonkey proposal writer. Write a compelling executive summary that explains scope, SLA boundaries, support channels, and commercial transparency.";
          userPrompt = `Write a professional executive summary (exactly 3 to 4 sentences) for ${body.leadName ?? "the client"} ${fromCompany}. The services included are: ${servicesList}.${contextText}\n\nTask: Write ONLY the executive summary. Focus on commercial transparency, reliability, service limits, and how WhatsApp/email requests are handled against the subscribed services.`;
        } else {
          systemPrompt =
            "You are a professional CloudMonkey proposal writer. Write clear service terms and boundaries that reflect the SLA, request routing process, and commercial limits.";
          userPrompt = `Write a clear list of service terms and boundaries for ${body.leadName ?? "the client"} ${fromCompany} regarding the services: ${servicesList}.${contextText}\n\nTask: Write ONLY the terms and boundaries. Explicitly state that setup fees are once-off deployment charges, recurring fees are billed monthly, WhatsApp and email requests are logged as tickets and actioned against the subscribed services, and any requests outside this scope will be quoted separately before execution. If the services include a build, website, or ecommerce plan, state that coverage and delivery limits follow the selected package SKU and signed service order.`;
        }
        const fallback = [systemPrompt, "", userPrompt].join("\n");
        if (!process.env.GEMINI_API_KEY) {
          return deps.json({
            text:
              body.type === "introduction"
                ? PROPOSAL_DEFAULT_INTRODUCTION
                : body.type === "executiveSummary"
                  ? PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY
                  : buildProposalTerms(body.services),
            prompt: fallback,
            aiConfigured: false,
          });
        }

        const text = await deps.generateGeminiText(userPrompt, systemPrompt);
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "proposal.ai_content.generated",
          entityType: "proposal_draft",
          message: `Generated ${body.type} content for a proposal draft`,
          metadata: {
            proposalType: body.type,
            services: body.services,
            leadName: body.leadName ?? null,
            leadCompany: body.leadCompany ?? null,
          },
        });
        return deps.json({
          text,
          prompt: fallback,
          aiConfigured: true,
          tokensCharged: 0,
        });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (request.method === "GET") {
      if (proposalId) {
        const row = await deps.db.query.proposal.findFirst({
          where: eq(proposal.id, decodeURIComponent(proposalId)),
          with: { items: true, lead: true, invoice: true, customer: true },
        });
        if (!row) return deps.json({ error: "Proposal not found" }, 404);
        return deps.json({
          ...row,
          publicUrl: `${origin}/proposals/${encodeURIComponent(row.publicToken)}`,
        });
      }

      const rows = await deps.db.query.proposal.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
        with: { items: true, lead: true, invoice: true, customer: true },
      });
      return deps.json(
        rows.map((row: any) => ({
          ...row,
          publicUrl: `${origin}/proposals/${encodeURIComponent(row.publicToken)}`,
        })),
      );
    }

    if (!proposalId && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, proposalCreateSchema as any);
        let targetLead = body.leadId
          ? await deps.db.query.lead.findFirst({ where: eq(lead.id, body.leadId) })
          : null;
        if (!targetLead && body.lead) {
          const [createdLead] = await deps.db
            .insert(lead)
            .values({
              id: deps.makeId("lead"),
              name: body.lead.name,
              email: body.lead.email,
              company: body.lead.company ?? null,
              services: JSON.stringify(
                body.items.map(
                  (item: any) => item.productId ?? item.planId ?? item.bundleId ?? item.name,
                ),
              ),
              setupStyle: "proposal",
            })
            .returning();
          targetLead = createdLead;
        }
        if (!targetLead)
          return deps.json({ error: "Select an existing lead or provide lead details" }, 400);

        const lines = await resolveProposalLines(deps.db, body.items);
        const totals = proposalTotals(lines);
        if (totals.total <= 0)
          return deps.json({ error: "Proposal requires at least one payable line item" }, 400);

        const createdAt = new Date();
        const createdId = deps.makeId("prop");
        const publicToken = crypto.randomBytes(24).toString("base64url");
        const [created] = await deps.db.transaction(async (tx: any) => {
          const [createdProposal] = await tx
            .insert(proposal)
            .values({
              id: createdId,
              leadId: targetLead.id,
              proposalNumber: makeProposalNumber(createdId, createdAt),
              publicToken,
              title: body.title,
              status: "draft",
              customerName: targetLead.name,
              customerEmail: targetLead.email,
              customerCompany: targetLead.company ?? body.lead?.company ?? null,
              introduction: body.introduction ?? null,
              executiveSummary: body.executiveSummary ?? null,
              terms: body.terms ?? null,
              currency: "ZAR",
              subtotal: totals.subtotal,
              setupTotal: totals.setupTotal,
              recurringTotal: totals.recurringTotal,
              total: totals.total,
              expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
              createdByUserId: session.user.id,
            })
            .returning();
          await tx.insert(proposalItem).values(
            lines.map((line: any) => ({
              id: deps.makeId("propitem"),
              proposalId: createdId,
              ...line,
            })),
          );
          return [createdProposal];
        });
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "proposal.created",
          entityType: "proposal",
          entityId: created.id,
          message: `Proposal ${created.proposalNumber ?? created.id} created for ${targetLead.email}`,
          metadata: { leadId: targetLead.id, items: lines.length, total: totals.total },
        });
        return deps.json(
          {
            ...created,
            items: lines,
            publicUrl: `${origin}/proposals/${encodeURIComponent(publicToken)}`,
          },
          201,
        );
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (proposalId && action === "send" && request.method === "POST") {
      const id = decodeURIComponent(proposalId);
      const row = await deps.db.query.proposal.findFirst({
        where: eq(proposal.id, id),
        with: { items: true, lead: true, invoice: true, customer: true },
      });
      if (!row) return deps.json({ error: "Proposal not found" }, 404);
      if (!row.publicToken) return deps.json({ error: "Proposal is missing a public link" }, 400);
      if (row.status === "void")
        return deps.json({ error: "Voided proposals cannot be sent" }, 409);

      const publicUrl = `${origin}/proposals/${encodeURIComponent(row.publicToken)}`;
      const sentAt = new Date();
      const [updated] = await deps.db
        .update(proposal)
        .set({
          status: "sent",
          sentAt,
          updatedAt: sentAt,
        })
        .where(eq(proposal.id, row.id))
        .returning();

      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "proposal.sent",
        entityType: "proposal",
        entityId: row.id,
        message: `Proposal ${row.proposalNumber ?? row.id} emailed to ${row.customerEmail}`,
        metadata: {
          customerEmail: row.customerEmail,
          publicUrl,
          sentAt: sentAt.toISOString(),
        },
      });
      void deps
        .sendEmail({
          template: "generic",
          to: row.customerEmail,
          subject: `${row.title} - proposal ${row.proposalNumber ?? row.id} is ready`,
          data: {
            customerName: row.customerName,
            emailTitle: row.title,
            emailIntro: `Your CloudMonkey proposal ${row.proposalNumber ?? row.id} is ready for review.`,
            emailBody: [
              `Customer: ${row.customerName}`,
              row.customerCompany ? `Company: ${row.customerCompany}` : null,
              `Setup total: ${formatEmailMoney(row.setupTotal, row.currency)}`,
              `Recurring total: ${formatEmailMoney(row.recurringTotal, row.currency)}`,
              `Proposal total: ${formatEmailMoney(row.total, row.currency)}`,
              "",
              "The proposal includes the scope, SLA limits, and request-routing process for WhatsApp and email tickets.",
              "Use the button below to review and approve the proposal.",
            ]
              .filter(Boolean)
              .join("\n"),
            primaryCtaText: "Review proposal",
            primaryCtaUrl: publicUrl,
            subject: `${row.title} - proposal ${row.proposalNumber ?? row.id} is ready`,
          },
          idempotencyKey: `proposal:${row.id}:send`,
        })
        .catch((error) => {
          console.error(`Proposal ${row.proposalNumber ?? row.id} email send failed:`, error);
        });
      return deps.json({
        ...(updated ?? row),
        publicUrl,
      });
    }

    if (proposalId && action === "convert" && request.method === "POST") {
      const id = decodeURIComponent(proposalId);
      const row = await deps.db.query.proposal.findFirst({ where: eq(proposal.id, id) });
      if (!row) return deps.json({ error: "Proposal not found" }, 404);
      return deps.json({
        invoice: row.invoiceId ?? null,
        created: Boolean(row.invoiceId),
        invoiceUrl: row.invoiceId
          ? `${origin}/dashboard/billing/invoices/${encodeURIComponent(row.invoiceId)}`
          : null,
      });
    }

    if (proposalId && action === "void" && request.method === "POST") {
      const [updated] = await deps.db
        .update(proposal)
        .set({ status: "void", updatedAt: new Date() })
        .where(eq(proposal.id, decodeURIComponent(proposalId)))
        .returning();
      if (!updated) return deps.json({ error: "Proposal not found" }, 404);
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "proposal.voided",
        entityType: "proposal",
        entityId: updated.id,
        message: `Proposal ${updated.proposalNumber ?? updated.id} voided`,
      });
      return deps.json(updated);
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminPitchDecks(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const deckId = parts[3] ? decodeURIComponent(parts[3]) : null;
    const action = parts[4];

    async function ensureEngagementProject(input: {
      code: string;
      customerUserId: string | null;
      name: string;
      serviceName: string;
      template: string;
      description: string;
      dataBoundary: string;
      milestones: Array<{ name: string; tasks: string[]; deliverables: string[] }>;
    }) {
      const existing = await deps.db.query.project.findFirst({
        where: eq(project.engagementCode, input.code),
      });
      if (existing) return existing;
      if (!input.customerUserId) return null;
      const [created] = await deps.db
        .insert(project)
        .values({
          id: deps.makeId("project"),
          userId: input.customerUserId,
          name: input.name,
          serviceName: input.serviceName,
          template: input.template,
          engagementCode: input.code,
          billingCostCentre: input.code,
          contractingEntity: "H44S (Pty) Ltd t/a CloudMonkey",
          dataBoundary: input.dataBoundary,
          description: input.description,
          status: "planned",
          priority: "high",
          updatedAt: new Date(),
        })
        .returning();
      for (let index = 0; index < input.milestones.length; index += 1) {
        const milestoneInput = input.milestones[index];
        const [milestone] = await deps.db
          .insert(projectMilestone)
          .values({
            id: deps.makeId("milestone"),
            projectId: created.id,
            name: milestoneInput.name,
            sortOrder: index,
            updatedAt: new Date(),
          })
          .returning();
        for (let taskIndex = 0; taskIndex < milestoneInput.tasks.length; taskIndex += 1) {
          await deps.db.insert(projectTask).values({
            id: deps.makeId("task"),
            projectId: created.id,
            milestoneId: milestone.id,
            title: milestoneInput.tasks[taskIndex],
            sortOrder: taskIndex,
            updatedAt: new Date(),
          });
        }
        for (const deliverableName of milestoneInput.deliverables) {
          await deps.db.insert(projectDeliverable).values({
            id: deps.makeId("deliverable"),
            projectId: created.id,
            milestoneId: milestone.id,
            name: deliverableName,
            updatedAt: new Date(),
          });
        }
      }
      await deps.recordAudit({
        actorUserId: session?.user?.id,
        action: "customer.engagement.bootstrapped",
        entityType: "project",
        entityId: created.id,
        message: `Created separated engagement ${input.code}`,
        metadata: { engagementCode: input.code, dataBoundary: input.dataBoundary },
      });
      return created;
    }

    async function ensureDraftProposal(input: {
      code: string;
      title: string;
      customerName: string;
      customerEmail: string;
      customerCompany: string;
      customerUserId: string | null;
      leadId: string | null;
      introduction: string;
      executiveSummary: string;
      terms: string;
      items: Array<{ name: string; description: string; unitPrice: number; recurring: boolean }>;
    }) {
      const existing = await deps.db.query.proposal.findFirst({
        where: eq(proposal.proposalNumber, input.code),
      });
      if (existing) return existing;
      const [created] = await deps.db
        .insert(proposal)
        .values({
          id: deps.makeId("proposal"),
          proposalNumber: input.code,
          customerUserId: input.customerUserId,
          leadId: input.leadId,
          title: input.title,
          status: "draft",
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerCompany: input.customerCompany,
          introduction: input.introduction,
          executiveSummary: input.executiveSummary,
          terms: input.terms,
          currency: "ZAR",
          subtotal: input.items.reduce((sum, item) => sum + item.unitPrice, 0),
          setupTotal: input.items
            .filter((item) => !item.recurring)
            .reduce((sum, item) => sum + item.unitPrice, 0),
          recurringTotal: input.items
            .filter((item) => item.recurring)
            .reduce((sum, item) => sum + item.unitPrice, 0),
          total: input.items.reduce((sum, item) => sum + item.unitPrice, 0),
          createdByUserId: session?.user?.id ?? null,
        })
        .returning();
      for (let index = 0; index < input.items.length; index += 1) {
        const item = input.items[index];
        await deps.db.insert(proposalItem).values({
          id: deps.makeId("proposalitem"),
          proposalId: created.id,
          productType: "custom",
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          setupPrice: item.recurring ? 0 : item.unitPrice,
          recurring: item.recurring,
          interval: "month",
          sortOrder: index,
          lineTotal: item.unitPrice,
          serviceDefinition: JSON.stringify({ engagementCode: input.code }),
        });
      }
      await deps.recordAudit({
        actorUserId: session?.user?.id,
        action: "proposal.draft_created",
        entityType: "proposal",
        entityId: created.id,
        message: `Created draft proposal ${input.code}`,
        metadata: { engagementCode: input.code },
      });
      return created;
    }

    if (request.method === "POST" && deckId === "bootstrap-sti") {
      const electricalCustomer = await deps.db.query.user.findFirst({
        where: eq(user.email, "accounts@stielectrical.co.za"),
      });
      const riskCustomer = await deps.db.query.user.findFirst({
        where: eq(user.email, "kiril.kutchoukov@gmail.com"),
      });
      const electricalLead = await deps.db.query.lead.findFirst({
        where: eq(lead.email, "kiril.kutchoukov@gmail.com"),
      });
      const riskLead = await deps.db.query.lead.findFirst({
        where: eq(lead.email, "kiril.kutchoukov@gmail.com"),
      });
      const electricalProject = await ensureEngagementProject({
        code: "STI-ELECTRICAL",
        customerUserId: electricalCustomer?.id ?? riskCustomer?.id ?? null,
        name: "STI Electrical · ERP Phase 2 Enablement",
        serviceName: "ERP implementation and operational enablement",
        template: "business-technology",
        description:
          "Separate project for STI Electrical ERP close-out, live-data consolidation, training, UAT and hosting decisions.",
        dataBoundary: "STI Electrical data only. Do not mix with STI Risk records or billing.",
        milestones: [
          {
            name: "Data and foundation",
            tasks: [
              "Confirm data owners and source records",
              "Consolidate assets, finance and stock data",
            ],
            deliverables: ["Data readiness register", "Asset register draft"],
          },
          {
            name: "Consolidation and fixes",
            tasks: ["Validate live ERP data", "Complete security and workflow fixes"],
            deliverables: ["Validated ERP dataset", "IT and process audit"],
          },
          {
            name: "Validation and handover",
            tasks: ["Run user testing and training", "Complete UAT and handover"],
            deliverables: ["UAT sign-off", "Handover pack"],
          },
        ],
      });
      const riskProject = await ensureEngagementProject({
        code: "STI-RISK",
        customerUserId: riskCustomer?.id ?? null,
        name: "STI Risk · Product Definition and Platform Development",
        serviceName: "Risk platform definition and development",
        template: "business-technology",
        description:
          "Separate STI Risk product, development, support and managed-service engagement.",
        dataBoundary:
          "STI Risk data only. No automatic reuse of STI Electrical information, time or billing.",
        milestones: [
          {
            name: "Product definition",
            tasks: [
              "Confirm target users and business outcomes",
              "Map workflows, roles and acceptance criteria",
            ],
            deliverables: ["Product definition brief", "Prioritised feature inventory"],
          },
          {
            name: "Foundation and priority workflows",
            tasks: [
              "Build approved platform foundation",
              "Develop priority workflows and reporting",
            ],
            deliverables: ["Working milestone release", "Test evidence"],
          },
          {
            name: "Validation and launch",
            tasks: ["Complete UAT and training", "Confirm managed cloud and support model"],
            deliverables: ["Launch readiness checklist", "Operating and support plan"],
          },
        ],
      });
      const electricalDeck = await ensureDeck(
        "sti-electrical-phase-2",
        "STI Electrical — On-site ERP Enablement & Technology Optimisation",
        STI_ELECTRICAL_PHASE_2_DECK,
        electricalCustomer?.id ?? riskCustomer?.id ?? null,
        electricalLead?.id ?? null,
        "published",
      );
      const riskDeck = await ensureDeck(
        "sti-risk-platform",
        "STI Risk — Build & Managed Service Proposal",
        STI_RISK_PRODUCT_PROPOSAL_DECK,
        riskCustomer?.id ?? null,
        riskLead?.id ?? null,
        "draft",
      );
      const electricalProposal = await ensureDraftProposal({
        code: "STI-ELECTRICAL-PHASE-2-2026",
        title: "STI Electrical — Phase 2 close-out and on-site enablement",
        customerName: "Kiril Kutchoukov",
        customerEmail: "kiril.kutchoukov@gmail.com",
        customerCompany: "STI Electrical (Pty) Ltd",
        customerUserId: electricalCustomer?.id ?? riskCustomer?.id ?? null,
        leadId: electricalLead?.id ?? null,
        introduction:
          "Draft for review: a transparent choice between standard SLA completion and an optional accelerated on-site enablement bundle.",
        executiveSummary:
          "The original Phase 2 rights remain honoured. Option B adds a separate 70-hour on-site acceleration service at R1,000 per hour, capped at R70,000.",
        terms:
          "This draft must be reviewed and approved before it is sent. STI Electrical and STI Risk remain separate engagements.",
        items: [
          {
            name: "Accelerated on-site ERP enablement bundle",
            description:
              "70 on-site hours at R1,000/hour for live-data consolidation, user enablement, production-floor implementation and UAT.",
            unitPrice: 7000000,
            recurring: false,
          },
          {
            name: "Managed Cloud hosting",
            description:
              "Hosting, SSL, DNS, backups, monitoring and support. Final plan selected separately after infrastructure confirmation.",
            unitPrice: 0,
            recurring: true,
          },
        ],
      });
      const riskProposal = await ensureDraftProposal({
        code: "STI-RISK-DISCOVERY-2026",
        title: "STI Risk — Product definition and development programme",
        customerName: "Kiril Kutchoukov",
        customerEmail: "kiril.kutchoukov@gmail.com",
        customerCompany: "STI Risk",
        customerUserId: riskCustomer?.id ?? null,
        leadId: riskLead?.id ?? null,
        introduction:
          "Draft for review: CloudMonkey will agree the STI Risk build plan, deliver approved milestones, and support the live platform under the selected managed plan.",
        executiveSummary:
          "STI Risk receives a documented build plan, milestone-based platform delivery, testing and launch, followed by a separately selected managed service. Additional remote or on-site assistance is booked and paid only when required.",
        terms:
          "Draft only. Build pricing, payment milestones and dates will be contained in the approved build plan or milestone quotation. The managed-plan fee and inclusions will be contained in the selected service order. Additional remote and on-site prices are displayed during website booking and paid at checkout. No additional billable build work starts without written approval or payment. STI Risk and STI Electrical remain separate CloudMonkey customers with separate scope, projects, data, support and billing.",
        items: [
          {
            name: "Product Definition Sprint",
            description:
              "Strategy, user and workflow definition, feature inventory, roadmap and acceptance criteria. Quote to confirm.",
            unitPrice: 0,
            recurring: false,
          },
          {
            name: "Milestone-based platform development",
            description:
              "Approved features built, tested and handed over against milestone acceptance criteria. Quote to confirm.",
            unitPrice: 0,
            recurring: false,
          },
          {
            name: "Managed CloudMonkey service",
            description:
              "Separate hosting, monitoring, backups, security and support service selected after the final platform footprint is known.",
            unitPrice: 0,
            recurring: true,
          },
        ],
      });
      return deps.json(
        {
          projects: [electricalProject, riskProject].filter(Boolean),
          decks: [electricalDeck, riskDeck],
          proposals: [electricalProposal, riskProposal],
        },
        201,
      );
    }

    async function ensureDeck(
      slug: string,
      title: string,
      content: unknown,
      customerUserId: string | null,
      leadId: string | null,
      status: string,
    ) {
      const existing = await deps.db.query.pitchDeck.findFirst({ where: eq(pitchDeck.slug, slug) });
      if (existing) {
        const nextStatus = existing.status === "published" ? "published" : status;
        const [updated] = await deps.db
          .update(pitchDeck)
          .set({
            title,
            content: JSON.stringify(content),
            customerUserId,
            leadId,
            status: nextStatus,
            publishedAt:
              nextStatus === "published" ? (existing.publishedAt ?? new Date()) : null,
            updatedAt: new Date(),
          })
          .where(eq(pitchDeck.id, existing.id))
          .returning();
        return updated ?? existing;
      }
      const [created] = await deps.db
        .insert(pitchDeck)
        .values({
          id: deps.makeId("deck"),
          customerUserId,
          leadId,
          createdByUserId: session?.user?.id ?? null,
          slug,
          publicToken: crypto.randomBytes(24).toString("base64url"),
          title,
          status,
          content: JSON.stringify(content),
          publishedAt: status === "published" ? new Date() : null,
        })
        .returning();
      return created;
    }

    if (request.method === "POST" && deckId && action === "audio") {
      const deck = await deps.db.query.pitchDeck.findFirst({ where: eq(pitchDeck.id, deckId) });
      if (!deck) return deps.json({ error: "Pitch deck not found" }, 404);
      const content = JSON.parse(deck.content) as {
        slides?: Array<{
          id: string;
          title: string;
          subtitle?: string;
          body?: string;
          bullets?: string[];
        }>;
      };
      const requestedSlide = String((await request.json().catch(() => ({}))).slideId ?? "");
      const slides = (content.slides ?? []).filter(
        (slide) => !requestedSlide || slide.id === requestedSlide,
      );
      if (!slides.length) return deps.json({ error: "Slide not found" }, 404);
      const generated = [];
      for (const slide of slides) {
        const spokenText = [slide.title, slide.subtitle, slide.body, ...(slide.bullets ?? [])]
          .filter(Boolean)
          .join(". ");
        const audio = await deps.generateGeminiSpeech({ text: spokenText, voice: "Kore" });
        await deps.db
          .insert(pitchDeckAudio)
          .values({
            id: deps.makeId("deckaudio"),
            pitchDeckId: deck.id,
            slideId: slide.id,
            audioData: audio.audioData,
            mimeType: audio.mimeType,
            model: audio.model,
            voice: audio.voice,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [pitchDeckAudio.pitchDeckId, pitchDeckAudio.slideId],
            set: {
              audioData: audio.audioData,
              mimeType: audio.mimeType,
              model: audio.model,
              voice: audio.voice,
              updatedAt: new Date(),
            },
          });
        generated.push({ slideId: slide.id, mimeType: audio.mimeType });
      }
      return deps.json({ generated });
    }

    if (request.method === "GET") {
      const existingSti = await deps.db.query.pitchDeck.findFirst({
        where: eq(pitchDeck.slug, "sti-electrical-phase-2"),
      });
      if (!existingSti) {
        const customer = await deps.db.query.user.findFirst({
          where: eq(user.email, "accounts@stielectrical.co.za"),
        });
        const stiLead = await deps.db.query.lead.findFirst({
          where: eq(lead.email, "kiril.kutchoukov@gmail.com"),
        });
        await deps.db
          .insert(pitchDeck)
          .values({
            id: deps.makeId("deck"),
            customerUserId: customer?.id ?? null,
            leadId: stiLead?.id ?? null,
            createdByUserId: session?.user?.id ?? null,
            slug: "sti-electrical-phase-2",
            publicToken: "sti-electrical-phase-2",
            title: "STI Electrical — Phase 2 ERP Proposal",
            status: "published",
            content: JSON.stringify(STI_ELECTRICAL_PHASE_2_DECK),
            publishedAt: new Date(),
          })
          .onConflictDoNothing({ target: pitchDeck.slug });
      }
      const rows = await deps.db.query.pitchDeck.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
        with: { customer: true, lead: true, createdBy: true },
      });
      return deps.json(
        rows.map((row: any) => ({
          ...row,
          content: undefined,
          publicUrl: `${url.origin}/pitch-decks/${encodeURIComponent(row.publicToken)}`,
        })),
      );
    }

    if (request.method === "POST" && !deckId) {
      const body = await request.json().catch(() => ({}));
      const slug = String(body.slug ?? "").trim() || "sti-electrical-phase-2";
      const existing = await deps.db.query.pitchDeck.findFirst({ where: eq(pitchDeck.slug, slug) });
      if (existing)
        return deps.json({
          ...existing,
          content: undefined,
          publicUrl: `${url.origin}/pitch-decks/${existing.publicToken}`,
        });
      const customer = await deps.db.query.user.findFirst({
        where: eq(user.email, "accounts@stielectrical.co.za"),
      });
      const stiLead = await deps.db.query.lead.findFirst({
        where: eq(lead.email, "kiril.kutchoukov@gmail.com"),
      });
      const createdId = deps.makeId("deck");
      const token = crypto.randomBytes(24).toString("base64url");
      const [created] = await deps.db
        .insert(pitchDeck)
        .values({
          id: createdId,
          customerUserId: customer?.id ?? null,
          leadId: stiLead?.id ?? null,
          createdByUserId: session?.user?.id ?? null,
          slug,
          publicToken: token,
          title: String(body.title ?? "STI Electrical — Phase 2 ERP Proposal"),
          status: body.status === "draft" ? "draft" : "published",
          content: JSON.stringify(body.content ?? STI_ELECTRICAL_PHASE_2_DECK),
          publishedAt: body.status === "draft" ? null : new Date(),
        })
        .returning();
      await deps.recordAudit({
        actorUserId: session?.user?.id,
        action: "pitch_deck.created",
        entityType: "pitch_deck",
        entityId: created.id,
        message: `Created pitch deck ${created.title}`,
        metadata: { slug, customerUserId: customer?.id ?? null },
      });
      return deps.json(
        { ...created, content: undefined, publicUrl: `${url.origin}/pitch-decks/${token}` },
        201,
      );
    }

    if (deckId && action === "publish" && request.method === "POST") {
      const [updated] = await deps.db
        .update(pitchDeck)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(pitchDeck.id, deckId))
        .returning();
      if (!updated) return deps.json({ error: "Pitch deck not found" }, 404);
      await deps.recordAudit({
        actorUserId: session?.user?.id,
        action: "pitch_deck.published",
        entityType: "pitch_deck",
        entityId: deckId,
        message: `Published pitch deck ${updated.title}`,
      });
      return deps.json({
        ...updated,
        content: undefined,
        publicUrl: `${url.origin}/pitch-decks/${updated.publicToken}`,
      });
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminOnboarding(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const rows = await deps.db.query.onboardingSubmission.findMany({
      with: { user: true, subscription: true },
      orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
    });
    return deps.json(rows);
  }

  async function handleAssignVultr(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    try {
      const body = await request.json();
      await deps.db
        .insert(vultrInstance)
        .values({
          id: body.id,
          userId: body.userId,
          os: body.os,
          ram: body.ram,
          disk: body.disk,
          mainIp: body.main_ip,
          region: body.region,
          status: body.status,
          powerStatus: body.power_status,
          label: body.label,
        })
        .onConflictDoUpdate({
          target: vultrInstance.id,
          set: {
            userId: body.userId,
            os: body.os,
            ram: body.ram,
            disk: body.disk,
            mainIp: body.main_ip,
            region: body.region,
            status: body.status,
            powerStatus: body.power_status,
            label: body.label,
            updatedAt: new Date(),
          },
        });
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "server.assigned",
        entityType: "vultr_instance",
        entityId: body.id,
        message: `Server assigned: ${body.label || body.id}`,
        metadata: { userId: body.userId },
      });
      return deps.json({ success: true });
    } catch (error: any) {
      return deps.json({ error: error.message ?? "Failed to assign server" }, 500);
    }
  }

  async function handleAdminTickets(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const ticketId = parts[3];

    if (ticketId && parts[4] === "ai-summary" && request.method === "GET") {
      try {
        const ticket = await deps.db.query.supportTicket.findFirst({
          where: eq(supportTicket.id, ticketId),
          with: { comments: true, user: true },
        });
        if (!ticket) return deps.json({ error: "Ticket not found" }, 404);

        const databaseContext = buildTicketAiDatabaseContext(
          await deps.getSupportCrmContext(ticket.userId),
        );
        const ticketContext = {
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          resolutionSummary: ticket.resolutionSummary,
          customer: {
            id: ticket.userId,
            name: ticket.user?.name ?? null,
            email: ticket.user?.email ?? null,
          },
          comments: (ticket.comments ?? []).slice(-20).map((comment: any) => ({
            body: comment.body,
            isInternal: comment.isInternal,
            createdAt: comment.createdAt,
          })),
        };
        const responseData = await deps.sendN8nAdminChat({
          sessionId: `ticket-summary:${ticketId}`,
          message: [
            `Review support ticket ${ticketId} against the supplied database context.`,
            "Return a short staff-facing summary with exactly these headings: Situation, Relevant database context, Possible resolution points.",
            "Use only supplied facts, mention conflicts or missing information, and keep the resolution points practical and concise.",
            "This is analysis only. Do not perform actions, change records, or claim that anything has been completed.",
          ].join("\n\n"),
          contextType: "support_ticket_summary",
          contextId: ticketId,
          conversationHistory: [
            { role: "system", content: `Ticket: ${JSON.stringify(ticketContext)}` },
            { role: "system", content: `Database context: ${JSON.stringify(databaseContext)}` },
          ],
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: session.user.role,
            allowMutations: false,
            ticket: ticketContext,
            databaseContext,
          },
          idempotencyKey: `ticket-summary:${ticketId}:${ticket.updatedAt?.toISOString?.() ?? ticket.updatedAt}`,
        });
        return deps.json({
          summary: normalizeTicketAiSummary(responseData),
          generatedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        return deps.json(
          { error: error.message ?? "AI ticket summary failed" },
          error.status ?? 502,
        );
      }
    }

    if (
      ticketId &&
      parts[4] === "comments" &&
      parts[5] &&
      parts[6] === "publish" &&
      request.method === "POST"
    ) {
      const commentId = parts[5];
      const comment = await deps.db.query.supportTicketComment.findFirst({
        where: eq(supportTicketComment.id, commentId),
      });
      if (!comment || comment.ticketId !== ticketId) {
        return deps.json({ error: "Ticket note not found" }, 404);
      }
      const [published] = await deps.db
        .update(supportTicketComment)
        .set({ isInternal: false })
        .where(eq(supportTicketComment.id, commentId))
        .returning();
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "ticket.note.published",
        entityType: "support_ticket",
        entityId: ticketId,
        message: `Private note published on ticket ${ticketId}`,
        metadata: { commentId },
      });
      return deps.json(published);
    }

    if (ticketId && parts[4] === "ai-instructions" && request.method === "POST") {
      let instructionNote: any = null;
      try {
        const body = await deps.parseBody(request, ticketAiInstructionSchema);
        const ticket = await deps.db.query.supportTicket.findFirst({
          where: eq(supportTicket.id, ticketId),
          with: { comments: true, user: true },
        });
        if (!ticket) return deps.json({ error: "Ticket not found" }, 404);

        [instructionNote] = await deps.db
          .insert(supportTicketComment)
          .values({
            id: deps.makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: `AI instruction\n\n${body.instruction}`,
            isInternal: true,
          })
          .returning();

        const ticketContext = {
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          customer: {
            id: ticket.userId,
            name: ticket.user?.name ?? null,
            email: ticket.user?.email ?? null,
          },
        };
        const databaseContext = buildTicketAiDatabaseContext(
          await deps.getSupportCrmContext(ticket.userId),
        );
        const conversationHistory = [
          { role: "system", content: `Support ticket context: ${JSON.stringify(ticketContext)}` },
          {
            role: "system",
            content: `Customer database context: ${JSON.stringify(databaseContext)}`,
          },
          ...(ticket.comments ?? []).slice(-20).map((comment: any) => ({
            role: comment.isInternal ? "system" : "user",
            content: comment.body,
          })),
        ];
        const responseData = await deps.sendN8nAdminChat({
          sessionId: `ticket:${ticketId}`,
          message: [
            `Execute this staff instruction for support ticket ${ticketId}:`,
            body.instruction,
            "Return clear outcome feedback for the ticket note.",
            "Keep the note private unless it is safe for the customer and you explicitly return makePublic=true or visibility=public.",
            "If the outcome completes the ticket, you may return ticketStatus=resolved.",
          ].join("\n\n"),
          contextType: "support_ticket",
          contextId: ticketId,
          conversationHistory,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: session.user.role,
            allowMutations: true,
            ticket: ticketContext,
            databaseContext,
          },
          idempotencyKey: `ticket-ai:${ticketId}:${instructionNote.id}`,
        });
        const outcome = normalizeTicketAiOutcome(responseData);
        const [outcomeNote] = await deps.db
          .insert(supportTicketComment)
          .values({
            id: deps.makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: `AI outcome\n\n${outcome.body}`,
            isInternal: !outcome.makePublic,
          })
          .returning();

        const ticketUpdates: Record<string, unknown> = { updatedAt: new Date() };
        if (outcome.ticketStatus) ticketUpdates.status = outcome.ticketStatus;
        if (outcome.ticketStatus === "resolved") ticketUpdates.resolutionSummary = outcome.body;
        await deps.db
          .update(supportTicket)
          .set(ticketUpdates)
          .where(eq(supportTicket.id, ticketId));
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "ticket.ai_instruction.completed",
          entityType: "support_ticket",
          entityId: ticketId,
          message: `AI instruction completed for ticket ${ticket.subject}`,
          metadata: {
            instructionNoteId: instructionNote.id,
            outcomeNoteId: outcomeNote.id,
            published: outcome.makePublic,
            ticketStatus: outcome.ticketStatus,
          },
        });
        return deps.json({ instructionNote, outcomeNote, outcome, response: responseData }, 201);
      } catch (error: any) {
        if (instructionNote) {
          await deps.db.insert(supportTicketComment).values({
            id: deps.makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: `AI outcome\n\nInstruction failed: ${error.message ?? "Unknown agent error"}`,
            isInternal: true,
          });
          await deps.db
            .update(supportTicket)
            .set({ updatedAt: new Date() })
            .where(eq(supportTicket.id, ticketId));
        }
        return deps.json({ error: error.message ?? "AI instruction failed" }, error.status ?? 502);
      }
    }

    if (ticketId && parts[4] === "comments" && request.method === "POST") {
      try {
        const body = await deps.parseBody(
          request,
          z.object({ body: z.string().min(1), isInternal: z.boolean().optional().default(false) }),
        );
        const ticket = await deps.db.query.supportTicket.findFirst({
          where: eq(supportTicket.id, ticketId),
          with: { comments: true },
        });
        if (!ticket) return deps.json({ error: "Ticket not found" }, 404);
        const [created] = await deps.db
          .insert(supportTicketComment)
          .values({
            id: deps.makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: body.body,
            isInternal: Boolean(body.isInternal),
          })
          .returning();
        await deps.db
          .update(supportTicket)
          .set({ updatedAt: new Date() })
          .where(eq(supportTicket.id, ticketId));
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "ticket.comment.created",
          entityType: "support_ticket",
          entityId: ticketId,
          message: `Comment added to ticket ${ticket.subject}`,
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (ticketId && request.method === "GET") {
      const ticket = await deps.db.query.supportTicket.findFirst({
        where: eq(supportTicket.id, ticketId),
        with: { comments: true },
      });
      if (!ticket) return deps.json({ error: "Ticket not found" }, 404);
      return deps.json(ticket);
    }

    if (ticketId && request.method === "PUT") {
      try {
        const body = await deps.parseBody(request, ticketUpdateSchema);
        const [updated] = await deps.db
          .update(supportTicket)
          .set({
            subject: body.subject ?? undefined,
            description: body.description ?? undefined,
            priority: body.priority ?? undefined,
            status: body.status ?? undefined,
            category: body.category ?? undefined,
            assignedToUserId: body.assignedToUserId ?? undefined,
            resolutionSummary: body.resolutionSummary ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(supportTicket.id, ticketId))
          .returning();
        if (!updated) return deps.json({ error: "Ticket not found" }, 404);
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "ticket.updated",
          entityType: "support_ticket",
          entityId: updated.id,
          message: `Ticket ${updated.subject} updated`,
          metadata: { status: updated.status, priority: updated.priority },
        });
        return deps.json(updated);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (request.method === "POST") {
      try {
        const settings = await deps.getWorkspaceSettings();
        if (!settings?.allowCustomerTicketCreation) {
          return deps.json({ error: "Customer ticket creation is disabled" }, 403);
        }
        const body = await deps.parseBody(
          request,
          z.object({
            userId: z.string().optional().nullable(),
            subject: z.string().min(1),
            description: z.string().optional().nullable(),
            priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
            status: z.enum(["open", "pending", "resolved", "closed"]).default("open"),
            category: z.string().min(1).default("general"),
          }),
        );
        const [created] = await deps.db
          .insert(supportTicket)
          .values({
            id: deps.makeId("ticket"),
            userId: body.userId ?? session.user.id,
            subject: body.subject,
            description: body.description ?? null,
            priority: body.priority,
            status: body.status,
            category: body.category,
            source: "manual",
          })
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "ticket.created",
          entityType: "support_ticket",
          entityId: created.id,
          message: `Support ticket opened: ${created.subject}`,
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    const rows = await deps.db.query.supportTicket.findMany({
      orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
      with: { comments: true },
    });
    return deps.json(rows);
  }

  async function handleAdminAgents(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    if (request.method === "GET") {
      const rows = await deps.db.query.aiAgent.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
        with: { user: true },
      });
      return deps.json(rows);
    }
    if (request.method === "POST") {
      try {
        const body = await deps.parseBody(
          request,
          z.object({
            userId: z.string().optional(),
            name: z.string().min(1),
            purpose: z.string().min(1),
            provider: z.string().min(1).default("openrouter"),
            model: z.string().optional().nullable(),
            status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
          }),
        );
        const [created] = await deps.db
          .insert(aiAgent)
          .values({
            id: deps.makeId("agent"),
            userId: body.userId ?? session.user.id,
            name: body.name,
            purpose: body.purpose,
            provider: body.provider,
            model: body.model ?? null,
            status: body.status,
          })
          .returning();
        await deps.recordAudit({
          actorUserId: session.user.id,
          action: "agent.created",
          entityType: "ai_agent",
          entityId: created.id,
          message: `Agent ${created.name} created`,
        });
        return deps.json(created, 201);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }
    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminCustomers(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const users = await deps.db.query.user.findMany({
      orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
    });
    const customers = await Promise.all(
      users.map(async (row: any) => {
        const context = await deps.getSupportCrmContext(row.id);
        const safeContext = {
          domains: Array.isArray(context?.domains) ? context.domains : [],
          servers: Array.isArray(context?.servers) ? context.servers : [],
          websites: Array.isArray(context?.websites) ? context.websites : [],
          agents: Array.isArray(context?.agents) ? context.agents : [],
          tickets: Array.isArray(context?.tickets) ? context.tickets : [],
          subscriptions: Array.isArray(context?.subscriptions) ? context.subscriptions : [],
          invoices: Array.isArray(context?.invoices) ? context.invoices : [],
        };
        const summary = normalizeUserSummary(safeContext);
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          emailVerified: row.emailVerified,
          createdAt: row.createdAt,
          summary,
          services: {
            items: [
              ...safeContext.domains.map((domain: any) => ({
                id: domain.id,
                type: "domain",
                label: domain.id,
                status: domain.status,
              })),
              ...safeContext.servers.map((server: any) => ({
                id: server.id,
                type: "server",
                label: server.label ?? server.id,
                status: server.status,
                powerStatus: server.powerStatus,
                mainIp: server.mainIp,
              })),
              ...safeContext.websites.map((site: any) => ({
                id: site.id,
                type: "website",
                label: site.businessName ?? site.domain,
                status: site.status,
                temporaryDomain: site.temporaryDomain,
              })),
              ...safeContext.subscriptions.map((subscriptionRow: any) => ({
                id: subscriptionRow.id,
                type: "subscription",
                label: subscriptionRow.name,
                status: subscriptionRow.status,
                amount: subscriptionRow.amount,
                interval: subscriptionRow.interval,
              })),
              ...safeContext.agents.map((agent: any) => ({
                id: agent.id,
                type: "agent",
                label: agent.name,
                status: agent.status,
              })),
            ],
            tickets: safeContext.tickets,
            invoices: safeContext.invoices.map((row: any) => ({
              id: row.id,
              invoiceNumber: row.invoiceNumber,
              amount: row.amount,
              status: row.status,
              dueDate: row.dueDate,
            })),
            subscriptions: safeContext.subscriptions,
          },
        };
      }),
    );

    const summary = {
      totalCustomers: customers.length,
      totalServices: customers.reduce((sum, row) => sum + row.summary.totalServices, 0),
      activeServices: customers.reduce((sum, row) => sum + row.summary.activeServices, 0),
      problemServices: customers.reduce((sum, row) => sum + row.summary.problemServices, 0),
      openTickets: customers.reduce((sum, row) => sum + row.summary.openTickets, 0),
      unpaidInvoiceAmount: customers.reduce((sum, row) => sum + row.summary.unpaidInvoiceAmount, 0),
    };
    return deps.json({ customers, summary });
  }

  async function handleAdminProducts(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;

    if (request.method === "GET") {
      const [categories, services, plans, planFeatures, bundles, bundleFeatures] =
        await Promise.all([
          deps.db.query.serviceCategory.findMany({
            orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
          }),
          deps.db.query.service.findMany({
            orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
          }),
          deps.db.query.servicePlan.findMany({
            orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
          }),
          deps.db.query.serviceFeature.findMany(),
          deps.db.query.bundle.findMany({
            orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
          }),
          deps.db.query.bundleFeature.findMany(),
        ]);
      const categoriesById = new Map(categories.map((row: any) => [row.id, row]));
      const servicesById = new Map(services.map((row: any) => [row.id, row]));
      const featuresByPlan = new Map<string, any[]>();
      for (const feature of planFeatures) {
        const current = featuresByPlan.get(feature.planId) ?? [];
        current.push({ content: feature.content });
        featuresByPlan.set(feature.planId, current);
      }
      const featuresByBundle = new Map<string, any[]>();
      for (const feature of bundleFeatures) {
        const current = featuresByBundle.get(feature.bundleId) ?? [];
        current.push({ content: feature.content });
        featuresByBundle.set(feature.bundleId, current);
      }

      const catalogRows = [
        ...plans.map((plan: any) =>
          servicePlanRow(
            plan,
            servicesById.get(plan.serviceId),
            categoriesById.get(servicesById.get(plan.serviceId)?.categoryId),
            featuresByPlan.get(plan.id) ?? [],
          ),
        ),
        ...bundles.map((row: any) => bundleRow(row, featuresByBundle.get(row.id) ?? [])),
      ].sort((a: any, b: any) => {
        const sortA = a.sortOrder ?? 0;
        const sortB = b.sortOrder ?? 0;
        if (sortA !== sortB) return sortA - sortB;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

      return deps.json(catalogRows);
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json();
        const id = String(body.id ?? "");
        if (!id) return deps.json({ error: "Product id is required" }, 400);
        const existingPlan = await deps.db.query.servicePlan.findFirst({
          where: eq(servicePlan.id, id),
        });
        if (existingPlan) {
          const [updated] = await deps.db
            .update(servicePlan)
            .set({
              name: body.name ?? existingPlan.name,
              tagline: body.tagline ?? existingPlan.tagline,
              priceZar: toCentsFromZarInput(body.priceZar) ?? existingPlan.priceZar,
              setupPriceZar: toCentsFromZarInput(body.setupPriceZar) ?? existingPlan.setupPriceZar,
              billingFrequency: body.billingFrequency ?? existingPlan.billingFrequency,
              minimumTermMonths:
                body.minimumTermMonths === "" || body.minimumTermMonths == null
                  ? existingPlan.minimumTermMonths
                  : Number(body.minimumTermMonths),
              billingType: body.billingType ?? existingPlan.billingType,
              priceLabel: body.priceLabel ?? existingPlan.priceLabel,
              isBundle: body.isBundle ?? existingPlan.isBundle,
              sortOrder:
                body.sortOrder === "" || body.sortOrder == null
                  ? existingPlan.sortOrder
                  : Number(body.sortOrder),
              serviceNote: body.serviceNote ?? existingPlan.serviceNote,
              active: body.active ?? existingPlan.active,
              updatedAt: new Date(),
            } as any)
            .where(eq(servicePlan.id, id))
            .returning();
          return deps.json(updated);
        }
        const existingBundle = await deps.db.query.bundle.findFirst({ where: eq(bundle.id, id) });
        if (existingBundle) {
          const [updated] = await deps.db
            .update(bundle)
            .set({
              name: body.name ?? existingBundle.name,
              priceZar: toCentsFromZarInput(body.priceZar) ?? existingBundle.priceZar,
              setupPriceZar:
                toCentsFromZarInput(body.setupPriceZar) ?? existingBundle.setupPriceZar,
              billingFrequency: body.billingFrequency ?? existingBundle.billingFrequency,
              minimumTermMonths:
                body.minimumTermMonths === "" || body.minimumTermMonths == null
                  ? existingBundle.minimumTermMonths
                  : Number(body.minimumTermMonths),
              billingType: body.billingType ?? existingBundle.billingType,
              priceLabel: body.priceLabel ?? existingBundle.priceLabel,
              isBundle: body.isBundle ?? existingBundle.isBundle,
              sortOrder:
                body.sortOrder === "" || body.sortOrder == null
                  ? existingBundle.sortOrder
                  : Number(body.sortOrder),
              serviceNote: body.serviceNote ?? existingBundle.serviceNote,
              active: body.active ?? existingBundle.active,
              updatedAt: new Date(),
            } as any)
            .where(eq(bundle.id, id))
            .returning();
          return deps.json(updated);
        }
        return deps.json({ error: "Product not found" }, 404);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminAuditLogs(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const rows = await deps.db.query.auditLog.findMany({
      orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
      limit: 250,
    });
    return deps.json(rows.map((row: any) => ({ ...row, metadata: safeJsonParse(row.metadata) })));
  }

  async function handleAdminSettings(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    if (request.method === "GET") {
      const settings = await deps.getWorkspaceSettings();
      return deps.json(settings);
    }
    if (request.method === "PUT") {
      try {
        const body = await deps.parseBody(request, settingsSchema);
        const [current] = await deps.db
          .insert(workspaceSettings)
          .values({
            id: "default",
            ...body,
            updatedAt: new Date(),
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: workspaceSettings.id,
            set: {
              ...body,
              updatedAt: new Date(),
            },
          })
          .returning();
        return deps.json(current);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }
    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminPlatformMatrix(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const [users, domains, servers, vultrPlans] = await Promise.all([
      deps.db.query.user.findMany({ orderBy: (row: any, { desc }: any) => [desc(row.createdAt)] }),
      deps.db.query.registeredDomain.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.createdAt)],
      }),
      deps.db.query.vultrInstance.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
      }),
      listPlans().catch(() => []),
    ]);

    const userMap = new Map(users.map((row: any) => [row.id, row]));
    const domainsPayload = domains.map((row: any) => ({
      domainName: row.id,
      status: row.status,
      expiryDate: row.expiryDate,
      source: "cloudmonkey",
      assignment: { userId: row.userId },
      user: userMap.get(row.userId) ?? null,
    }));
    const serversPayload = servers.map((row: any) => ({
      id: row.id,
      label: row.label,
      main_ip: row.mainIp,
      os: row.os,
      ram: row.ram,
      disk: row.disk,
      region: row.region,
      status: row.status,
      power_status: row.powerStatus,
      assignment: { userId: row.userId },
      user: userMap.get(row.userId) ?? null,
    }));
    return deps.json({
      users: users.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      })),
      domains: domainsPayload,
      servers: serversPayload,
      vultrPlans,
      errors: {},
    });
  }

  async function handleAdminServerStatus(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    return deps.json(await deps.getAdminServerStatus());
  }

  async function handleAdminWebsiteHealth(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    return deps.json(await deps.getAdminWebsiteHealth());
  }

  async function handleAdminChat(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    if (url.pathname === "/api/admin/chat/history" && request.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      const chatSession = await deps.resolveAdminChatSession(session.user.id, sessionId);
      if (!chatSession) return deps.json({ error: "Chat session not found" }, 404);
      const history = await deps.loadAdminChatHistory(chatSession.id);
      return deps.json({ session: chatSession, history });
    }

    if (
      (url.pathname === "/api/admin/chat" || url.pathname === "/api/admin/chat/proactive") &&
      request.method === "POST"
    ) {
      try {
        const body = await deps.parseBody(request, adminChatSchema);
        const chatSession = await deps.resolveAdminChatSession(session.user.id, body.sessionId);
        if (!chatSession) return deps.json({ error: "Chat session not found" }, 404);
        const userMessageId = deps.makeId("adminchatmsg");
        const userMessage = {
          id: userMessageId,
          role: "user",
          body: body.message,
          createdAt: new Date().toISOString(),
        };

        const proactiveContext = body.proactive
          ? await deps.getSupportCrmContext(body.customerUserId ?? session.user.id)
          : null;
        const responseData = await deps.sendN8nAdminChat({
          sessionId: chatSession.id,
          message: body.proactive
            ? `Proactively review the customer situation and suggest one safe next conversation step.\n\n${body.message}`
            : body.message,
          contextType:
            body.contextType ?? (body.proactive ? "proactive_customer_conversation" : null),
          contextId: body.contextId ?? body.ticketId ?? body.customerUserId,
          conversationHistory: body.conversationHistory,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            allowMutations: false,
            proactiveContext,
          },
          idempotencyKey: `admin-chat:${chatSession.id}:${userMessageId}`,
        });
        const normalizedResponse = unwrapAiResponseEnvelope(responseData);
        const responseRecord =
          normalizedResponse &&
          typeof normalizedResponse === "object" &&
          !Array.isArray(normalizedResponse)
            ? (normalizedResponse as Record<string, any>)
            : {};
        const responseTicket =
          responseRecord.ticket && typeof responseRecord.ticket === "object"
            ? responseRecord.ticket
            : {};
        const ticketCreationRequested =
          responseRecord.createTicket === true ||
          responseRecord.action === "create_ticket" ||
          responseTicket.create === true ||
          responseTicket.created === true ||
          /\b(?:create|open|log|raise)\b[\s\S]{0,40}\bticket\b/i.test(body.message);
        const targetEmail = [
          responseTicket.customerEmail,
          responseTicket.email,
          responseRecord.customerEmail,
          responseRecord.email,
          body.message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
        ].find((value) => typeof value === "string" && value.includes("@"));
        const targetUserId =
          body.customerUserId ??
          (typeof responseTicket.customerUserId === "string"
            ? responseTicket.customerUserId
            : null) ??
          (typeof responseRecord.customerUserId === "string"
            ? responseRecord.customerUserId
            : null) ??
          (typeof responseRecord.userId === "string" ? responseRecord.userId : null);
        let ticket: any = null;
        let ticketCreation: { created: boolean; reason?: string; ticket?: any } = {
          created: false,
        };
        if (ticketCreationRequested) {
          const resolvedUser = targetUserId
            ? await deps.db.query.user.findFirst({ where: eq(user.id, targetUserId) })
            : targetEmail
              ? (
                  await deps.db
                    .select()
                    .from(user)
                    .where(sql`lower(${user.email}) = ${String(targetEmail).trim().toLowerCase()}`)
                    .limit(1)
                )[0]
              : null;
          if (!resolvedUser) {
            ticketCreation = {
              created: false,
              reason: "The requested customer could not be resolved to a CloudMonkey account.",
            };
          } else {
            const aiSessionId = `admin-chat:${chatSession.id}:${userMessageId}`;
            const existingTicket = await deps.db.query.supportTicket.findFirst({
              where: eq(supportTicket.aiSessionId, aiSessionId),
            });
            if (existingTicket) {
              ticket = existingTicket;
            } else {
              const subject =
                String(responseTicket.subject ?? responseRecord.subject ?? body.message)
                  .slice(0, 120)
                  .trim() || "Admin AI support request";
              const description = String(
                responseTicket.description ?? responseRecord.description ?? body.message,
              ).slice(0, 10000);
              const requestedPriority = responseTicket.priority ?? responseRecord.priority;
              const priority = ["low", "medium", "high", "urgent"].includes(requestedPriority)
                ? requestedPriority
                : "medium";
              const category = String(
                responseTicket.category ?? responseRecord.category ?? "general",
              ).slice(0, 80);
              [ticket] = await deps.db
                .insert(supportTicket)
                .values({
                  id: deps.makeId("ticket"),
                  userId: resolvedUser.id,
                  subject,
                  description,
                  priority,
                  status: "open",
                  category,
                  source: "admin_ai",
                  aiSessionId,
                  lastCustomerMessageAt: new Date(),
                })
                .returning();
              await deps.recordAudit({
                actorUserId: session.user.id,
                action: "admin.ticket.created",
                entityType: "support_ticket",
                entityId: ticket.id,
                message: `Admin AI opened support ticket for ${resolvedUser.email}: ${subject}`,
                metadata: { customerUserId: resolvedUser.id, customerEmail: resolvedUser.email },
              });
            }
            ticketCreation = { created: true, ticket };
          }
        }
        const botMessage = {
          id: deps.makeId("adminchatmsg"),
          role: "assistant",
          body: extractAiResponseText(responseData, "I have logged this for the team."),
          createdAt: new Date().toISOString(),
        };
        if (deps.adminChatMessage) {
          await deps.db.insert(deps.adminChatMessage).values({
            id: userMessageId,
            sessionId: chatSession.id,
            userId: session.user.id,
            role: "user",
            body: body.message,
          });
          await deps.db.insert(deps.adminChatMessage).values({
            id: botMessage.id,
            sessionId: chatSession.id,
            userId: null,
            role: "assistant",
            body: botMessage.body,
            metadata: JSON.stringify({
              proactive: body.proactive,
              contextType: body.contextType ?? null,
              ticketCreation: {
                created: ticketCreation.created,
                reason: ticketCreation.reason ?? null,
                ticketId: ticket?.id ?? null,
              },
            }),
          });
        }
        return deps.json({
          session: chatSession,
          userMessage,
          botMessage,
          ticket: ticketCreation.created ? ticket : null,
          ticketCreation: {
            created: ticketCreation.created,
            reason: ticketCreation.reason ?? null,
          },
          response: responseData,
        });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminServerN8n(request: Request): Promise<Response> {
    const { response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    if (url.pathname === "/api/admin/server-n8n" && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, serverN8nSchema);
        const [integration] = await deps.db
          .insert(serverN8nIntegration)
          .values({
            id: deps.makeId("n8n"),
            instanceId: body.instanceId,
            userId: body.instanceId
              ? ((
                  await deps.db.query.vultrInstance.findFirst({
                    where: eq(vultrInstance.id, body.instanceId),
                  })
                )?.userId ?? null)
              : null,
            baseUrl: body.baseUrl,
            apiKeySecret: body.apiKey,
            status: "configured",
            updatedAt: new Date(),
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: serverN8nIntegration.instanceId,
            set: {
              baseUrl: body.baseUrl,
              apiKeySecret: body.apiKey,
              status: "configured",
              updatedAt: new Date(),
            },
          })
          .returning();
        return deps.json({ ok: true, integration: deps.sanitizeN8nIntegration(integration) });
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname === "/api/admin/server-n8n/sync" && request.method === "POST") {
      try {
        const body = await deps.parseBody(request, z.object({ instanceId: z.string().min(1) }));
        const integration = await deps.db.query.serverN8nIntegration.findFirst({
          where: eq(serverN8nIntegration.instanceId, body.instanceId),
        });
        if (!integration) return deps.json({ error: "n8n integration not found" }, 404);
        const result = await deps.syncN8nWorkflows(integration);
        return deps.json(result);
      } catch (error: any) {
        return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }
    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminM365(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);

    if (url.pathname === "/api/admin/m365/auth/start" && request.method === "GET") {
      try {
        const returnTo =
          url.searchParams.get("returnTo") ?? "/dashboard/cloud-security?m365=connected";
        const state = deps.signMicrosoft365State({ userId: session.user.id, returnTo });
        const { clientId } = deps.microsoft365ClientConfig();
        const authUrl = new URL(
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        );
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("redirect_uri", deps.microsoft365RedirectUri(request));
        authUrl.searchParams.set("response_mode", "query");
        authUrl.searchParams.set("scope", deps.microsoft365Scopes());
        authUrl.searchParams.set("state", state);
        return Response.redirect(authUrl.toString(), 302);
      } catch (error: any) {
        return deps.json({ error: error.message }, error.status ?? 500);
      }
    }

    if (url.pathname === "/api/admin/m365/auth/callback" && request.method === "GET") {
      try {
        const code = url.searchParams.get("code");
        const state = deps.verifyMicrosoft365State(url.searchParams.get("state"), session.user.id);
        if (!code) return deps.json({ error: "Missing authorization code" }, 400);
        const token = await deps.exchangeMicrosoft365Code({
          code,
          redirectUri: deps.microsoft365RedirectUri(request),
        });
        const [created] = await deps.db
          .insert(microsoft365Tenant)
          .values({
            id: deps.makeId("m365"),
            tenantId: state.userId,
            displayName: null,
            defaultDomain: null,
            connectedAccountEmail: null,
            connectedByUserId: session.user.id,
            scopes: token.scope ?? deps.microsoft365Scopes(),
            refreshTokenSecret: token.refresh_token,
            status: "connected",
            userCount: null,
            secureScoreCurrent: null,
            secureScoreMax: null,
            secureScorePercent: null,
            serviceHealthStatus: null,
            serviceIssueCount: 0,
            lastSyncAt: null,
            lastError: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: microsoft365Tenant.tenantId,
            set: {
              connectedByUserId: session.user.id,
              scopes: token.scope ?? deps.microsoft365Scopes(),
              refreshTokenSecret: token.refresh_token,
              status: "connected",
              updatedAt: new Date(),
            },
          })
          .returning();
        return Response.redirect(state.returnTo ?? "/dashboard/cloud-security?m365=connected", 302);
      } catch (error: any) {
        return Response.redirect(
          `/dashboard/cloud-security?m365_error=${encodeURIComponent(error.message)}`,
          302,
        );
      }
    }

    if (url.pathname === "/api/admin/m365/tenants" && request.method === "GET") {
      const rows = await deps.db.query.microsoft365Tenant.findMany({
        orderBy: (row: any, { desc }: any) => [desc(row.updatedAt)],
      });
      return deps.json(rows);
    }

    const tenantMatch = url.pathname.match(/^\/api\/admin\/m365\/tenants\/([^/]+)$/);
    if (tenantMatch && request.method === "DELETE") {
      const tenantId = decodeURIComponent(tenantMatch[1]);
      await deps.db.delete(microsoft365Tenant).where(eq(microsoft365Tenant.tenantId, tenantId));
      return deps.json({ ok: true });
    }

    const syncMatch = url.pathname.match(/^\/api\/admin\/m365\/tenants\/([^/]+)\/sync$/);
    if (syncMatch && request.method === "POST") {
      const tenantId = decodeURIComponent(syncMatch[1]);
      const row = await deps.db.query.microsoft365Tenant.findFirst({
        where: eq(microsoft365Tenant.tenantId, tenantId),
      });
      if (!row) return deps.json({ error: "Tenant not found" }, 404);
      const updated = await deps.syncMicrosoft365Tenant(row);
      return deps.json(updated);
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminPlatformCredentials(request: Request): Promise<Response> {
    const { session, response } = await deps.requireAdmin(request);
    if (response) return response;
    const url = new URL(request.url);
    const match = url.pathname.match(
      /^\/api\/admin\/platform-credentials(?:\/([^/]+))?(?:\/(verify))?$/,
    );
    const credentialId = match?.[1] ? decodeURIComponent(match[1]) : null;
    const action = match?.[2];

    if (request.method === "GET") {
      const credentials = await deps.db.query.platformApiCredential.findMany({
        orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
      });
      const usage = await deps.db.query.platformApiUsage.findMany({
        orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
        limit: 500,
      });
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      const safeCredentials = credentials.map((credential: any) => {
        const rows = usage.filter(
          (item: any) =>
            item.credentialId === credential.id && new Date(item.createdAt) >= currentMonth,
        );
        const recent = usage
          .filter((item: any) => item.credentialId === credential.id)
          .slice(0, 10)
          .map((item: any) => ({
            id: item.id,
            provider: item.provider,
            model: item.model,
            featureKey: item.featureKey,
            inputTokens: item.inputTokens,
            outputTokens: item.outputTokens,
            providerCostMicrousd: item.providerCostMicrousd,
            chargedCostMicrousd: item.chargedCostMicrousd,
            chargedTokens: item.chargedTokens,
            createdAt: item.createdAt,
          }));
        const monthlySpendMicrousd = rows.reduce(
          (total: number, item: any) => total + Number(item.providerCostMicrousd ?? 0),
          0,
        );
        return {
          id: credential.id,
          provider: credential.provider,
          label: credential.label,
          keyLastFour: credential.keyLastFour,
          status: credential.status,
          createdAt: credential.createdAt,
          lastVerifiedAt: credential.lastVerifiedAt,
          monthlySpendCap: credential.monthlySpendCap,
          monthlySpendMicrousd,
          runwayPercent: credential.monthlySpendCap
            ? Math.max(0, Math.round((1 - monthlySpendMicrousd / credential.monthlySpendCap) * 100))
            : null,
          recentUsage: recent,
        };
      });
      return deps.json(safeCredentials);
    }

    if (request.method === "POST" && !credentialId) {
      const body = z
        .object({
          provider: z.enum(PLATFORM_PROVIDERS),
          label: z.string().trim().min(1).max(120),
          apiKey: z.string().min(8),
          monthlySpendCap: z.coerce.number().int().positive().nullable().optional(),
        })
        .parse(await request.json());
      const [created] = await deps.db
        .insert(platformApiCredential)
        .values({
          id: deps.makeId("platformkey"),
          provider: body.provider,
          label: body.label,
          keyEncrypted: deps.encryptSecret(body.apiKey),
          keyLastFour: body.apiKey.slice(-4),
          status: "active",
          monthlySpendCap: body.monthlySpendCap ?? null,
          createdAt: new Date(),
        })
        .returning();
      await deps.recordAudit({
        actorUserId: session.user.id,
        action: "platform_api_credential.created",
        entityType: "platform_api_credential",
        entityId: created.id,
        message: `${body.provider} platform credential added`,
        metadata: { provider: body.provider, label: body.label, keyLastFour: created.keyLastFour },
      });
      return deps.json({ ...created, keyEncrypted: undefined }, 201);
    }

    if (!credentialId) return deps.json({ error: "Credential not found" }, 404);
    const existing = await deps.db.query.platformApiCredential.findFirst({
      where: eq(platformApiCredential.id, credentialId),
    });
    if (!existing) return deps.json({ error: "Credential not found" }, 404);

    if (request.method === "PUT" && !action) {
      const body = z
        .object({
          apiKey: z.string().min(8).optional(),
          status: z.enum(PLATFORM_CREDENTIAL_STATUSES).optional(),
          label: z.string().trim().min(1).max(120).optional(),
          monthlySpendCap: z.coerce.number().int().positive().nullable().optional(),
        })
        .parse(await request.json());
      const [updated] = await deps.db
        .update(platformApiCredential)
        .set({
          ...(body.apiKey
            ? {
                keyEncrypted: deps.encryptSecret(body.apiKey),
                keyLastFour: body.apiKey.slice(-4),
                status: "active",
              }
            : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.label ? { label: body.label } : {}),
          ...(body.monthlySpendCap !== undefined ? { monthlySpendCap: body.monthlySpendCap } : {}),
        })
        .where(eq(platformApiCredential.id, credentialId))
        .returning();
      return deps.json({ ...updated, keyEncrypted: undefined });
    }

    if (request.method === "POST" && action === "verify") {
      const secret = deps.decryptSecret(existing.keyEncrypted);
      const headers: Record<string, string> = {};
      let endpoint = "";
      if (existing.provider === "gemini") {
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`;
      } else if (existing.provider === "openai") {
        endpoint = "https://api.openai.com/v1/models";
        headers.Authorization = `Bearer ${secret}`;
      } else if (existing.provider === "anthropic") {
        endpoint = "https://api.anthropic.com/v1/models";
        headers["x-api-key"] = secret;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        endpoint = "https://api.mailjet.com/v3/REST/myprofile";
        const [key, secretValue] = secret.split(":");
        headers.Authorization = `Basic ${Buffer.from(`${key}:${secretValue ?? ""}`).toString("base64")}`;
      }
      const check = await fetch(endpoint, { headers, signal: AbortSignal.timeout(10_000) });
      if (!check.ok) {
        await deps.db
          .update(platformApiCredential)
          .set({ status: "invalid" })
          .where(eq(platformApiCredential.id, credentialId));
        return deps.json({ error: `Provider verification failed (${check.status})` }, 502);
      }
      const [verified] = await deps.db
        .update(platformApiCredential)
        .set({ status: "active", lastVerifiedAt: new Date() })
        .where(eq(platformApiCredential.id, credentialId))
        .returning();
      return deps.json({ ...verified, keyEncrypted: undefined });
    }

    return deps.json({ error: "Method not allowed" }, 405);
  }

  async function handleAdminRoot(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/users")) return handleAdminUsers(request);
    if (url.pathname.startsWith("/api/admin/leads")) return handleAdminLeads(request);
    if (url.pathname.startsWith("/api/admin/proposals")) return handleAdminProposals(request);
    if (url.pathname.startsWith("/api/admin/pitch-decks")) return handleAdminPitchDecks(request);
    if (url.pathname.startsWith("/api/admin/onboarding")) return handleAdminOnboarding(request);
    if (url.pathname.startsWith("/api/admin/assign-vultr") && request.method === "POST") {
      return handleAssignVultr(request);
    }
    if (url.pathname.startsWith("/api/admin/products")) return handleAdminProducts(request);
    if (url.pathname.startsWith("/api/admin/customers")) return handleAdminCustomers(request);
    if (url.pathname.startsWith("/api/admin/tickets")) return handleAdminTickets(request);
    if (url.pathname.startsWith("/api/admin/agents")) return handleAdminAgents(request);
    if (url.pathname.startsWith("/api/admin/audit-logs")) return handleAdminAuditLogs(request);
    if (url.pathname.startsWith("/api/admin/settings")) return handleAdminSettings(request);
    if (url.pathname.startsWith("/api/admin/platform-matrix"))
      return handleAdminPlatformMatrix(request);
    if (url.pathname.startsWith("/api/admin/server-status"))
      return handleAdminServerStatus(request);
    if (url.pathname.startsWith("/api/admin/website-health"))
      return handleAdminWebsiteHealth(request);
    if (url.pathname.startsWith("/api/admin/server-n8n")) return handleAdminServerN8n(request);
    if (url.pathname.startsWith("/api/admin/chat")) return handleAdminChat(request);
    if (url.pathname.startsWith("/api/admin/m365")) return handleAdminM365(request);
    if (url.pathname.startsWith("/api/admin/platform-credentials"))
      return handleAdminPlatformCredentials(request);
    return deps.json({ error: "Method not allowed" }, 405);
  }

  return {
    handleAdminUsers,
    handleAdminLeads,
    handleAdminProposals,
    handleAdminPitchDecks,
    handleAdminOnboarding,
    handleAssignVultr,
    handleAdminTickets,
    handleAdminAgents,
    handleAdminCustomers,
    handleAdminProducts,
    handleAdminAuditLogs,
    handleAdminSettings,
    handleAdminPlatformMatrix,
    handleAdminServerStatus,
    handleAdminWebsiteHealth,
    handleAdminServerN8n,
    handleAdminChat,
    handleAdminM365,
    handleAdminPlatformCredentials,
    handleAdminRoot,
  };
}

function makeProposalNumber(id: string, createdAt: Date) {
  return `PROP-${createdAt.getFullYear()}-${id.slice(-6).toUpperCase()}`;
}

function catalogBilling(item: any) {
  const frequency = String(item.billingFrequency ?? "").toLowerCase();
  const unit = String(item.unit ?? "").toLowerCase();
  const onceOff =
    frequency === "once_off" || item.billingType === "once_off" || unit.includes("once");
  return {
    recurring: !onceOff,
    interval: frequency === "year" || unit.includes("year") ? "year" : "month",
  } as const;
}

async function resolveProposalLines(db: any, items: Array<any>) {
  const resolved = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const planId = item.planId ?? (item.productType === "plan" ? item.productId : null);
    const bundleId = item.bundleId ?? (item.productType === "bundle" ? item.productId : null);
    const plan = planId
      ? await db.query.servicePlan.findFirst({
          where: eq(servicePlan.id, planId),
          with: { service: true, features: true },
        })
      : null;
    const selectedBundle =
      !plan && bundleId
        ? await db.query.bundle.findFirst({
            where: eq(bundle.id, bundleId),
            with: { features: true },
          })
        : null;
    const catalogItem = plan ?? selectedBundle;
    const billing = catalogBilling(catalogItem ?? item);
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    const unitPrice = toCents(item.unitPrice ?? item.price ?? item.amount) ?? 0;
    const setupPrice = toCents(item.setupPrice ?? item.setup ?? 0) ?? 0;
    const recurring = item.recurring ?? billing.recurring;

    resolved.push({
      name:
        item.name ??
        (plan ? `${plan.service?.name ? `${plan.service.name} - ` : ""}${plan.name}` : null) ??
        selectedBundle?.name ??
        item.planId ??
        item.bundleId ??
        item.productId ??
        "Custom CloudMonkey service",
      description:
        item.description ??
        plan?.serviceNote ??
        plan?.tagline ??
        selectedBundle?.serviceNote ??
        selectedBundle?.categoryNote ??
        null,
      productType: plan ? "plan" : selectedBundle ? "bundle" : "custom",
      productId: catalogItem?.id ?? item.productId ?? null,
      planId: plan?.id ?? null,
      bundleId: selectedBundle?.id ?? null,
      quantity,
      unitPrice,
      setupPrice,
      recurring,
      interval: item.interval ?? billing.interval,
      sortOrder: index,
      serviceDefinition: catalogItem?.serviceDefinition ?? null,
      features: JSON.stringify(catalogItem?.features?.map((feature: any) => feature.content) ?? []),
      lineTotal: quantity * (unitPrice + setupPrice),
    });
  }
  return resolved;
}

function proposalTotals(lines: Array<any>) {
  const setupTotal = lines.reduce((sum, row) => sum + row.setupPrice * row.quantity, 0);
  const recurringTotal = lines.reduce(
    (sum, row) => sum + (row.recurring ? row.unitPrice * row.quantity : 0),
    0,
  );
  const onceOffTotal = lines.reduce(
    (sum, row) => sum + (!row.recurring ? row.unitPrice * row.quantity : 0),
    0,
  );
  const subtotal = setupTotal + recurringTotal + onceOffTotal;
  return {
    subtotal,
    setupTotal,
    recurringTotal,
    total: subtotal,
  };
}
