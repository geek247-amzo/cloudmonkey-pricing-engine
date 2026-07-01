import { auth } from "./lib/auth";
import "./lib/error-capture";
import * as crypto from "crypto";
import * as tls from "tls";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import postgres from "postgres";
import { db } from "./db";
import {
  aiAgent,
  auditLog,
  account,
  affiliate,
  affiliateCommission,
  affiliateFraudFlag,
  affiliatePayout,
  affiliateReferral,
  bundle,
  domainOrder,
  invoice,
  invoiceItem,
  intelligenceCompetitor,
  intelligenceContentGap,
  intelligenceCrawlPage,
  intelligenceIntegration,
  intelligenceJob,
  intelligenceKeyword,
  intelligenceKeywordRanking,
  intelligencePageIssue,
  intelligenceProject,
  intelligenceRecommendation,
  intelligenceReport,
  intelligenceScheduledReport,
  intelligenceSeoAudit,
  intelligenceSerpResult,
  lead,
  onboardingSubmission,
  registeredDomain,
  servicePlan,
  session as sessionTable,
  detectedAiRuntime,
  serverAgent,
  serverContainer,
  serverDatabase,
  serverN8nIntegration,
  serverN8nWorkflow,
  serverSecurityFinding,
  serverTelemetrySnapshot,
  serverWebsite,
  subscription,
  supportChatMessage,
  supportChatAttachment,
  supportChatSession,
  supportKnowledgeChunk,
  supportKnowledgeSource,
  supportLearningEvent,
  supportTicket,
  supportTicketComment,
  storeOrder,
  storePayment,
  storeProduct,
  storeProductVariant,
  user,
  vultrInstance,
  website,
  websiteApprovalToken,
  websiteDesignOption,
  websiteDomain,
  websitePluginInstall,
  websiteReviewRequest,
  websiteRuntimeServer,
  websiteStore,
  websiteStoreDatabase,
  workspaceSettings,
} from "./db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { listInstances, listPlans, startInstance, stopInstance, rebootInstance, reinstallInstance } from "./lib/vultr";
import { initializePayment, verifyPayment } from "./lib/paystack";
import { sendEmail } from "./lib/email";
import { buildInvoiceDocumentData, getWorkspaceBillingDetails, renderInvoiceHtml } from "./lib/invoice-document";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const adminRoles = new Set(["admin", "owner"]);
const CHAT_UPLOAD_DIR = process.env.CHAT_UPLOAD_DIR ?? "/app/uploads";
const WEBSITE_UPLOAD_DIR = process.env.WEBSITE_UPLOAD_DIR ?? path.join(CHAT_UPLOAD_DIR, "website-designs");
const CHAT_MAX_IMAGE_BYTES = Number(process.env.CHAT_MAX_IMAGE_MB ?? 10) * 1024 * 1024;
const CHAT_MAX_AUDIO_BYTES = Number(process.env.CHAT_MAX_AUDIO_MB ?? 25) * 1024 * 1024;
const WEBSITE_MAX_DESIGN_BYTES = Number(process.env.WEBSITE_MAX_DESIGN_MB ?? 15) * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_CHAT_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"]);
const ALLOWED_WEBSITE_DESIGN_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function json(data: unknown, init?: ResponseInit | number) {
  const status = typeof init === "number" ? init : init?.status;
  const headers = typeof init === "number" ? undefined : init?.headers;
  return new Response(JSON.stringify(data), {
    ...(typeof init === "number" ? {} : init),
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const publicSitemapEntries = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/cloud", priority: "0.9", changefreq: "weekly" },
  { path: "/business", priority: "0.9", changefreq: "weekly" },
  { path: "/ai", priority: "0.9", changefreq: "weekly" },
  { path: "/ai-agents", priority: "0.9", changefreq: "weekly" },
  { path: "/domains", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly" },
  { path: "/affiliates", priority: "0.6", changefreq: "monthly" },
] as const;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderSitemapXml() {
  const siteOrigin = "https://cloudmonkey.co.za";
  const today = new Date().toISOString().slice(0, 10);
  const urls = publicSitemapEntries.map((entry) => {
    const loc = `${siteOrigin}${entry.path === "/" ? "" : entry.path}`;
    return [
      "  <url>",
      `    <loc>${xmlEscape(loc)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function isIntelligencePlanId(planId: string | null | undefined) {
  return Boolean(planId?.startsWith("ci-") || planId === "agent-marketing");
}

function isWebsitePlanId(planId: string | null | undefined) {
  return Boolean(planId?.startsWith("web-") || planId?.startsWith("ecom-"));
}

function websiteWizardReturnPath(planId: string | null | undefined) {
  if (isWebsitePlanId(planId)) return "/dashboard/website-wizard";
  if (isIntelligencePlanId(planId)) return "/dashboard/intelligence-wizard";
  return "/dashboard/ai-wizard";
}

function isAdmin(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
  return !!session && adminRoles.has(session.user.role);
}

async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { response: new Response("Unauthorized", { status: 401 }) };
  return { session };
}

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!isAdmin(session)) return { response: new Response("Unauthorized", { status: 401 }) };
  return { session };
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeFileName(value: string) {
  const cleaned = value.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").slice(0, 120);
  return cleaned || "upload";
}

function getAttachmentKind(mimeType: string) {
  if (ALLOWED_CHAT_IMAGE_TYPES.has(mimeType)) return "image";
  if (ALLOWED_CHAT_AUDIO_TYPES.has(mimeType)) return "audio";
  return null;
}

function maxBytesForAttachment(kind: string) {
  return kind === "image" ? CHAT_MAX_IMAGE_BYTES : CHAT_MAX_AUDIO_BYTES;
}

function publicAttachmentUrl(id: string) {
  return `/api/user/support-chat/uploads/${encodeURIComponent(id)}`;
}

function attachmentDto(row: typeof supportChatAttachment.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    messageId: row.messageId,
    kind: row.kind,
    mimeType: row.mimeType,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    transcript: row.transcript,
    metadata: safeJsonParse(row.metadata),
    url: publicAttachmentUrl(row.id),
    createdAt: row.createdAt,
  };
}

const affiliateTierRules = {
  starter: {
    label: "Starter Affiliate",
    commissionType: "once_off",
    commissionRateBps: 1000,
    recurringDurationMonths: 1,
  },
  growth: {
    label: "Growth Partner",
    commissionType: "recurring",
    commissionRateBps: 2000,
    recurringDurationMonths: 6,
  },
  strategic: {
    label: "Strategic Partner",
    commissionType: "recurring",
    commissionRateBps: 3500,
    recurringDurationMonths: 12,
  },
} as const;

type AffiliateTier = keyof typeof affiliateTierRules;

function normalizeAffiliateTier(value: string | null | undefined): AffiliateTier {
  return value === "growth" || value === "strategic" ? value : "starter";
}

function getAffiliateTierRule(value: string | null | undefined) {
  return affiliateTierRules[normalizeAffiliateTier(value)];
}

function generateReferralCode(nameOrEmail: string) {
  const base = nameOrEmail
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12) || "partner";
  return `${base}${crypto.randomBytes(3).toString("hex")}`;
}

function buildReferralLink(origin: string, code: string) {
  return `${origin}/auth/sign-up?ref=${encodeURIComponent(code)}`;
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? null;
}

function canGenerateCommission(status: string | null | undefined) {
  return status === "approved" || status === "active";
}

function sanitizeAffiliate(row: typeof affiliate.$inferSelect, origin: string, includePayout = false) {
  let payoutDetails: string | undefined;
  if (includePayout && row.payoutDetails) {
    try {
      payoutDetails = decryptSecret(row.payoutDetails);
    } catch (error) {
      payoutDetails = undefined;
    }
  }
  return {
    ...row,
    payoutDetails,
    referralLink: buildReferralLink(origin, row.referralCode),
  };
}

async function generateUniqueReferralCode(nameOrEmail: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = attempt === 0
      ? generateReferralCode(nameOrEmail)
      : `${generateReferralCode(nameOrEmail)}${crypto.randomBytes(attempt + 1).toString("hex")}`;
    const existing = await db.query.affiliate.findFirst({
      where: eq(affiliate.referralCode, code),
    });
    if (!existing) return code;
  }
  return `${generateReferralCode(nameOrEmail)}${crypto.randomBytes(2).toString("hex")}`;
}

async function createFraudFlag(input: {
  affiliateId?: string | null;
  referralId?: string | null;
  customerId?: string | null;
  flagType: string;
  detail: string;
  severity?: string;
  metadata?: unknown;
}) {
  await db.insert(affiliateFraudFlag).values({
    id: makeId("affflag"),
    affiliateId: input.affiliateId ?? null,
    referralId: input.referralId ?? null,
    customerId: input.customerId ?? null,
    flagType: input.flagType,
    severity: input.severity ?? "review",
    detail: input.detail,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

async function attributeSignupToAffiliate(input: {
  userId: string;
  email: string;
  referralCode?: string | null;
  visitorId?: string | null;
  request: Request;
}) {
  const code = input.referralCode?.trim();
  if (!code) return null;

  const affiliateRow = await db.query.affiliate.findFirst({
    where: eq(affiliate.referralCode, code),
  });
  if (!affiliateRow) return null;

  const now = new Date();
  const clickedAfter = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const candidateRows = await db.query.affiliateReferral.findMany({
    where: eq(affiliateReferral.referralCode, code),
    orderBy: (affiliateReferral, { desc }) => [desc(affiliateReferral.clickedAt)],
  });
  const click = candidateRows.find((row) => {
    if (row.customerId) return false;
    return new Date(row.clickedAt).getTime() >= clickedAfter;
  });
  const customerRow = await db.query.user.findFirst({
    where: eq(user.id, input.userId),
  });
  if (customerRow) {
    const userCreatedAt = new Date(customerRow.createdAt).getTime();
    if (click && userCreatedAt < new Date(click.clickedAt).getTime()) return null;
    if (!click && now.getTime() - userCreatedAt > 10 * 60 * 1000) return null;
  }

  const rule = getAffiliateTierRule(affiliateRow.tier);
  const [referral] = click
    ? await db.update(affiliateReferral).set({
        customerId: input.userId,
        status: "signup",
        signedUpAt: now,
        tierAtSignup: affiliateRow.tier,
        commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
        commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
        recurringDurationMonthsAtSignup: affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
      }).where(eq(affiliateReferral.id, click.id)).returning()
    : await db.insert(affiliateReferral).values({
        id: makeId("affref"),
        affiliateId: affiliateRow.id,
        referralCode: code,
        visitorId: input.visitorId ?? null,
        customerId: input.userId,
        sourceUrl: null,
        landingPage: new URL(input.request.url).pathname,
        ipAddress: getClientIp(input.request),
        userAgent: input.request.headers.get("user-agent"),
        attributionType: "signup",
        status: "signup",
        signedUpAt: now,
        tierAtSignup: affiliateRow.tier,
        commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
        commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
        recurringDurationMonthsAtSignup: affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
      }).returning();

  if (affiliateRow.email.toLowerCase() === input.email.toLowerCase() || affiliateRow.userId === input.userId) {
    await createFraudFlag({
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.userId,
      flagType: "self_referral",
      severity: "high",
      detail: "Affiliate and referred customer appear to be the same person.",
    });
  }

  if (referral.ipAddress && referral.ipAddress === getClientIp(input.request)) {
    await createFraudFlag({
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.userId,
      flagType: "same_ip",
      detail: "Referral click and customer signup used the same IP address.",
    });
  }

  await recordAudit({
    actorUserId: input.userId,
    action: "affiliate.referral.attributed",
    entityType: "affiliate_referral",
    entityId: referral.id,
    message: `Signup attributed to affiliate ${affiliateRow.email}`,
    metadata: { affiliateId: affiliateRow.id, referralCode: code },
  });

  return referral;
}

async function createAffiliateCommissionForPayment(input: {
  invoiceId: string;
  customerId: string;
  amount: number;
  subscriptionId?: string | null;
  paymentId?: string | null;
}) {
  const existing = await db.query.affiliateCommission.findFirst({
    where: eq(affiliateCommission.invoiceId, input.invoiceId),
  });
  if (existing) return existing;

  const referrals = await db.query.affiliateReferral.findMany({
    where: eq(affiliateReferral.customerId, input.customerId),
    orderBy: (affiliateReferral, { desc }) => [desc(affiliateReferral.signedUpAt)],
  });
  const referral = referrals[0];
  if (!referral) return null;

  const affiliateRow = await db.query.affiliate.findFirst({
    where: eq(affiliate.id, referral.affiliateId),
  });
  if (!affiliateRow) return null;

  if (!canGenerateCommission(affiliateRow.status)) {
    await createFraudFlag({
      affiliateId: affiliateRow.id,
      referralId: referral.id,
      customerId: input.customerId,
      flagType: "inactive_affiliate_payment",
      detail: "A referred customer paid while the affiliate was not approved or active.",
    });
    return null;
  }

  const commissions = await db.query.affiliateCommission.findMany({
    where: eq(affiliateCommission.customerId, input.customerId),
  });
  const commissionType = referral.commissionTypeAtSignup ?? affiliateRow.commissionType;
  const commissionRateBps = referral.commissionRateBpsAtSignup ?? affiliateRow.commissionRateBps;
  const recurringDurationMonths = referral.recurringDurationMonthsAtSignup ?? affiliateRow.recurringDurationMonths;
  const priorCommissionCount = commissions.filter((row) => row.affiliateId === affiliateRow.id && row.status !== "cancelled" && row.status !== "reversed").length;
  const nextMonthNumber = priorCommissionCount + 1;

  if (commissionType === "once_off" && priorCommissionCount > 0) return null;
  if (commissionType === "recurring" && nextMonthNumber > recurringDurationMonths) return null;

  const holdUntilDate = new Date();
  holdUntilDate.setDate(holdUntilDate.getDate() + 30);
  const commissionAmount = Math.round((input.amount * commissionRateBps) / 10000);

  const [created] = await db.insert(affiliateCommission).values({
    id: makeId("affcom"),
    affiliateId: affiliateRow.id,
    referralId: referral.id,
    customerId: input.customerId,
    paymentId: input.paymentId ?? input.invoiceId,
    invoiceId: input.invoiceId,
    subscriptionId: input.subscriptionId ?? input.invoiceId,
    commissionType,
    commissionRateBps,
    commissionAmount,
    commissionMonthNumber: nextMonthNumber,
    status: "pending",
    holdUntilDate,
  }).returning();

  await db.update(affiliateReferral).set({
    status: "converted",
    convertedAt: new Date(),
  }).where(eq(affiliateReferral.id, referral.id));

  await recordAudit({
    action: "affiliate.commission.created",
    entityType: "affiliate_commission",
    entityId: created.id,
    message: `Affiliate commission created for invoice ${input.invoiceId}`,
    metadata: { affiliateId: affiliateRow.id, customerId: input.customerId, amount: input.amount },
  });

  return created;
}

function affiliateSummary(input: {
  referrals: Array<typeof affiliateReferral.$inferSelect>;
  commissions: Array<typeof affiliateCommission.$inferSelect>;
}) {
  const clicks = input.referrals.filter((row) => row.status === "clicked").length;
  const signups = input.referrals.filter((row) => !!row.customerId || !!row.signedUpAt).length;
  const payingCustomers = new Set(input.commissions.map((row) => row.customerId)).size;
  const totalClicks = input.referrals.length;
  return {
    totalClicks,
    totalLeads: input.referrals.filter((row) => row.leadId).length,
    totalSignups: signups,
    totalPayingCustomers: payingCustomers,
    conversionRate: totalClicks ? Math.round((signups / totalClicks) * 1000) / 10 : 0,
    pendingCommission: input.commissions.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.commissionAmount, 0),
    approvedCommission: input.commissions.filter((row) => row.status === "approved" || row.status === "payable").reduce((sum, row) => sum + row.commissionAmount, 0),
    paidCommission: input.commissions.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.commissionAmount, 0),
    cancelledCommission: input.commissions.filter((row) => row.status === "cancelled" || row.status === "reversed").reduce((sum, row) => sum + row.commissionAmount, 0),
  };
}

function getSecretEncryptionKey() {
  const source = process.env.BETTER_AUTH_SECRET ?? process.env.POSTGRES_PASSWORD ?? "cloudmonkey-local-dev-secret";
  return crypto.createHash("sha256").update(source).digest();
}

function encryptSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  const [, version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported agent secret format");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getSecretEncryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function slugifySiteName(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `site-${crypto.randomBytes(3).toString("hex")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildStoreDatabaseRecord(input: {
  websiteId: string;
  storeId: string;
  userId: string;
}) {
  const safeSuffix = input.websiteId.replace(/[^a-zA-Z0-9_]/g, "_").slice(-18).toLowerCase();
  const databaseName = `cm_${safeSuffix}`;
  const username = `cmu_${safeSuffix}`.slice(0, 32);
  const password = crypto.randomBytes(24).toString("base64url");
  const containerName = `cm_sql_${safeSuffix}`;
  const volumeName = `cm_sql_data_${safeSuffix}`;
  const host = containerName;
  const connectionString = `postgresql://${username}:${password}@${host}:5432/${databaseName}`;

  return {
    id: makeId("storedb"),
    storeId: input.storeId,
    websiteId: input.websiteId,
    userId: input.userId,
    engine: "postgresql",
    version: "16-alpine",
    host,
    port: 5432,
    databaseName,
    username,
    passwordSecret: encryptSecret(password),
    connectionSecret: encryptSecret(connectionString),
    containerName,
    volumeName,
    status: "planned",
    backupStatus: "not_configured",
  };
}

function buildWebsiteProvisioningPlan(input: {
  websiteId: string;
  storeId: string;
  temporaryDomain: string;
  siteType: "website" | "ecommerce";
  database?: {
    containerName: string;
    volumeName: string;
    databaseName: string;
    username: string;
  };
}) {
  const baseImage = input.siteType === "ecommerce"
    ? "registry.cloudmonkey.co.za/cloudmonkey-commerce-template:pending"
    : "registry.cloudmonkey.co.za/cloudmonkey-website-template:pending";

  return {
    version: 1,
    runtime: "docker-compose",
    status: "planned",
    websiteId: input.websiteId,
    storeId: input.storeId,
    temporaryDomain: input.temporaryDomain,
    baseRepo: input.siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template",
    services: {
      storefront: {
        image: baseImage,
        containerName: `cm_site_${input.websiteId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`,
        internalPort: 3000,
        environment: {
          WEBSITE_ID: input.websiteId,
          STORE_ID: input.storeId,
          STORE_MODE: input.siteType,
          PUBLIC_BASE_URL: `https://${input.temporaryDomain}`,
          CLOUDMONKEY_API_URL: "https://cloudmonkey.co.za",
          ...(input.siteType === "ecommerce" ? { STORE_DATABASE_URL: "secret:website_store_database.connectionSecret" } : {}),
        },
        labels: {
          "cloudmonkey.website_id": input.websiteId,
          "cloudmonkey.store_id": input.storeId,
          "traefik.enable": "true",
          "traefik.http.routers.website.rule": `Host(\`${input.temporaryDomain}\`)`,
          "traefik.http.routers.website.tls": "true",
          "traefik.http.services.website.loadbalancer.server.port": "3000",
        },
        resources: {
          memory: input.siteType === "ecommerce" ? "768m" : "512m",
          cpus: input.siteType === "ecommerce" ? "0.75" : "0.50",
        },
      },
      ...(input.siteType === "ecommerce" ? {
        medusa: {
          image: "registry.cloudmonkey.co.za/cloudmonkey-medusa-template:pending",
          containerName: `cm_medusa_${input.websiteId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`,
          internalPort: 9000,
          redis: {
            containerName: "cloudmonkey-runtime-redis",
            prefix: `cm:${input.websiteId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`,
            mode: "shared",
          },
          routes: ["/api/*", "/store/*", "/auth/*", "/webhooks/*"],
          resources: {
            memory: "1024m",
            cpus: "1.00",
          },
        },
      } : {}),
      ...(input.siteType === "ecommerce" && input.database ? { sql: {
        image: "postgres:16-alpine",
        containerName: input.database.containerName,
        internalOnly: true,
        environment: {
          POSTGRES_DB: input.database.databaseName,
          POSTGRES_USER: input.database.username,
          POSTGRES_PASSWORD: "secret:website_store_database.passwordSecret",
        },
        volumes: [`${input.database.volumeName}:/var/lib/postgresql/data`],
        resources: {
          memory: "512m",
          cpus: "0.50",
        },
      } } : {}),
    },
    networks: ["cm_public", "cm_sites"],
  };
}

const DOCKER_API_URL = process.env.DOCKER_API_URL ?? "http://docker-socket-proxy:2375";
const DOCKER_NETWORK_NAME = process.env.DOCKER_NETWORK_NAME ?? "cloudmonkey_cloudmonkey-network";
const NGINX_SITE_CONF_DIR = process.env.NGINX_SITE_CONF_DIR ?? "/app/nginx/conf.d";
const NGINX_CONTAINER_NAME = process.env.NGINX_CONTAINER_NAME ?? "cloudmonkey-nginx-1";
const WEBSITE_BUILDER_ROOT = process.env.WEBSITE_BUILDER_ROOT ?? path.resolve(process.cwd(), "builders");

function dockerImageTag(websiteId: string) {
  return `cloudmonkey-storefront:${websiteId.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase()}`;
}

function tarHeader(name: string, size: number) {
  const header = Buffer.alloc(512, 0);
  const write = (value: string, offset: number, length: number) => header.write(value.slice(0, length), offset, "ascii");
  const mode = "0000644\0";
  const uid = "0000000\0";
  const gid = "0000000\0";
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0";
  write(name, 0, 100);
  write(mode, 100, 8);
  write(uid, 108, 8);
  write(gid, 116, 8);
  write(size.toString(8).padStart(11, "0") + "\0", 124, 12);
  write(mtime, 136, 12);
  header.fill(" ", 148, 156);
  header[156] = "0".charCodeAt(0);
  write("ustar\0", 257, 6);
  write("00", 263, 2);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return header;
}

function buildTar(files: Record<string, string | Buffer>) {
  const chunks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    chunks.push(tarHeader(name, body.length), body);
    const padding = (512 - (body.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

async function dockerRequest(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${DOCKER_API_URL}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Docker API ${pathname} failed: ${response.status} ${text.slice(0, 600)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function dockerEnsureImage(image: string) {
  const inspect = await fetch(`${DOCKER_API_URL}/images/${encodeURIComponent(image)}/json`);
  if (inspect.ok) return;
  await dockerRequest(`/images/create?fromImage=${encodeURIComponent(image)}`, { method: "POST" });
}

async function dockerEnsureVolume(name: string) {
  const inspect = await fetch(`${DOCKER_API_URL}/volumes/${encodeURIComponent(name)}`);
  if (inspect.ok) return;
  await dockerRequest("/volumes/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Name: name, Labels: { "cloudmonkey.managed": "true" } }),
  });
}

async function dockerContainerExists(name: string) {
  const response = await fetch(`${DOCKER_API_URL}/containers/${encodeURIComponent(name)}/json`);
  return response.ok;
}

async function dockerStartContainer(name: string) {
  const response = await fetch(`${DOCKER_API_URL}/containers/${encodeURIComponent(name)}/start`, { method: "POST" });
  if (response.ok || response.status === 304) return;
  const text = await response.text();
  throw new Error(`Docker start ${name} failed: ${response.status} ${text.slice(0, 600)}`);
}

async function dockerBuildStorefrontImage(input: {
  websiteId: string;
  storeId: string;
  businessName: string;
  domain: string;
  siteType: string;
  designManifest: unknown;
  store?: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect;
}) {
  const image = dockerImageTag(input.websiteId);
  const isEcommerce = input.siteType === "ecommerce";
  const builderDir = path.join(WEBSITE_BUILDER_ROOT, isEcommerce ? "base-ecommerce" : "base-website");
  const configPath = isEcommerce ? "public/config/store.config.json" : "public/config/site.config.json";
  const generatedConfig = isEcommerce
    ? buildEcommerceStoreConfig(input)
    : buildBusinessWebsiteConfig(input);
  const files = await readDirectoryAsTarFiles(builderDir);
  files[configPath] = `${JSON.stringify(generatedConfig, null, 2)}\n`;
  const tar = buildTar(files);
  await dockerRequest(`/build?t=${encodeURIComponent(image)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-tar" },
    body: tar,
  });
  return image;
}

async function readDirectoryAsTarFiles(rootDir: string, relativeDir = ""): Promise<Record<string, Buffer>> {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files: Record<string, Buffer> = {};
  for (const entry of entries) {
    if (shouldSkipBuilderPath(entry.name)) continue;
    const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(rootDir, relativePath);
    if (entry.isDirectory()) {
      Object.assign(files, await readDirectoryAsTarFiles(rootDir, relativePath));
    } else if (entry.isFile()) {
      files[relativePath] = await readFile(absolutePath);
    }
  }
  return files;
}

function shouldSkipBuilderPath(name: string) {
  return name === "node_modules" || name === "dist" || name === ".git" || name === "tsconfig.tsbuildinfo" || name.endsWith(".log");
}

function buildBusinessWebsiteConfig(input: {
  websiteId: string;
  businessName: string;
  domain: string;
  siteType: string;
  designManifest: unknown;
}) {
  const manifest = normaliseManifest(input.designManifest);
  const theme = normaliseTheme(manifest);
  const businessName = input.businessName || "CloudMonkey Website";
  const industry = stringValue(manifest.industry, "business services");
  const summary = stringValue(manifest.subheadline, `A professional ${industry} website generated by CloudMonkey.`);
  const serviceItems = listValues(manifest.pageSections, ["Services", "Process", "Testimonials"]);

  return {
    schemaVersion: "1.0.0",
    siteType: "website",
    businessProfile: {
      name: businessName,
      industry,
      location: "South Africa",
      summary,
      targetCustomer: stringValue(manifest.targetAudience, "South African customers"),
    },
    brandIdentity: {
      tone: stringValue(manifest.tone, "Professional, helpful and trustworthy"),
      logoText: businessName,
      tagline: stringValue(manifest.headline, summary),
      imagePrompts: [stringValue(manifest.imagePrompt, `Premium website photography for ${businessName}`)],
    },
    themeTokens: theme,
    navigation: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "Gallery", href: "/gallery" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
    contact: {
      email: "hello@example.co.za",
      phone: "",
      whatsapp: "",
      address: "South Africa",
      socialLinks: [],
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        seo: { title: `${businessName} | ${industry}`, description: summary, schemaType: "LocalBusiness" },
        sections: [
          { type: "hero", eyebrow: industry, title: stringValue(manifest.headline, businessName), subtitle: summary, cta: { label: "Request a quote", href: "/contact" } },
          { type: "services", title: "What we offer", items: serviceItems.map((title) => ({ title, body: `A focused ${title.toLowerCase()} experience for your customers.` })) },
          { type: "why", title: "Why choose us", items: ["Clear communication", "Reliable delivery", "Local support"].map((title) => ({ title, body: "Built for trust, speed and measurable business outcomes." })) },
          { type: "testimonials", title: "Customer confidence", items: [{ quote: "Professional service and a clear experience from first enquiry.", author: "CloudMonkey customer" }] },
          { type: "contactCta", title: "Ready to get started?", subtitle: "Send an enquiry and the team will respond." },
        ],
      },
      { slug: "/about", title: "About", seo: { title: `About ${businessName}`, description: summary }, sections: [{ type: "content", title: `About ${businessName}`, body: summary }] },
      { slug: "/services", title: "Services", seo: { title: `${businessName} Services`, description: summary }, sections: [{ type: "services", title: "Services", items: serviceItems.map((title) => ({ title, body: `Professional ${title.toLowerCase()} support.` })) }] },
      { slug: "/gallery", title: "Gallery", seo: { title: `${businessName} Gallery`, description: "Recent work and highlights." }, sections: [{ type: "gallery", title: "Gallery", items: serviceItems.map((title) => ({ title })) }] },
      { slug: "/faq", title: "FAQ", seo: { title: `${businessName} FAQ`, description: "Common questions." }, sections: [{ type: "faq", title: "Common questions", items: [{ title: "How do I get started?", body: "Send an enquiry and we will confirm the next steps." }] }] },
      { slug: "/contact", title: "Contact", seo: { title: `Contact ${businessName}`, description: "Contact the team." }, sections: [{ type: "contact", title: "Contact us", subtitle: "Tell us what you need." }] },
      { slug: "/privacy", title: "Privacy Policy", seo: { title: "Privacy Policy", description: "Privacy policy." }, sections: [{ type: "content", title: "Privacy Policy", body: "We use submitted information to respond to enquiries and provide requested services." }] },
      { slug: "/terms", title: "Terms", seo: { title: "Terms", description: "Terms and conditions." }, sections: [{ type: "content", title: "Terms", body: "Services are provided subject to written confirmation." }] },
    ],
    footer: {
      legalText: `© ${businessName}. Built by CloudMonkey.`,
      columns: [
        { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Contact", href: "/contact" }] },
        { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
      ],
    },
  };
}

function buildEcommerceStoreConfig(input: {
  websiteId: string;
  storeId: string;
  businessName: string;
  domain: string;
  siteType: string;
  designManifest: unknown;
  store?: typeof websiteStore.$inferSelect;
}) {
  const manifest = normaliseManifest(input.designManifest);
  const theme = normaliseTheme(manifest);
  const businessName = input.businessName || input.store?.name || "CloudMonkey Store";
  const industry = stringValue(manifest.industry, "online retail");
  const summary = stringValue(manifest.subheadline, `A modern ${industry} ecommerce store generated by CloudMonkey.`);
  const templateKey = stringValue(manifest.templateKey || manifest.layoutPreset || manifest.theme, "standard-commerce") === "fashion-retail-editorial"
    ? "fashion-retail-editorial"
    : "standard-commerce";
  const categories = listValues(
    manifest.categories,
    templateKey === "fashion-retail-editorial"
      ? ["New Arrivals", "Women", "Men", "Bags", "Accessories", "Footwear"]
      : ["Featured", "New Arrivals", "Best Sellers"]
  );
  const starterProducts = categories.slice(0, 3).map((category, index) => ({
    title: `${category} Product ${index + 1}`,
    price: [199, 349, 499][index] ?? 199,
    sku: `CM-${input.websiteId.slice(-6).toUpperCase()}-${index + 1}`,
    category,
    description: `A starter ${category.toLowerCase()} product ready to edit in the store admin.`,
  }));

  return {
    schemaVersion: "1.0.0",
    siteType: "ecommerce",
    templateKey,
    layoutPreset: templateKey,
    businessProfile: {
      name: businessName,
      industry,
      location: "South Africa",
      summary,
      targetCustomer: stringValue(manifest.targetAudience, "South African online shoppers"),
    },
    store: {
      name: businessName,
      currency: "ZAR",
      countryCode: "ZA",
      timezone: "Africa/Johannesburg",
      supportEmail: "support@example.co.za",
      supportPhone: "",
      whatsapp: "",
    },
    brandIdentity: {
      tone: stringValue(manifest.tone, "Helpful, modern and trustworthy"),
      logoText: businessName,
      tagline: stringValue(manifest.headline, summary),
    },
    themeTokens: theme,
    navigation: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
    pages: ecommercePages(businessName, summary),
    homepageSections: ecommerceHomepageSections(templateKey, summary),
    commerce: {
      categories: categories.map((name) => ({ name, slug: slugifySiteName(name) })),
      starterProducts,
      payment: { providers: ["paystack", "manual_eft"], cloudMonkeyFeePercent: 0, manualEftEnabled: true },
      shipping: {
        collectionEnabled: true,
        zones: [{ name: "South Africa courier", price: 99, regions: ["South Africa"] }],
      },
      trustBadges: ["Secure checkout", "South African support", "Reliable delivery"],
      policies: {
        returns: "Returns are accepted within 7 days for unused products in original packaging.",
        privacy: "Customer details are used only to process orders and provide support.",
        terms: "Orders are confirmed once payment clears.",
        shipping: "Delivery options are shown at checkout and depend on the customer's address.",
        faq: "Orders, delivery, returns and payment questions are answered here.",
        checkoutMessaging: "Secure checkout with South African payment options.",
      },
    },
    analytics: {},
  };
}

function normaliseManifest(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const objectValue = value as Record<string, any>;
    if (objectValue.designManifest && typeof objectValue.designManifest === "object" && !Array.isArray(objectValue.designManifest)) {
      return { ...(objectValue.designManifest as Record<string, any>), ...objectValue };
    }
    return objectValue;
  }
  return {};
}

function normaliseTheme(manifest: Record<string, any>) {
  const theme = normaliseManifest(manifest.theme || manifest.themeTokens || manifest);
  return {
    primaryColor: validHex(theme.primaryColor) ? theme.primaryColor : "#1267ff",
    secondaryColor: validHex(theme.secondaryColor) ? theme.secondaryColor : "#ffb703",
    accentColor: validHex(theme.accentColor) ? theme.accentColor : "#0f172a",
    backgroundColor: validHex(theme.backgroundColor) ? theme.backgroundColor : "#f5f7fb",
    surfaceColor: validHex(theme.surfaceColor) ? theme.surfaceColor : "#ffffff",
    textColor: validHex(theme.textColor) ? theme.textColor : "#111827",
    mutedTextColor: validHex(theme.mutedTextColor) ? theme.mutedTextColor : "#667085",
    fontFamily: stringValue(theme.fontFamily, "Inter, Arial, sans-serif"),
    headingFontFamily: stringValue(theme.headingFontFamily, "Inter, Arial, sans-serif"),
    radius: ["none", "small", "medium", "large"].includes(theme.radius) ? theme.radius : "medium",
    mode: theme.mode === "dark" ? "dark" : "light",
  };
}

function validHex(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function listValues(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const values = value.map((item) => typeof item === "string" ? item : typeof item?.title === "string" ? item.title : typeof item?.name === "string" ? item.name : "").filter(Boolean);
    if (values.length) return values.slice(0, 8);
  }
  return fallback;
}

const REQUIRED_ECOMMERCE_PAGES = [
  { slug: "/", title: "Home", description: "Store homepage." },
  { slug: "/shop", title: "Shop", description: "Browse products." },
  { slug: "/category/:slug", title: "Category", description: "Browse a product category." },
  { slug: "/product/:slug", title: "Product", description: "View product details." },
  { slug: "/cart", title: "Cart", description: "Review your cart." },
  { slug: "/checkout", title: "Checkout", description: "Secure checkout." },
  { slug: "/payment-success", title: "Payment Success", description: "Payment received." },
  { slug: "/payment-failed", title: "Payment Failed", description: "Payment failed." },
  { slug: "/order-tracking", title: "Order Tracking", description: "Track an order." },
  { slug: "/about", title: "About", description: "About the store." },
  { slug: "/contact", title: "Contact", description: "Contact the store." },
  { slug: "/faq", title: "FAQ", description: "Frequently asked questions." },
  { slug: "/privacy", title: "Privacy", description: "Privacy policy." },
  { slug: "/terms", title: "Terms", description: "Terms and conditions." },
  { slug: "/returns", title: "Returns", description: "Returns policy." },
  { slug: "/shipping", title: "Shipping", description: "Shipping information." },
] as const;

function ecommercePages(businessName: string, summary: string) {
  return REQUIRED_ECOMMERCE_PAGES.map((page) => ({
    slug: page.slug,
    title: page.title,
    seo: {
      title: page.slug === "/" ? `${businessName} | Online Store` : `${page.title} | ${businessName}`,
      description: page.slug === "/" || page.slug === "/shop" ? summary : page.description,
    },
  }));
}

function ecommerceHomepageSections(templateKey: string, summary: string) {
  if (templateKey !== "fashion-retail-editorial") {
    return [
      { type: "hero", title: "Shop the latest", subtitle: summary, ctaLabel: "Shop now", ctaHref: "/shop" },
      { type: "featuredProducts", title: "Featured products" },
      { type: "trust", title: "Secure checkout and reliable delivery" },
    ];
  }
  return [
    { type: "promoBar", title: "New season offers, secure checkout and nationwide delivery" },
    { type: "hero", eyebrow: "New arrivals", title: "Summer Flash Sale", subtitle: summary, ctaLabel: "Shop now", ctaHref: "/shop" },
    { type: "offerStrip", title: "Black Friday and Cyber Monday Sale" },
    { type: "categoryMosaic", title: "Shop categories" },
    { type: "newProducts", title: "New In Products" },
    { type: "collections", title: "Seasonal collections" },
    { type: "saleTicker", title: "Limited offers" },
    { type: "hotProducts", title: "Hot Products" },
    { type: "videoShoppable", title: "Video Shoppable" },
    { type: "lookbook", title: "Shop The Look" },
    { type: "testimonials", title: "What Our Customers Say" },
    { type: "instagram", title: "Instagram Shoppable" },
    { type: "benefits", title: "Store benefits" },
  ];
}

type RuntimeDeployPayload = {
  website: {
    id: string;
    userId: string;
    siteType: string;
    businessName: string;
    temporaryDomain: string | null;
    primaryDomain: string | null;
  };
  store: {
    id: string;
    name: string;
    status: string;
  };
  database?: {
    id: string;
    engine: string;
    version: string;
    databaseName: string;
    username: string;
    password: string;
    containerName: string;
    volumeName: string;
  };
  runtime: {
    networkName: string;
    proxyMode: string;
    redisContainerName?: string;
  };
  medusa?: {
    enabled: boolean;
    image: string;
    containerName: string;
    port: number;
    configPath: string;
    config: unknown;
    env: Record<string, string>;
    redisPrefix: string;
  };
  storefront: {
    image: string;
    containerName: string;
    port: number;
    configPath: string;
    config: unknown;
    env: Record<string, string>;
  };
};

function buildStorefrontContainerName(websiteId: string) {
  return `cm_site_${websiteId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
}

function buildMedusaContainerName(websiteId: string) {
  return `cm_medusa_${websiteId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
}

function medusaImageTag(websiteId: string) {
  return `cloudmonkey-medusa:${websiteId.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase()}`;
}

function runtimeSafeSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function decryptMaybeSecret(value: string | null | undefined) {
  if (!value) return "";
  return value.startsWith("enc:v1:") ? decryptSecret(value) : value;
}

async function selectWebsiteRuntimeServer() {
  const configuredUrl = process.env.WEBSITE_RUNTIME_PROVISIONER_URL;
  const configuredSecret = process.env.WEBSITE_RUNTIME_PROVISIONER_SECRET;
  if (configuredUrl && configuredSecret) {
    return {
      id: process.env.WEBSITE_RUNTIME_SERVER_ID ?? "runtime_env_geek247",
      provider: "manual",
      providerInstanceId: null,
      profileName: "geek247-compatible-docker-host",
      hostname: process.env.WEBSITE_RUNTIME_HOSTNAME ?? "geek247.co.za",
      publicIp: process.env.WEBSITE_RUNTIME_PUBLIC_IP ?? null,
      privateIp: null,
      provisionerUrl: configuredUrl,
      provisionerSecret: configuredSecret,
      ingressHostname: process.env.WEBSITE_RUNTIME_INGRESS_HOSTNAME ?? "geek247.co.za",
      ingressIp: process.env.WEBSITE_RUNTIME_INGRESS_IP ?? process.env.WEBSITE_RUNTIME_PUBLIC_IP ?? null,
      dockerNetworkName: process.env.WEBSITE_RUNTIME_DOCKER_NETWORK ?? "cm_runtime",
      proxyMode: process.env.WEBSITE_RUNTIME_PROXY_MODE ?? "caddy",
      lastError: null,
      region: process.env.WEBSITE_RUNTIME_REGION ?? null,
      status: "active",
      cpuTotal: 0,
      memoryTotalMb: 0,
      diskTotalGb: 0,
      activeSiteCount: 0,
      maxSiteCount: 0,
      lastHealthCheckAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies typeof websiteRuntimeServer.$inferSelect;
  }

  const candidates = await db.query.websiteRuntimeServer.findMany({
    orderBy: (websiteRuntimeServer, { asc }) => [asc(websiteRuntimeServer.activeSiteCount)],
  });
  return candidates.find((server) => server.status === "active" && server.provisionerUrl && server.provisionerSecret) ?? null;
}

function signRuntimeRequest(secret: string, method: string, pathname: string, bodyText: string) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(12).toString("hex");
  const signature = crypto.createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${method}.${pathname}.${bodyText}`)
    .digest("hex");
  return { timestamp, nonce, signature };
}

async function callRuntimeProvisioner<T>(runtime: typeof websiteRuntimeServer.$inferSelect, pathname: string, body: unknown): Promise<T> {
  if (!runtime.provisionerUrl || !runtime.provisionerSecret) {
    throw new Error("Runtime server does not have a provisioner URL and secret configured");
  }
  const provisionerSecret = decryptMaybeSecret(runtime.provisionerSecret);
  const baseUrl = runtime.provisionerUrl.replace(/\/+$/, "");
  const bodyText = JSON.stringify(body ?? {});
  const signed = signRuntimeRequest(provisionerSecret, "POST", pathname, bodyText);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CM-Runtime-Id": runtime.id,
      "X-CM-Timestamp": signed.timestamp,
      "X-CM-Nonce": signed.nonce,
      "X-CM-Signature": signed.signature,
    },
    body: bodyText,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Runtime provisioner ${pathname} failed: ${response.status} ${text.slice(0, 800)}`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

async function provisionRemoteWebsiteRuntime(input: {
  runtime: typeof websiteRuntimeServer.$inferSelect;
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  buildManifest: unknown;
}) {
  const isEcommerce = input.site.siteType === "ecommerce";
  if (isEcommerce && !input.database) {
    throw new Error("Ecommerce stores require a dedicated database before provisioning");
  }
  const generatedConfig = isEcommerce
    ? buildEcommerceStoreConfig({
        websiteId: input.site.id,
        storeId: input.store.id,
        businessName: input.site.businessName || input.site.name || input.store.name,
        domain: input.site.temporaryDomain || input.site.primaryDomain || "",
        siteType: input.site.siteType,
        designManifest: input.buildManifest,
        store: input.store,
      })
    : buildBusinessWebsiteConfig({
        websiteId: input.site.id,
        businessName: input.site.businessName || input.site.name || input.store.name,
        domain: input.site.temporaryDomain || input.site.primaryDomain || "",
        siteType: input.site.siteType,
        designManifest: input.buildManifest,
      });
  const image = dockerImageTag(input.site.id);
  const containerName = buildStorefrontContainerName(input.site.id);
  const medusaContainerName = buildMedusaContainerName(input.site.id);
  const medusaImage = medusaImageTag(input.site.id);
  const redisPrefix = `cm:${input.site.id.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
  const databaseUrl = input.database
    ? `postgres://${encodeURIComponent(input.database.username)}:${encodeURIComponent(decryptSecret(input.database.passwordSecret))}@${input.database.containerName}:5432/${encodeURIComponent(input.database.databaseName)}`
    : "";
  const publicBaseUrl = input.site.temporaryDomain ? `https://${input.site.temporaryDomain}` : "";
  const payload: RuntimeDeployPayload = {
    website: {
      id: input.site.id,
      userId: input.site.userId,
      siteType: input.site.siteType,
      businessName: input.site.businessName || input.site.name || input.store.name,
      temporaryDomain: input.site.temporaryDomain,
      primaryDomain: input.site.primaryDomain,
    },
    store: {
      id: input.store.id,
      name: input.store.name,
      status: input.store.status,
    },
    database: input.database ? {
      id: input.database.id,
      engine: input.database.engine,
      version: input.database.version,
      databaseName: input.database.databaseName,
      username: input.database.username,
      password: decryptSecret(input.database.passwordSecret),
      containerName: input.database.containerName,
      volumeName: input.database.volumeName,
    } : undefined,
    runtime: {
      networkName: input.runtime.dockerNetworkName || "cm_runtime",
      proxyMode: input.runtime.proxyMode || "caddy",
      redisContainerName: "cloudmonkey-runtime-redis",
    },
    medusa: isEcommerce ? {
      enabled: true,
      image: medusaImage,
      containerName: medusaContainerName,
      port: 9000,
      configPath: "config/store.config.json",
      config: generatedConfig,
      redisPrefix,
      env: {
        PORT: "9000",
        CLOUDMONKEY_WEBSITE_ID: input.site.id,
        CLOUDMONKEY_OWNER_USER_ID: input.site.userId,
        CLOUDMONKEY_STORE_ID: input.store.id,
        CLOUDMONKEY_STORE_CONFIG_PATH: "/app/config/store.config.json",
        DATABASE_URL: databaseUrl,
        REDIS_URL: "redis://cloudmonkey-runtime-redis:6379/0",
        REDIS_PREFIX: redisPrefix,
        STORE_CORS: publicBaseUrl,
        ADMIN_CORS: process.env.PUBLIC_APP_URL ?? "https://cloudmonkey.co.za",
        AUTH_CORS: process.env.PUBLIC_APP_URL ?? "https://cloudmonkey.co.za",
        JWT_SECRET: runtimeSafeSecret(),
        COOKIE_SECRET: runtimeSafeSecret(),
        PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY ?? "",
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY ?? "",
        CLOUDMONKEY_PLATFORM_FEE_PERCENT: process.env.CLOUDMONKEY_WEBSITE_PLATFORM_FEE_PERCENT ?? "0",
      },
    } : undefined,
    storefront: {
      image,
      containerName,
      port: 3000,
      configPath: isEcommerce ? "public/config/store.config.json" : "public/config/site.config.json",
      config: generatedConfig,
      env: {
        PORT: "3000",
        CLOUDMONKEY_WEBSITE_ID: input.site.id,
        CLOUDMONKEY_OWNER_USER_ID: input.site.userId,
        STORE_ID: input.store.id,
        STORE_MODE: input.site.siteType,
        VITE_PUBLIC_BASE_URL: publicBaseUrl,
        VITE_MEDUSA_BACKEND_URL: publicBaseUrl,
        CLOUDMONKEY_API_URL: process.env.PUBLIC_APP_URL ?? "https://cloudmonkey.co.za",
        ...(isEcommerce ? { DATABASE_URL: databaseUrl } : {}),
        PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY ?? "",
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY ?? "",
        CLOUDMONKEY_PLATFORM_FEE_PERCENT: process.env.CLOUDMONKEY_WEBSITE_PLATFORM_FEE_PERCENT ?? "0",
      },
    },
  };
  return callRuntimeProvisioner<{
    image: string;
    storefrontContainerName: string;
    medusaContainerName?: string | null;
    sqlContainerName?: string | null;
    publicUrl: string | null;
    routeProvider: string;
  }>(input.runtime, "/deploy", payload);
}

async function dockerCreateSqlContainer(database: typeof websiteStoreDatabase.$inferSelect) {
  await dockerEnsureImage("postgres:16-alpine");
  await dockerEnsureVolume(database.volumeName);
  if (!await dockerContainerExists(database.containerName)) {
    await dockerRequest(`/containers/create?name=${encodeURIComponent(database.containerName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Image: "postgres:16-alpine",
        Env: [
          `POSTGRES_DB=${database.databaseName}`,
          `POSTGRES_USER=${database.username}`,
          `POSTGRES_PASSWORD=${decryptSecret(database.passwordSecret)}`,
        ],
        Labels: {
          "cloudmonkey.managed": "true",
          "cloudmonkey.kind": "website-sql",
          "cloudmonkey.website_id": database.websiteId,
          "cloudmonkey.store_id": database.storeId,
        },
        HostConfig: {
          NetworkMode: DOCKER_NETWORK_NAME,
          RestartPolicy: { Name: "unless-stopped" },
          Binds: [`${database.volumeName}:/var/lib/postgresql/data`],
          Memory: 512 * 1024 * 1024,
          NanoCpus: 500000000,
        },
      }),
    });
  }
  await dockerStartContainer(database.containerName);
}

async function runDedicatedStoreMigrations(database: typeof websiteStoreDatabase.$inferSelect) {
  const connectionString = decryptSecret(database.connectionSecret);
  const migrationPath = path.join(WEBSITE_BUILDER_ROOT, "base-ecommerce", "db", "migrations", "001_init.sql");
  const migrationSql = await readFile(migrationPath, "utf8");
  let lastError: unknown;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const sqlClient = postgres(connectionString, { max: 1, connect_timeout: 5 });
    try {
      await sqlClient.unsafe("select 1");
      await sqlClient.unsafe(migrationSql);
      await sqlClient.end({ timeout: 5 });
      return;
    } catch (error) {
      lastError = error;
      await sqlClient.end({ timeout: 1 }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new Error(`Dedicated store database migration failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function dockerCreateStorefrontContainer(input: {
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  image: string;
}) {
  const containerName = buildStorefrontContainerName(input.site.id);
  if (!await dockerContainerExists(containerName)) {
    await dockerRequest(`/containers/create?name=${encodeURIComponent(containerName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Image: input.image,
        Env: [
          "PORT=3000",
          `CLOUDMONKEY_WEBSITE_ID=${input.site.id}`,
          `CLOUDMONKEY_OWNER_USER_ID=${input.site.userId}`,
          `STORE_ID=${input.store.id}`,
          `STORE_MODE=${input.site.siteType}`,
          `VITE_PUBLIC_BASE_URL=http://${input.site.temporaryDomain}`,
          "CLOUDMONKEY_API_URL=https://cloudmonkey.co.za",
          ...(input.site.siteType === "ecommerce" && input.database ? [`DATABASE_URL=${decryptSecret(input.database.connectionSecret)}`] : []),
          `PAYSTACK_PUBLIC_KEY=${process.env.PAYSTACK_PUBLIC_KEY ?? ""}`,
          `PAYSTACK_SECRET_KEY=${process.env.PAYSTACK_SECRET_KEY ?? ""}`,
          `CLOUDMONKEY_PLATFORM_FEE_PERCENT=${process.env.CLOUDMONKEY_WEBSITE_PLATFORM_FEE_PERCENT ?? "0"}`,
        ],
        Labels: {
          "cloudmonkey.managed": "true",
          "cloudmonkey.kind": "website-storefront",
          "cloudmonkey.website_id": input.site.id,
          "cloudmonkey.store_id": input.store.id,
          "cloudmonkey.domain": input.site.temporaryDomain ?? "",
        },
        ExposedPorts: { "3000/tcp": {} },
        HostConfig: {
          NetworkMode: DOCKER_NETWORK_NAME,
          RestartPolicy: { Name: "unless-stopped" },
          Memory: input.site.siteType === "ecommerce" ? 768 * 1024 * 1024 : 512 * 1024 * 1024,
          NanoCpus: input.site.siteType === "ecommerce" ? 750000000 : 500000000,
        },
      }),
    });
  }
  await dockerStartContainer(containerName);
  return containerName;
}

async function writeNginxWebsiteRoute(input: { domain: string; containerName: string }) {
  await mkdir(NGINX_SITE_CONF_DIR, { recursive: true });
  const safeName = input.domain.replace(/[^a-z0-9.-]/gi, "_").toLowerCase();
  const confPath = path.join(NGINX_SITE_CONF_DIR, `website-${safeName}.conf`);
  const conf = `server {
    listen 80;
    server_name ${input.domain};

    location / {
        resolver 127.0.0.11 valid=10s ipv6=off;
        proxy_pass http://${input.containerName}:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
  await writeFile(confPath, conf, "utf8");
  await dockerRequest(`/containers/${encodeURIComponent(NGINX_CONTAINER_NAME)}/restart`, { method: "POST" });
}

async function provisionLocalWebsiteRuntime(input: {
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  buildManifest: unknown;
}) {
  if (input.site.siteType === "ecommerce") {
    if (!input.database) throw new Error("Ecommerce stores require a dedicated database before provisioning");
    await dockerCreateSqlContainer(input.database);
    await runDedicatedStoreMigrations(input.database);
  }
  const image = await dockerBuildStorefrontImage({
    websiteId: input.site.id,
    storeId: input.store.id,
    businessName: input.site.businessName || input.site.name || input.store.name,
    domain: input.site.temporaryDomain || input.site.primaryDomain || "",
    siteType: input.site.siteType,
    designManifest: input.buildManifest,
    store: input.store,
    database: input.database ?? undefined,
  });
  const storefrontContainerName = await dockerCreateStorefrontContainer({
    site: input.site,
    store: input.store,
    database: input.database ?? null,
    image,
  });
  if (input.site.temporaryDomain) {
    await writeNginxWebsiteRoute({ domain: input.site.temporaryDomain, containerName: storefrontContainerName });
  }
  return {
    image,
    storefrontContainerName,
    medusaContainerName: null,
    sqlContainerName: input.database?.containerName ?? null,
    publicUrl: input.site.temporaryDomain ? `http://${input.site.temporaryDomain}` : null,
    routeProvider: "local-nginx",
  };
}

function createApprovalToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: sha256(raw) };
}

function publicDesignImageUrl(id: string) {
  return `/api/public/website-design-options/${encodeURIComponent(id)}/image`;
}

async function createWebsiteProjectFromOnboarding(input: {
  userId: string;
  subscription: typeof subscription.$inferSelect & { plan?: typeof servicePlan.$inferSelect | null };
  invoiceId?: string | null;
  answers: Record<string, unknown>;
}) {
  const existing = await db.query.website.findFirst({
    where: eq(website.subscriptionId, input.subscription.id),
  });
  if (existing) return existing;

  const now = new Date();
  const siteType = input.subscription.planId?.startsWith("ecom-") ? "ecommerce" : "website";
  const businessName = String(input.answers.businessName || input.answers.companyName || input.subscription.name || "CloudMonkey Website").slice(0, 120);
  const industry = String(input.answers.industry || input.answers.businessCategory || "").slice(0, 120);
  const businessDescription = String(input.answers.businessDescription || input.answers.aboutBusiness || input.answers.goals || "").slice(0, 1000);
  const preferredSlug = String(input.answers.preferredSlug || input.answers.businessName || businessName);
  const baseSlug = slugifySiteName(preferredSlug);
  const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
  const temporaryDomain = `${slug}.cloudmonkey.co.za`;
  const websiteId = makeId("web");
  const storeId = makeId("store");
  const trialEndsAt = input.subscription.status === "trialing" ? input.subscription.currentPeriodEnd : null;
  const graceEndsAt = trialEndsAt ? addDays(trialEndsAt, 30) : null;
  const databaseRecord = siteType === "ecommerce"
    ? buildStoreDatabaseRecord({
        websiteId,
        storeId,
        userId: input.userId,
      })
    : null;
  const provisioningPlan = buildWebsiteProvisioningPlan({
    websiteId,
    storeId,
    temporaryDomain,
    siteType,
    database: databaseRecord ?? undefined,
  });
  const baseRepo = siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template";

  let createdWebsite: typeof website.$inferSelect;
  await db.transaction(async (tx) => {
    [createdWebsite] = await tx.insert(website).values({
      id: websiteId,
      userId: input.userId,
      subscriptionId: input.subscription.id,
      invoiceId: input.invoiceId ?? null,
      domain: temporaryDomain,
      plan: input.subscription.planId ?? input.subscription.name,
      status: "onboarding",
      siteType,
      name: businessName,
      businessName,
      businessDescription,
      industry,
      temporaryDomain,
      primaryDomain: temporaryDomain,
      onboardingAnswers: JSON.stringify(input.answers),
      requirementManifest: JSON.stringify({
        source: "website-wizard",
        siteType,
        answers: input.answers,
        subscriptionId: input.subscription.id,
        createdAt: now.toISOString(),
      }),
      provisioningPlan: JSON.stringify(provisioningPlan),
      aiGenerationStatus: "manual_design_pending",
      containerStatus: "not_provisioned",
      baseRepo,
      trialStartedAt: input.subscription.status === "trialing" ? input.subscription.currentPeriodStart : null,
      trialEndsAt,
      graceEndsAt,
      terminationScheduledAt: graceEndsAt,
    }).returning();

    await tx.insert(websiteStore).values({
      id: storeId,
      websiteId,
      userId: input.userId,
      name: businessName,
      siteType,
      status: input.subscription.status === "trialing" ? "trial" : "planned",
      paymentMode: "cloudmonkey_gateway",
      trialStartedAt: input.subscription.status === "trialing" ? input.subscription.currentPeriodStart : null,
      trialEndsAt,
      terminationScheduledAt: graceEndsAt,
    });
    if (databaseRecord) {
      await tx.insert(websiteStoreDatabase).values(databaseRecord);
    }
    await tx.insert(websiteDomain).values({
      id: makeId("webdomain"),
      websiteId,
      userId: input.userId,
      domain: temporaryDomain,
      type: "temporary",
      status: "reserved",
      dnsTarget: "wildcard.cloudmonkey.co.za",
      sslStatus: "pending",
      isPrimary: true,
    });

    if (siteType === "ecommerce") {
      await tx.insert(websitePluginInstall).values([
        {
          id: makeId("webplugin"),
          websiteId,
          storeId,
          userId: input.userId,
          pluginKey: "cloudmonkey-paystack-gateway",
          status: "planned",
          config: JSON.stringify({ transactionFeeBps: 700, currency: "ZAR" }),
        },
        {
          id: makeId("webplugin"),
          websiteId,
          storeId,
          userId: input.userId,
          pluginKey: "basic-seo",
          status: "planned",
          config: JSON.stringify({ sitemap: true, robots: true }),
        },
      ]);
    }
  });

  await recordAudit({
    actorUserId: input.userId,
    action: "website_project.onboarding_created",
    entityType: "website",
    entityId: createdWebsite!.id,
    message: `Website project created for ${businessName}`,
    metadata: {
      subscriptionId: input.subscription.id,
      invoiceId: input.invoiceId ?? null,
      siteType,
      temporaryDomain,
    },
  });

  return createdWebsite!;
}

async function provisionWebsiteRuntime(userId: string, websiteId: string) {
  const detail = await getUserWebsiteDetail(userId, websiteId);
  if (!detail?.store) {
    const error: any = new Error("Website store must exist before provisioning");
    error.status = 404;
    throw error;
  }
  if (detail.siteType === "ecommerce" && !detail.store.database) {
    const error: any = new Error("Website store and dedicated database must exist before provisioning");
    error.status = 404;
    throw error;
  }
  if (!detail.selectedDesignOptionId || !detail.buildManifest) {
    const error: any = new Error("Select a design before provisioning");
    error.status = 400;
    throw error;
  }

  await db.update(website).set({
    containerStatus: "provisioning",
    status: "provisioning",
    updatedAt: new Date(),
  }).where(eq(website.id, websiteId));
  if (detail.store.database) {
    await db.update(websiteStoreDatabase).set({
      status: "provisioning",
      updatedAt: new Date(),
    }).where(eq(websiteStoreDatabase.id, detail.store.database.id));
  }

  const siteRow = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
  const storeRow = await db.query.websiteStore.findFirst({ where: eq(websiteStore.websiteId, websiteId) });
  const databaseRow = storeRow
    ? await db.query.websiteStoreDatabase.findFirst({ where: eq(websiteStoreDatabase.storeId, storeRow.id) })
    : null;
  if (!siteRow || !storeRow) throw new Error("Website runtime records disappeared during provisioning");
  if (siteRow.siteType === "ecommerce" && !databaseRow) throw new Error("Ecommerce database record disappeared during provisioning");

  const buildManifest = safeJsonParse(siteRow.buildManifest) ?? {};
  const runtimeServer = await selectWebsiteRuntimeServer();
  const runtimeResult = runtimeServer
    ? await provisionRemoteWebsiteRuntime({
        runtime: runtimeServer,
        site: siteRow,
        store: storeRow,
        database: databaseRow,
        buildManifest,
      })
    : await provisionLocalWebsiteRuntime({
        site: siteRow,
        store: storeRow,
        database: databaseRow,
        buildManifest,
      });

  const now = new Date();
  const [updatedSite] = await db.update(website).set({
    containerStatus: "running",
    status: "live_trial",
    runtimeServerId: runtimeServer?.id ?? siteRow.runtimeServerId,
    provisioningPlan: JSON.stringify({
      ...(safeJsonParse(siteRow.provisioningPlan) ?? {}),
      status: "running",
      dockerImage: runtimeResult.image,
      storefrontContainerName: runtimeResult.storefrontContainerName,
      medusaContainerName: runtimeResult.medusaContainerName ?? null,
      commerceEngine: siteRow.siteType === "ecommerce" ? "medusa" : "static",
      sqlContainerName: runtimeResult.sqlContainerName,
      runtimeServerId: runtimeServer?.id ?? "local",
      runtimeHost: runtimeServer?.hostname ?? "local",
      routeProvider: runtimeResult.routeProvider,
      provisionedAt: now.toISOString(),
      publicUrl: runtimeResult.publicUrl,
    }),
    updatedAt: now,
  }).where(eq(website.id, websiteId)).returning();
  await db.update(websiteStore).set({
    status: "trial",
    updatedAt: now,
  }).where(eq(websiteStore.id, storeRow.id));
  if (databaseRow) {
    await db.update(websiteStoreDatabase).set({
      status: "running",
      host: runtimeServer ? databaseRow.containerName : databaseRow.host,
      updatedAt: now,
    }).where(eq(websiteStoreDatabase.id, databaseRow.id));
  }
  if (runtimeServer && !runtimeServer.id.startsWith("runtime_env_")) {
    await db.update(websiteRuntimeServer).set({
      activeSiteCount: sql`${websiteRuntimeServer.activeSiteCount} + 1`,
      lastError: null,
      updatedAt: now,
    }).where(eq(websiteRuntimeServer.id, runtimeServer.id));
  }

  await recordAudit({
    actorUserId: userId,
    action: "website.provisioned",
    entityType: "website",
    entityId: websiteId,
    message: `Website runtime provisioned for ${siteRow.businessName || siteRow.temporaryDomain}`,
    metadata: {
      image: runtimeResult.image,
      containerName: runtimeResult.storefrontContainerName,
      sqlContainerName: runtimeResult.sqlContainerName ?? null,
      domain: siteRow.temporaryDomain,
      runtimeServerId: runtimeServer?.id ?? "local",
    },
  });

  return {
    website: {
      ...updatedSite,
      buildManifest: safeJsonParse(updatedSite.buildManifest),
      provisioningPlan: safeJsonParse(updatedSite.provisioningPlan),
    },
    runtime: {
      ...runtimeResult,
      runtimeServerId: runtimeServer?.id ?? "local",
    },
  };
}

async function getUserWebsiteDashboardRows(userId: string) {
  const [sites, stores, databases, domains, plugins] = await Promise.all([
    db.query.website.findMany({
      where: eq(website.userId, userId),
      orderBy: (website, { desc }) => [desc(website.createdAt)],
    }),
    db.query.websiteStore.findMany({
      where: eq(websiteStore.userId, userId),
    }),
    db.query.websiteStoreDatabase.findMany({
      where: eq(websiteStoreDatabase.userId, userId),
    }),
    db.query.websiteDomain.findMany({
      where: eq(websiteDomain.userId, userId),
    }),
    db.query.websitePluginInstall.findMany({
      where: eq(websitePluginInstall.userId, userId),
    }),
  ]);

  return sites.map((site) => {
    const store = stores.find((row) => row.websiteId === site.id) ?? null;
    const database = store ? databases.find((row) => row.storeId === store.id) ?? null : null;
    const publicDatabase = database
      ? {
          id: database.id,
          engine: database.engine,
          version: database.version,
          host: database.host,
          port: database.port,
          databaseName: database.databaseName,
          username: database.username,
          containerName: database.containerName,
          volumeName: database.volumeName,
          status: database.status,
          backupStatus: database.backupStatus,
        }
      : null;

    return {
      ...site,
      onboardingAnswers: safeJsonParse(site.onboardingAnswers),
      requirementManifest: safeJsonParse(site.requirementManifest),
      buildManifest: safeJsonParse(site.buildManifest),
      provisioningPlan: safeJsonParse(site.provisioningPlan),
      store: store ? { ...store, database: publicDatabase } : null,
      domains: domains.filter((row) => row.websiteId === site.id),
      plugins: plugins.filter((row) => row.websiteId === site.id),
    };
  });
}

async function getUserWebsiteDetail(userId: string, websiteId: string) {
  const site = await db.query.website.findFirst({
    where: eq(website.id, websiteId),
  });
  if (!site || site.userId !== userId) return null;

  const [store, domains, plugins, designOptions] = await Promise.all([
    db.query.websiteStore.findFirst({ where: eq(websiteStore.websiteId, site.id) }),
    db.query.websiteDomain.findMany({ where: eq(websiteDomain.websiteId, site.id) }),
    db.query.websitePluginInstall.findMany({ where: eq(websitePluginInstall.websiteId, site.id) }),
    db.query.websiteDesignOption.findMany({
      where: eq(websiteDesignOption.websiteId, site.id),
      orderBy: (websiteDesignOption, { desc }) => [desc(websiteDesignOption.createdAt)],
    }),
  ]);

  const [database, products, orders, payments] = store
    ? await Promise.all([
        db.query.websiteStoreDatabase.findFirst({ where: eq(websiteStoreDatabase.storeId, store.id) }),
        db.query.storeProduct.findMany({
          where: eq(storeProduct.storeId, store.id),
          orderBy: (storeProduct, { desc }) => [desc(storeProduct.createdAt)],
        }),
        db.query.storeOrder.findMany({
          where: eq(storeOrder.storeId, store.id),
          orderBy: (storeOrder, { desc }) => [desc(storeOrder.createdAt)],
        }),
        db.query.storePayment.findMany({
          where: eq(storePayment.storeId, store.id),
          orderBy: (storePayment, { desc }) => [desc(storePayment.createdAt)],
        }),
      ])
    : [null, [], [], []];

  const productVariants = store
    ? await db.query.storeProductVariant.findMany({ where: eq(storeProductVariant.storeId, store.id) })
    : [];
  const provisioningPlan = safeJsonParse(site.provisioningPlan);
  const medusaProducts = site.siteType === "ecommerce" && site.containerStatus === "running"
    ? await fetchMedusaProductsForWebsite(site).catch(() => null)
    : null;
  const resolvedProducts = medusaProducts ?? products.map((product) => ({
    ...product,
    variants: productVariants.filter((variant) => variant.productId === product.id),
  }));

  const publicDatabase = database
    ? {
        id: database.id,
        engine: database.engine,
        version: database.version,
        host: database.host,
        port: database.port,
        databaseName: database.databaseName,
        username: database.username,
        containerName: database.containerName,
        volumeName: database.volumeName,
        status: database.status,
        backupStatus: database.backupStatus,
      }
    : null;

  return {
    ...site,
    onboardingAnswers: safeJsonParse(site.onboardingAnswers),
    requirementManifest: safeJsonParse(site.requirementManifest),
    buildManifest: safeJsonParse(site.buildManifest),
    provisioningPlan,
    domains,
    plugins,
    designOptions: designOptions.map((option) => ({
      ...option,
      designManifest: safeJsonParse(option.designManifest),
    })),
    store: store ? { ...store, database: publicDatabase } : null,
    products: resolvedProducts,
    orders,
    payments,
    metrics: {
      productCount: resolvedProducts.length,
      orderCount: orders.length,
      paidRevenue: payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0),
      pluginCount: plugins.length,
    },
  };
}

async function fetchMedusaProductsForWebsite(site: typeof website.$inferSelect) {
  const baseUrl = site.temporaryDomain || site.primaryDomain;
  if (!baseUrl) return [];
  const response = await fetch(`https://${baseUrl}/api/cloudmonkey/admin/products`, {
    headers: { "Accept": "application/json" },
  });
  if (!response.ok) throw new Error(`Medusa product fetch failed: ${response.status}`);
  const data = await response.json() as any;
  const products = Array.isArray(data.products) ? data.products : [];
  return products.map((product: any) => ({
    id: product.id,
    storeId: "",
    userId: site.userId,
    title: product.title,
    slug: product.handle || product.slug || product.id,
    description: product.description,
    sku: product.sku || product.variants?.[0]?.sku || null,
    status: product.status || "published",
    price: Number(product.price_amount ?? product.variants?.[0]?.prices?.[0]?.amount ?? 0),
    compareAtPrice: null,
    costPrice: null,
    taxable: true,
    trackInventory: true,
    createdAt: product.created_at ? new Date(product.created_at) : new Date(),
    updatedAt: product.updated_at ? new Date(product.updated_at) : new Date(),
    variants: (product.variants || []).map((variant: any) => ({
      id: variant.id,
      productId: product.id,
      storeId: "",
      sku: variant.sku || null,
      title: variant.title || "Default",
      options: null,
      price: Number(variant.prices?.[0]?.amount ?? product.price_amount ?? 0),
      inventoryQuantity: Number(variant.inventory_quantity ?? 0),
      barcode: null,
      weight: null,
      status: "active",
    })),
  }));
}

async function createMedusaProductForWebsite(site: typeof website.$inferSelect, body: z.infer<typeof storeProductCreateSchema>) {
  const baseUrl = site.temporaryDomain || site.primaryDomain;
  if (!baseUrl) throw new Error("Website has no domain for Medusa API");
  const response = await fetch(`https://${baseUrl}/api/cloudmonkey/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      title: body.title,
      description: body.description,
      sku: body.sku,
      price: body.price,
      inventoryQuantity: body.inventoryQuantity,
      status: body.status === "archived" ? "draft" : "published",
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Medusa product create failed: ${response.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signAgentPayload(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  method: string;
  pathname: string;
  body: string;
}) {
  return crypto
    .createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.nonce}.${input.method.toUpperCase()}.${input.pathname}.${input.body}`)
    .digest("hex");
}

async function readSignedAgentRequest(request: Request, url: URL) {
  const agentId = request.headers.get("x-cm-agent-id");
  const timestamp = request.headers.get("x-cm-timestamp");
  const nonce = request.headers.get("x-cm-nonce");
  const signature = request.headers.get("x-cm-signature");
  const bodyText = await request.text();

  if (!agentId || !timestamp || !nonce || !signature) {
    return { response: json({ error: "Missing agent signature headers" }, 401) };
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) {
    return { response: json({ error: "Stale agent signature" }, 401) };
  }

  const agent = await db.query.serverAgent.findFirst({
    where: eq(serverAgent.id, agentId),
  });
  if (!agent?.secretHash) {
    return { response: json({ error: "Unknown agent" }, 401) };
  }

  const expected = signAgentPayload({
    secret: decryptSecret(agent.secretHash),
    timestamp,
    nonce,
    method: request.method,
    pathname: url.pathname,
    body: bodyText,
  });
  if (!safeEqual(expected, signature)) {
    return { response: json({ error: "Invalid agent signature" }, 401) };
  }

  return { agent, bodyText };
}

async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid request body"), {
      status: 400,
      issues: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

async function recordAudit(input: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  message: string;
  level?: string;
  metadata?: unknown;
}) {
  try {
    await db.insert(auditLog).values({
      id: makeId("audit"),
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      message: input.message,
      level: input.level ?? "info",
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  } catch (error) {
    console.error("Audit write failed:", error);
  }
}

async function getWorkspaceSettings() {
  const existing = await db.query.workspaceSettings.findFirst({
    where: eq(workspaceSettings.id, "default"),
  });
  if (existing) return existing;

  const [created] = await db.insert(workspaceSettings).values({
    id: "default",
    workspaceName: "CloudMonkey Workspace",
  }).onConflictDoNothing().returning();

  return created ?? await db.query.workspaceSettings.findFirst({
    where: eq(workspaceSettings.id, "default"),
  });
}

function formatEmailMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100).replace("ZAR", "ZAR ");
}

function formatEmailDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-ZA", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

function normalizeCouponCode(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function resolveCoupon(value: string | null | undefined) {
  const code = normalizeCouponCode(value);
  if (!code) return null;
  if (code === "amrishtest") {
    return {
      code: "amrishtest",
      label: "Amrish test coupon",
      percentOff: 100,
    };
  }
  return null;
}

function applyPercentDiscount(amountCents: number, percentOff: number) {
  return Math.max(0, amountCents - Math.round((amountCents * percentOff) / 100));
}

async function getInvoiceDocumentPayload(invoiceId: string, activeSession: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>, origin: string) {
  const row = await db.query.invoice.findFirst({
    where: eq(invoice.id, invoiceId),
  });

  if (!row || (row.userId !== activeSession.user.id && !isAdmin(activeSession))) {
    return null;
  }
  if (row.status === "draft" && !isAdmin(activeSession)) {
    return null;
  }

  const [items, customer, settings] = await Promise.all([
    db.query.invoiceItem.findMany({ where: eq(invoiceItem.invoiceId, row.id) }),
    db.query.user.findFirst({ where: eq(user.id, row.userId) }),
    getWorkspaceSettings(),
  ]);
  const document = buildInvoiceDocumentData({ invoice: row, items, customer, workspaceSettings: settings });

  return {
    invoice: row,
    items,
    customer,
    workspaceBilling: document.workspaceBilling,
    totals: document.totals,
    payment: {
      paystackUrl: row.paystackUrl,
      paystackReference: row.paystackReference,
    },
    document,
    html: renderInvoiceHtml(document),
    pdfUrl: `${origin}/api/invoices/${encodeURIComponent(row.id)}/pdf`,
  };
}

async function renderInvoicePdf(document: ReturnType<typeof buildInvoiceDocumentData>) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
    await page.setContent(renderInvoiceHtml(document, { document: true, pdf: true }), { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%; box-sizing:border-box; padding:0 14mm; font-family:Arial,sans-serif; font-size:9px; color:#11182f;">
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
            <div style="font-weight:800; letter-spacing:.02em;">CloudMonkey Invoice</div>
            <div style="color:#5b2ee7; font-weight:700;">${String(document.invoice.invoiceNumber).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</div>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; box-sizing:border-box; padding:0 14mm; font-family:Arial,sans-serif; font-size:8px; color:#5d647a;">
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%; border-top:1px solid #e0e4ee; padding-top:4mm;">
            <div>Cloud made simple. Support that cares.</div>
            <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          </div>
        </div>
      `,
      margin: { top: "22mm", right: "14mm", bottom: "18mm", left: "14mm" },
    });
  } finally {
    await browser.close();
  }
}

async function sendN8nEmail(input: {
  template: string;
  to: string;
  subject: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
}) {
  await sendEmail(input);
}

async function sendN8nWorkflow(input: {
  event: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_EMAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Onboarding workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n onboarding webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return responseText ? JSON.parse(responseText) : { ok: true };
  } catch {
    return { ok: true, body: responseText };
  }
}

async function sendN8nAgentProvisioning(input: {
  agent: Record<string, unknown>;
  user: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_AGENT_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_EMAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Agent provisioning workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: "agent.provision.requested",
      ...input,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n agent provisioning webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return responseText ? JSON.parse(responseText) : { ok: true };
  } catch {
    return { ok: true, body: responseText };
  }
}

async function hasIntelligenceAccess(activeSession: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>) {
  if (isAdmin(activeSession)) return true;
  const rows = await db.query.subscription.findMany({
    where: eq(subscription.userId, activeSession.user.id),
    with: { plan: true },
  });
  return rows.some((row) => {
    if (row.status !== "active" && row.status !== "trialing") return false;
    return isIntelligencePlanId(row.planId) || row.plan?.serviceId === "competitor-intelligence";
  });
}

async function requireIntelligenceAccess(request: Request) {
  const { session, response } = await requireSession(request);
  if (response) return { response };
  const hasAccess = await hasIntelligenceAccess(session);
  if (!hasAccess) {
    return {
      session,
      response: json({
        error: "An active CloudMonkey subscription is required to use Competitor Intelligence",
        code: "subscription_required",
      }, 402),
    };
  }
  return { session };
}

function defaultCompetitorName(websiteUrl: string) {
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl;
  }
}

function publicProjectDto(row: typeof intelligenceProject.$inferSelect) {
  return {
    ...row,
    metadata: safeJsonParse(row.metadata),
  };
}

function publicReportDto(row: typeof intelligenceReport.$inferSelect) {
  return {
    ...row,
    insightPacket: safeJsonParse(row.insightPacket),
    reportJson: safeJsonParse(row.reportJson),
  };
}

function normalizeSearchConsoleProperty(urlString: string) {
  try {
    const parsed = new URL(urlString);
    return {
      urlPrefix: `${parsed.protocol}//${parsed.hostname.replace(/^www\./, "")}/`,
      domainProperty: `sc-domain:${parsed.hostname.replace(/^www\./, "")}`,
      hostname: parsed.hostname.replace(/^www\./, ""),
    };
  } catch {
    const fallback = urlString.replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/^www\./, "");
    return {
      urlPrefix: `https://${fallback}/`,
      domainProperty: `sc-domain:${fallback}`,
      hostname: fallback,
    };
  }
}

async function getGoogleSearchConsoleAccount(userId: string) {
  const accountRow = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
    orderBy: (account, { desc }) => [desc(account.updatedAt)],
  });
  if (!accountRow) return null;

  const scopes = (accountRow.scope ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const hasSearchConsoleScope = scopes.some((scope) =>
    scope === "https://www.googleapis.com/auth/webmasters" ||
    scope === "https://www.googleapis.com/auth/webmasters.readonly",
  );
  if (!hasSearchConsoleScope) return null;

  const now = new Date();
  const accessTokenFresh =
    accountRow.accessToken &&
    (!accountRow.accessTokenExpiresAt || accountRow.accessTokenExpiresAt.getTime() > now.getTime() + 60_000);
  if (accessTokenFresh) {
    return { account: accountRow, accessToken: accountRow.accessToken!, scopes };
  }

  if (!accountRow.refreshToken) {
    return { account: accountRow, accessToken: accountRow.accessToken ?? null, scopes, needsReconnect: true };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: accountRow.refreshToken,
    }),
  });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody.access_token) {
    return { account: accountRow, accessToken: accountRow.accessToken ?? null, scopes, needsReconnect: true };
  }

  const expiresIn = Number(tokenBody.expires_in ?? 3600);
  const refreshedAt = new Date();
  await db.update(account).set({
    accessToken: tokenBody.access_token,
    accessTokenExpiresAt: new Date(refreshedAt.getTime() + expiresIn * 1000),
    refreshToken: tokenBody.refresh_token ?? accountRow.refreshToken,
    scope: tokenBody.scope ? String(tokenBody.scope) : accountRow.scope,
    updatedAt: refreshedAt,
  }).where(eq(account.id, accountRow.id));

  return {
    account: accountRow,
    accessToken: String(tokenBody.access_token),
    scopes,
  };
}

async function fetchGoogleSearchConsoleSnapshot(userId: string, websiteUrl: string) {
  const googleAccount = await getGoogleSearchConsoleAccount(userId);
  if (!googleAccount?.accessToken) {
    return { connected: false as const, reason: googleAccount?.needsReconnect ? "reconnect_required" : "not_connected" };
  }

  const property = normalizeSearchConsoleProperty(websiteUrl);
  const properties = [property.urlPrefix, property.domainProperty];

  const listResponse = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${googleAccount.accessToken}` },
  });
  const listBody = await listResponse.json().catch(() => ({}));
  const availableSites = Array.isArray(listBody?.siteEntry) ? listBody.siteEntry : [];
  const matchedSite = availableSites.find((site: any) => properties.includes(site.siteUrl));
  const siteUrl = matchedSite?.siteUrl ?? properties[0];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000);
  const queryResponse = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAccount.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        dimensions: ["query", "page"],
        rowLimit: 25,
      }),
    },
  );
  const queryBody = await queryResponse.json().catch(() => ({}));
  const rows = Array.isArray(queryBody?.rows) ? queryBody.rows : [];

  return {
    connected: true as const,
    property: siteUrl,
    requestedProperties: properties,
    availableSites: availableSites.slice(0, 25),
    topQueries: rows.slice(0, 10).map((row: any) => ({
      query: row.keys?.[0] ?? "",
      page: row.keys?.[1] ?? null,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    })),
    rows: rows.map((row: any) => ({
      query: row.keys?.[0] ?? "",
      page: row.keys?.[1] ?? null,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    })),
  };
}

function detectTechnologyHints(html: string, headers: Record<string, string>, url: string) {
  const lowerHtml = html.toLowerCase();
  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value ?? "").toLowerCase()]),
  );

  const signals: string[] = [];
  const checks: Array<[string, boolean]> = [
    ["WordPress", lowerHtml.includes("wp-content") || lowerHtml.includes("wordpress") || lowerHtml.includes("elementor")],
    ["Shopify", lowerHtml.includes("cdn.shopify.com") || lowerHtml.includes("shopify")],
    ["Webflow", lowerHtml.includes("webflow") || lowerHtml.includes("w-webflow")],
    ["Wix", lowerHtml.includes("wix.com") || lowerHtml.includes("_wix")],
    ["Squarespace", lowerHtml.includes("squarespace")],
    ["Next.js", lowerHtml.includes("__next") || lowerHtml.includes("/_next/")],
    ["Vite", lowerHtml.includes("vite") || lowerHtml.includes("/@vite/")],
    ["React", lowerHtml.includes("react") && (lowerHtml.includes("root") || lowerHtml.includes("hydrate"))],
    ["Google Tag Manager", lowerHtml.includes("gtm.js") || lowerHtml.includes("googletagmanager.com")],
    ["Meta Pixel", lowerHtml.includes("connect.facebook.net") || lowerHtml.includes("fbq(")],
    ["Cloudflare", lowerHeaders["server"]?.includes("cloudflare") || Boolean(lowerHeaders["cf-ray"])],
    ["Vercel", Boolean(lowerHeaders["x-vercel-id"]) || lowerHtml.includes("vercel")],
    ["WordPress CDN", lowerHtml.includes("wp-content") && lowerHtml.includes("cdn")],
  ];

  for (const [label, matched] of checks) {
    if (matched) signals.push(label);
  }

  const generatorMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  const generator = generatorMatch?.[1] ?? null;
  if (generator) signals.unshift(`Generator: ${generator}`);

  return {
    detectedTechnologies: Array.from(new Set(signals)).slice(0, 10),
    generator,
    headers: {
      server: headers.server ?? null,
      poweredBy: headers["x-powered-by"] ?? null,
      cacheStatus: headers["cf-cache-status"] ?? null,
      vercelId: headers["x-vercel-id"] ?? null,
    },
  };
}

async function crawlSiteFingerprint(websiteUrl: string, target: "primary" | "competitor") {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 1200 } });
    const startedAt = Date.now();
    const response = await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    const html = await page.content();
    const headers = response?.headers() ?? {};
    const title = await page.title().catch(() => null);
    const url = page.url();
    const h1 = await page.locator("h1").first().textContent().catch(() => null);
    const h2Count = await page.locator("h2").count().catch(() => 0);
    const internalLinkCount = await page.locator('a[href^="/"], a[href^="./"], a[href^="../"], a[href^="#"]').count().catch(() => 0);
    const externalLinkCount = await page.locator('a[href^="http"]').count().catch(() => 0);
    const imageMissingAltCount = await page.locator("img:not([alt]), img[alt='']").count().catch(() => 0);
    const metaDescription =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? null;
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
      ?? null;
    const schemaMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) ?? [];
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const wordCount = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
    const tech = detectTechnologyHints(html, headers, url);
    const loadTimeMs = Date.now() - startedAt;

    return {
      id: makeId("intelpage"),
      projectId: "",
      jobId: "",
      userId: "",
      competitorId: null,
      url,
      target,
      httpStatus: response?.status() ?? null,
      title,
      metaDescription,
      h1,
      h2Count,
      wordCount,
      internalLinkCount,
      externalLinkCount,
      imageMissingAltCount,
      hasCanonical: Boolean(canonical),
      hasSchema: schemaMatches.length > 0,
      loadTimeMs,
      screenshotUrl: null,
      raw: {
        sourceUrl: websiteUrl,
        finalUrl: url,
        headers,
        canonical,
        schemaCount: schemaMatches.length,
        tech,
      },
      observedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

async function getIntelligenceProjectForSession(
  projectId: string,
  activeSession: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
) {
  const project = await db.query.intelligenceProject.findFirst({
    where: eq(intelligenceProject.id, projectId),
  });
  if (!project) return null;
  if (project.userId !== activeSession.user.id && !isAdmin(activeSession)) return null;
  return project;
}

async function buildIntelligenceOverview(project: typeof intelligenceProject.$inferSelect) {
  const [
    competitors,
    keywords,
    rankings,
    jobs,
    crawlPages,
    audits,
    issues,
    contentGaps,
    serpResults,
    recommendations,
    reports,
  ] = await Promise.all([
    db.query.intelligenceCompetitor.findMany({
      where: eq(intelligenceCompetitor.projectId, project.id),
      orderBy: (intelligenceCompetitor, { desc }) => [desc(intelligenceCompetitor.visibilityScore)],
    }),
    db.query.intelligenceKeyword.findMany({
      where: eq(intelligenceKeyword.projectId, project.id),
      orderBy: (intelligenceKeyword, { desc }) => [desc(intelligenceKeyword.createdAt)],
    }),
    db.query.intelligenceKeywordRanking.findMany({
      where: eq(intelligenceKeywordRanking.projectId, project.id),
      orderBy: (intelligenceKeywordRanking, { desc }) => [desc(intelligenceKeywordRanking.observedAt)],
    }),
    db.query.intelligenceJob.findMany({
      where: eq(intelligenceJob.projectId, project.id),
      orderBy: (intelligenceJob, { desc }) => [desc(intelligenceJob.createdAt)],
      limit: 10,
    }),
    db.query.intelligenceCrawlPage.findMany({
      where: eq(intelligenceCrawlPage.projectId, project.id),
      orderBy: (intelligenceCrawlPage, { desc }) => [desc(intelligenceCrawlPage.observedAt)],
      limit: 50,
    }),
    db.query.intelligenceSeoAudit.findMany({
      where: eq(intelligenceSeoAudit.projectId, project.id),
      orderBy: (intelligenceSeoAudit, { desc }) => [desc(intelligenceSeoAudit.createdAt)],
      limit: 20,
    }),
    db.query.intelligencePageIssue.findMany({
      where: eq(intelligencePageIssue.projectId, project.id),
      orderBy: (intelligencePageIssue, { desc }) => [desc(intelligencePageIssue.createdAt)],
      limit: 50,
    }),
    db.query.intelligenceContentGap.findMany({
      where: eq(intelligenceContentGap.projectId, project.id),
      orderBy: (intelligenceContentGap, { desc }) => [desc(intelligenceContentGap.createdAt)],
      limit: 50,
    }),
    db.query.intelligenceSerpResult.findMany({
      where: eq(intelligenceSerpResult.projectId, project.id),
      orderBy: (intelligenceSerpResult, { desc }) => [desc(intelligenceSerpResult.observedAt)],
      limit: 100,
    }),
    db.query.intelligenceRecommendation.findMany({
      where: eq(intelligenceRecommendation.projectId, project.id),
      orderBy: (intelligenceRecommendation, { desc }) => [desc(intelligenceRecommendation.createdAt)],
      limit: 25,
    }),
    db.query.intelligenceReport.findMany({
      where: eq(intelligenceReport.projectId, project.id),
      orderBy: (intelligenceReport, { desc }) => [desc(intelligenceReport.createdAt)],
      limit: 5,
    }),
  ]);

  return {
    project: publicProjectDto(project),
    competitors: competitors.map((row) => ({ ...row, metadata: safeJsonParse(row.metadata) })),
    keywords,
    rankings: rankings.map((row) => ({ ...row, serpFeatures: safeJsonParse(row.serpFeatures), raw: safeJsonParse(row.raw) })),
    jobs: jobs.map((row) => ({ ...row, input: safeJsonParse(row.input), output: safeJsonParse(row.output) })),
    crawlPages: crawlPages.map((row) => ({ ...row, raw: safeJsonParse(row.raw) })),
    audits: audits.map((row) => ({ ...row, raw: safeJsonParse(row.raw) })),
    issues,
    contentGaps,
    serpResults: serpResults.map((row) => ({ ...row, raw: safeJsonParse(row.raw) })),
    recommendations,
    reports: reports.map(publicReportDto),
    latestJob: jobs[0] ?? null,
    latestReport: reports[0] ? publicReportDto(reports[0]) : null,
  };
}

async function sendN8nCompetitorIntelligence(input: {
  project: typeof intelligenceProject.$inferSelect;
  job: typeof intelligenceJob.$inferSelect;
  user: Record<string, unknown>;
  competitors: unknown[];
  keywords: unknown[];
  freeCrawlPages?: unknown[];
  freeAudits?: unknown[];
  freeSearchConsoleSnapshot?: unknown;
  freeSearchConsoleSerpResults?: unknown[];
  origin: string;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Competitor Intelligence workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: "intelligence.scan.requested",
      callbackUrl: `${input.origin}/api/webhooks/intelligence/results`,
      dataForSeoConfigured: Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      pageSpeedConfigured: Boolean(process.env.PAGESPEED_API_KEY),
      freeCrawlPages: input.freeCrawlPages ?? [],
      freeAudits: input.freeAudits ?? [],
      freeSearchConsoleSnapshot: input.freeSearchConsoleSnapshot ?? null,
      freeSearchConsoleSerpResults: input.freeSearchConsoleSerpResults ?? [],
      ...input,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n competitor intelligence webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return responseText ? JSON.parse(responseText) : { ok: true };
  } catch {
    return { ok: true, body: responseText };
  }
}

function verifyIntelligenceWebhook(request: Request) {
  const expected = process.env.N8N_COMPETITOR_INTELLIGENCE_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-cloudmonkey-webhook-secret") ?? request.headers.get("x-cloudmonkey-secret");
  return provided === expected;
}

async function sendN8nSupportChat(input: {
  sessionId: string;
  message: string;
  user: Record<string, unknown>;
  context: Record<string, unknown>;
  ragContext?: Record<string, unknown>;
  attachments?: unknown[];
  toolResults?: unknown[];
  clientCapabilities?: Record<string, unknown>;
  event?: string;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_SUPPORT_AGENT_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_SUPPORT_AGENT_WEBHOOK_SECRET ?? process.env.N8N_EMAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Support agent workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: input.event ?? "support.chat.message",
      ...input,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`n8n support agent webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return normalizeSupportAgentResponse(responseText ? JSON.parse(responseText) : {});
  } catch {
    return normalizeSupportAgentResponse({
      reply: responseText || "I could not parse the support assistant response. Please send one more detail and I will try again.",
      createTicket: false,
      intent: "general",
      internalNote: "n8n support assistant returned non-JSON output",
    });
  }
}

type WebsiteDesignPreviewInput = {
  website: Record<string, any>;
  onboardingAnswers: Record<string, any> | null;
};

type WebsiteDesignConcept = {
  styleLabel?: string;
  headline?: string;
  subheadline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  sections?: string[];
  designManifest?: Record<string, any>;
  imagePrompt?: string;
  tokenCost?: number;
  imageCost?: number;
  source?: string;
  order?: number;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

function sanitizeCssColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function buildWebsitePreviewHtml(concept: WebsiteDesignConcept, input: WebsiteDesignPreviewInput) {
  const businessName = input.website.businessName || input.website.name || "CloudMonkey Store";
  const siteType = input.website.siteType === "website" ? "website" : "ecommerce";
  const industry = input.website.industry || input.onboardingAnswers?.industry || "online business";
  const domain = input.website.temporaryDomain || input.website.domain || `${String(businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store"}.cloudmonkey.co.za`;
  const styleLabel = concept.styleLabel || "Website Concept";
  const headline = concept.headline || (siteType === "ecommerce" ? `${businessName} online store` : `${businessName} website`);
  const subheadline = concept.subheadline || `A complete ${industry} experience designed for discovery, trust, and conversion.`;
  const primary = sanitizeCssColor(concept.primaryColor, "#1369e8");
  const secondary = sanitizeCssColor(concept.secondaryColor, "#10b981");
  const accent = sanitizeCssColor(concept.accentColor, "#f59e0b");
  const background = sanitizeCssColor(concept.backgroundColor, "#f6f8fc");
  const sections = concept.sections?.length ? concept.sections.slice(0, 4) : ["Hero", "Products", "Trust", "Contact"];
  const pageSections = Array.isArray(concept.designManifest?.pageSections)
    ? concept.designManifest.pageSections
    : sections;
  const productMode = siteType === "ecommerce";
  if (productMode && (concept.designManifest?.templateKey === "fashion-retail-editorial" || concept.designManifest?.layoutPreset === "fashion-retail-editorial")) {
    return buildFashionRetailPreviewHtml({ businessName, industry, domain, concept, headline, subheadline, primary, secondary, accent, background });
  }
  const sampleProducts = productMode
    ? ["Signature Product", "Customer Favourite", "New Arrival"]
    : ["Strategy", "Implementation", "Support"];
  const sectionCards = pageSections.slice(0, 4).map((section: string, index: number) => `
    <article class="section-card">
      <div class="section-number">0${index + 1}</div>
      <h3>${escapeHtml(String(section).replace(/([A-Z])/g, " $1").trim())}</h3>
      <p>${productMode ? "Configured for product discovery, basket growth, and easy checkout." : "Built to explain the offer clearly and turn visitors into leads."}</p>
    </article>
  `).join("");
  const catalogueCards = sampleProducts.map((item, index) => `
    <article class="product-card">
      <div class="product-image product-${index + 1}">
        <span>${productMode ? "Product" : "Service"}</span>
      </div>
      <div class="product-body">
        <h3>${escapeHtml(item)}</h3>
        <p>${productMode ? "Clean product detail, inventory-aware selling, and CloudMonkey checkout ready." : "A clear service card with benefits, pricing cues, and enquiry flow."}</p>
        <div class="product-meta">
          <strong>${productMode ? "R499" : "From R950"}</strong>
          <button>${productMode ? "Add" : "Enquire"}</button>
        </div>
      </div>
    </article>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: ${background};
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0;
    }
    .page {
      width: 1200px;
      min-height: 1500px;
      margin: 0 auto;
      background: #ffffff;
      overflow: hidden;
      box-shadow: 0 30px 80px rgba(17, 24, 39, 0.14);
    }
    header {
      height: 92px;
      padding: 0 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
      background: rgba(255,255,255,0.96);
    }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 900; }
    .logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, ${primary}, ${secondary}); }
    nav { display: flex; align-items: center; gap: 28px; color: #4b5563; font-size: 15px; font-weight: 700; }
    nav .cta { color: #ffffff; background: ${primary}; padding: 13px 20px; border-radius: 8px; }
    .hero {
      padding: 72px 64px 64px;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 56px;
      align-items: center;
      background:
        linear-gradient(125deg, rgba(19,105,232,0.08), rgba(16,185,129,0.06)),
        #ffffff;
    }
    .eyebrow { color: ${primary}; font-weight: 900; text-transform: uppercase; font-size: 13px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 64px; line-height: 1.02; letter-spacing: 0; max-width: 620px; }
    .hero p { margin: 24px 0 0; color: #4b5563; font-size: 22px; line-height: 1.55; max-width: 600px; }
    .actions { display: flex; gap: 14px; margin-top: 34px; align-items: center; }
    .button { border: 0; padding: 16px 24px; border-radius: 8px; font-weight: 900; font-size: 16px; }
    .primary { background: ${primary}; color: #ffffff; }
    .secondary { background: #111827; color: #ffffff; }
    .domain { margin-top: 26px; color: #6b7280; font-size: 15px; font-weight: 700; }
    .showcase {
      min-height: 500px;
      border-radius: 26px;
      background: ${primary};
      padding: 26px;
      position: relative;
      overflow: hidden;
    }
    .showcase:before { content: ""; position: absolute; width: 280px; height: 280px; border-radius: 50%; right: -72px; top: -72px; background: ${accent}; opacity: 0.95; }
    .browser { position: relative; background: #ffffff; border-radius: 18px; padding: 18px; box-shadow: 0 24px 70px rgba(0,0,0,.22); }
    .browser-bar { display: flex; gap: 8px; margin-bottom: 18px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: #d1d5db; }
    .browser-hero { height: 150px; border-radius: 16px; background: linear-gradient(135deg, ${secondary}, ${accent}); margin-bottom: 18px; }
    .browser-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .mini-card { min-height: 116px; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; }
    .mini-line { height: 12px; border-radius: 999px; background: #e5e7eb; margin-top: 10px; }
    .mini-line.short { width: 62%; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; padding: 36px 64px; background: #111827; color: #ffffff; }
    .stat strong { display: block; font-size: 28px; margin-bottom: 6px; }
    .stat span { color: #d1d5db; font-weight: 700; }
    .section { padding: 64px; }
    .section-head { display: flex; justify-content: space-between; gap: 40px; align-items: end; margin-bottom: 28px; }
    h2 { margin: 0; font-size: 38px; line-height: 1.1; letter-spacing: 0; }
    .section-head p { margin: 0; max-width: 420px; color: #5b6472; font-size: 17px; line-height: 1.45; }
    .catalogue, .section-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .product-card, .section-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; overflow: hidden; }
    .product-image { height: 190px; padding: 18px; color: #ffffff; display: flex; align-items: end; font-weight: 900; font-size: 18px; }
    .product-1 { background: linear-gradient(135deg, ${primary}, #0f172a); }
    .product-2 { background: linear-gradient(135deg, ${secondary}, #064e3b); }
    .product-3 { background: linear-gradient(135deg, ${accent}, #7c2d12); }
    .product-body, .section-card { padding: 22px; }
    .product-body h3, .section-card h3 { margin: 0 0 10px; font-size: 22px; }
    .product-body p, .section-card p { margin: 0; color: #5b6472; line-height: 1.45; }
    .product-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 22px; }
    .product-meta button { border: 0; border-radius: 8px; background: ${primary}; color: #ffffff; padding: 11px 18px; font-weight: 900; }
    .section-number { width: 42px; height: 42px; border-radius: 12px; background: rgba(19,105,232,.1); color: ${primary}; display: grid; place-items: center; font-weight: 900; margin-bottom: 22px; }
    .conversion { display: grid; grid-template-columns: 1fr 380px; gap: 28px; align-items: stretch; padding: 0 64px 64px; }
    .panel { border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 30px; }
    .panel.dark { background: #111827; color: #ffffff; border-color: #111827; }
    .panel h2 { font-size: 32px; margin-bottom: 16px; }
    .panel p { color: inherit; opacity: .75; font-size: 17px; line-height: 1.45; }
    .checkout-row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.14); font-weight: 800; }
    footer { padding: 34px 64px; background: #f3f4f6; display: flex; justify-content: space-between; color: #4b5563; font-weight: 700; }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="brand"><div class="logo"></div><span>${escapeHtml(businessName)}</span></div>
      <nav><span>Home</span><span>${productMode ? "Shop" : "Services"}</span><span>About</span><span>Contact</span><span class="cta">${productMode ? "Cart" : "Get quote"}</span></nav>
    </header>
    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(styleLabel)} concept</div>
        <h1>${escapeHtml(headline)}</h1>
        <p>${escapeHtml(subheadline)}</p>
        <div class="actions"><button class="button primary">${productMode ? "Start shopping" : "Book a consult"}</button><button class="button secondary">Learn more</button></div>
        <div class="domain">${escapeHtml(domain)}</div>
      </div>
      <div class="showcase">
        <div class="browser">
          <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          <div class="browser-hero"></div>
          <div class="browser-grid"><div class="mini-card"><div class="mini-line"></div><div class="mini-line short"></div></div><div class="mini-card"><div class="mini-line"></div><div class="mini-line short"></div></div><div class="mini-card"><div class="mini-line"></div><div class="mini-line short"></div></div><div class="mini-card"><div class="mini-line"></div><div class="mini-line short"></div></div></div>
        </div>
      </div>
    </section>
    <section class="stats"><div class="stat"><strong>7 day</strong><span>trial ready</span></div><div class="stat"><strong>${productMode ? "POS" : "CRM"}</strong><span>enabled</span></div><div class="stat"><strong>ZAR</strong><span>payments</span></div><div class="stat"><strong>SEO</strong><span>configured</span></div></section>
    <section class="section">
      <div class="section-head"><h2>${productMode ? "Storefront and checkout preview" : "Website structure preview"}</h2><p>This preview shows the full visual direction CloudMonkey will use when provisioning the live site.</p></div>
      <div class="catalogue">${catalogueCards}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Page sections</h2><p>Each concept maps to a structured manifest, so the deployed site can be built from approved CloudMonkey components.</p></div>
      <div class="section-grid">${sectionCards}</div>
    </section>
    <section class="conversion">
      <div class="panel"><h2>${productMode ? "Inventory, orders, customers, and delivery from one dashboard." : "Lead capture and customer communication built in."}</h2><p>${productMode ? "The ecommerce runtime connects the storefront to dedicated SQL storage, order management, CloudMonkey gateway options, and store analytics." : "The website runtime connects forms, analytics, domains, and support workflows into the CloudMonkey dashboard."}</p></div>
      <div class="panel dark"><h2>${productMode ? "Checkout" : "Contact"}</h2><div class="checkout-row"><span>${productMode ? "Subtotal" : "Response SLA"}</span><span>${productMode ? "R1,247" : "Same day"}</span></div><div class="checkout-row"><span>${productMode ? "Delivery" : "Channel"}</span><span>${productMode ? "R85" : "WhatsApp"}</span></div><div class="checkout-row"><span>${productMode ? "Total" : "Status"}</span><span>${productMode ? "R1,332" : "Ready"}</span></div></div>
    </section>
    <footer><span>${escapeHtml(businessName)}</span><span>Built on CloudMonkey Websites</span></footer>
  </main>
</body>
</html>`;
}

function buildFashionRetailPreviewHtml(input: {
  businessName: string;
  industry: string;
  domain: string;
  concept: WebsiteDesignConcept;
  headline: string;
  subheadline: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}) {
  const categories = ["New Arrivals", "Women", "Men", "Trendings", "Bags", "Accessories", "Lookbook", "Footwear"];
  const products = ["Linen Shirt", "Classic Dress", "Summer Top", "Mini Dress", "Utility Jacket", "Beach Tote", "Denim Shorts", "Fitted Top"];
  const categoryCards = categories.map((category, index) => `<a class="cat cat-${index + 1}"><span>Shop</span><strong>${escapeHtml(category)}</strong></a>`).join("");
  const productCards = products.map((product, index) => `<article class="product"><div class="pimg pimg-${index + 1}"></div><small>${index % 3 === 0 ? "On sale" : "New"}</small><strong>${escapeHtml(product)}</strong><span>R${[399, 549, 299, 699, 899, 459, 349, 279][index]}</span></article>`).join("");
  const railProductCards = products.slice(0, 6).map((product, index) => `<article class="product"><div class="pimg pimg-${index + 1}"></div><small>${index % 3 === 0 ? "On sale" : "New"}</small><strong>${escapeHtml(product)}</strong><span>R${[399, 549, 299, 699, 899, 459][index]}</span></article>`).join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin:0; background:${input.background}; color:#111827; font-family:Inter,Arial,sans-serif; letter-spacing:0; }
    .page { width:1200px; margin:0 auto; background:#fff; box-shadow:0 30px 80px rgba(17,24,39,.14); overflow:hidden; }
    .top { height:34px; display:flex; justify-content:center; align-items:center; background:#101010; color:#fff; font-size:12px; font-weight:800; }
    header { height:76px; display:flex; justify-content:space-between; align-items:center; padding:0 52px; border-bottom:1px solid #e5e7eb; }
    .brand { font-size:26px; font-weight:950; }
    nav { display:flex; gap:24px; color:#4b5563; font-size:14px; font-weight:800; }
    .icons { display:flex; gap:14px; color:#111827; font-size:13px; font-weight:900; }
    .hero { height:590px; display:grid; grid-template-columns:.95fr 1.05fr; align-items:center; padding:0 60px; background:linear-gradient(105deg,#eff8fb 0%,#f8fbff 48%,#fff 100%); }
    .hero h1 { margin:0 0 18px; font-size:72px; line-height:1; }
    .hero p { color:#4b5563; font-size:21px; line-height:1.45; max-width:520px; }
    .eyebrow { color:${input.primary}; text-transform:uppercase; font-size:12px; font-weight:950; margin-bottom:16px; }
    .button { display:inline-block; background:#111827; color:white; padding:15px 24px; margin-top:18px; font-weight:950; }
    .model { height:500px; border-radius:6px; background:linear-gradient(135deg,rgba(255,255,255,.28),rgba(0,0,0,.18)),linear-gradient(135deg,${input.secondary},${input.primary}); display:flex; align-items:flex-end; justify-content:center; padding:28px; color:#fff; font-size:28px; font-weight:950; }
    .offer { margin:34px 52px; padding:28px 34px; display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:28px; background:#050505; color:#fff; }
    .offer span { color:${input.accent}; font-size:31px; font-weight:950; text-transform:uppercase; }
    .offer a { background:white; color:#111; padding:13px 18px; font-size:13px; font-weight:950; }
    .mosaic { padding:0 52px 58px; display:grid; grid-template-columns:repeat(4,1fr); grid-auto-rows:260px; gap:14px; }
    .cat { position:relative; display:flex; flex-direction:column; justify-content:flex-end; padding:22px; color:white; background:linear-gradient(135deg,${input.primary},#0f172a); overflow:hidden; }
    .cat:before { content:""; position:absolute; inset:0; background:linear-gradient(180deg,transparent,rgba(0,0,0,.62)); }
    .cat span,.cat strong { position:relative; z-index:1; }
    .cat strong { font-size:20px; text-transform:uppercase; }
    .cat-4 { grid-row:span 2; background:linear-gradient(135deg,#0f766e,#111827); }
    .cat-1 { background:linear-gradient(135deg,#a16207,#111827); }
    .cat-2 { background:linear-gradient(135deg,#475569,#111827); }
    .cat-5 { background:linear-gradient(135deg,#92400e,#111827); }
    .section { padding:54px 52px; text-align:center; }
    .section h2 { margin:0; font-size:30px; }
    .section p { color:#667085; margin:8px 0 28px; }
    .rail { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; text-align:left; }
    .product .pimg { aspect-ratio:4/5; background:linear-gradient(135deg,#f1f5f9,#94a3b8); margin-bottom:9px; }
    .product small { color:${input.accent}; text-transform:uppercase; font-weight:950; font-size:10px; }
    .product strong { display:block; font-size:13px; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .product span { color:${input.primary}; font-size:13px; font-weight:950; }
    .collections { display:grid; grid-template-columns:1fr 1fr; gap:18px; padding:0 52px 62px; }
    .collections div { height:330px; display:flex; flex-direction:column; justify-content:flex-end; padding:30px; color:white; text-align:center; background:linear-gradient(135deg,${input.secondary},#111827); }
    .collections div:nth-child(2) { background:linear-gradient(135deg,${input.primary},#111827); }
    .ticker { display:flex; gap:42px; padding:12px; margin:8px -8px 44px; background:#050505; color:white; font-weight:950; text-transform:uppercase; transform:rotate(-2deg); }
    .grid8 { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; text-align:left; }
    .stories,.looks,.insta,.benefits { padding:52px; text-align:center; }
    .storygrid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
    .storygrid div { height:340px; background:linear-gradient(135deg,#111827,#94a3b8); }
    .looksgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
    .looksgrid div { height:330px; background:linear-gradient(135deg,#f1f5f9,#64748b); }
    .quote { padding:56px 52px; display:grid; grid-template-columns:1fr 1fr; gap:36px; align-items:center; }
    .quote div { height:360px; background:linear-gradient(135deg,#cbd5e1,#111827); }
    blockquote { margin:0; padding:46px; background:#f8fafc; font-size:19px; line-height:1.5; }
    .instagrid { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; }
    .instagrid span { aspect-ratio:1; display:grid; place-items:center; background:linear-gradient(135deg,#f8fafc,#94a3b8); color:white; font-weight:950; font-size:24px; }
    .benefits { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; font-weight:950; }
    footer { padding:48px 52px; background:#f3f4f6; display:grid; grid-template-columns:2fr repeat(3,1fr); gap:28px; color:#667085; }
    footer strong { color:#111827; font-size:20px; }
  </style>
</head>
<body>
  <main class="page">
    <div class="top">Market the launch, shipping benefits and limited offers here</div>
    <header><div class="brand">${escapeHtml(input.businessName)}</div><nav><span>Home</span><span>Shop</span><span>Categories</span><span>Lookbook</span><span>Contact</span></nav><div class="icons"><span>Search</span><span>Account</span><span>Cart</span></div></header>
    <section class="hero"><div><div class="eyebrow">New arrivals</div><h1>${escapeHtml(input.headline)}</h1><p>${escapeHtml(input.subheadline)}</p><a class="button">Shop now</a><p>${escapeHtml(input.domain)}</p></div><div class="model">${escapeHtml(input.industry)}</div></section>
    <section class="offer"><strong>Black Friday and Cyber Monday Sale</strong><span>Up to 70% Off</span><a>Shop now</a></section>
    <section class="mosaic">${categoryCards}</section>
    <section class="section"><h2>New In Products</h2><p>Fresh edits selected for your customers.</p><div class="rail">${railProductCards}</div></section>
    <section class="collections"><div><span>Party Collections</span><strong>Occasion-ready styles</strong></div><div><span>Spring/Summer Collections</span><strong>Light seasonal favourites</strong></div></section>
    <div class="ticker"><span>70% Off</span><span>Selected products</span><span>Limited offers</span><span>Secure checkout</span></div>
    <section class="section"><h2>Hot Products</h2><p>Best sellers and promoted items.</p><div class="grid8">${productCards}</div></section>
    <section class="stories"><h2>Video Shoppable</h2><p>Short-form product moments ready for social commerce.</p><div class="storygrid"><div></div><div></div><div></div><div></div></div></section>
    <section class="looks"><h2>Shop The Look</h2><p>Styled editorial combinations.</p><div class="looksgrid"><div></div><div></div><div></div></div></section>
    <section class="quote"><div></div><blockquote>Everything is just as described. The store experience was smooth and delivery updates were clear.<br><br><strong>Verified buyer</strong></blockquote></section>
    <section class="insta"><h2>Instagram Shoppable</h2><p>Image-led discovery connected back to products.</p><div class="instagrid"><span>+</span><span>+</span><span>+</span><span>+</span><span>+</span><span>+</span></div></section>
    <section class="benefits"><span>Fast delivery</span><span>Safe payment</span><span>Online support</span><span>Free returns</span></section>
    <footer><div><strong>${escapeHtml(input.businessName)}</strong><p>CloudMonkey ecommerce template for ${escapeHtml(input.industry)}.</p></div><div>Categories<br>New Arrivals<br>Accessories</div><div>Information<br>About<br>Contact<br>FAQ</div><div>Legal<br>Privacy<br>Terms<br>Returns</div></footer>
  </main>
</body>
</html>`;
}

function buildWebsiteDesignConcepts(input: WebsiteDesignPreviewInput): WebsiteDesignConcept[] {
  const businessName = input.website.businessName || input.website.name || "CloudMonkey Store";
  const industry = input.website.industry || input.onboardingAnswers?.industry || "online business";
  const concepts: WebsiteDesignConcept[] = [
    {
      styleLabel: "Modern Premium",
      headline: `${businessName}`,
      subheadline: `A polished ${industry} storefront with trust-led product discovery.`,
      primaryColor: "#1381ee",
      secondaryColor: "#10b981",
      accentColor: "#f59e0b",
      backgroundColor: "#f6f8fc",
      sections: ["Hero", "Featured products", "Trust", "Contact"],
      designManifest: { theme: "modern-premium", pageSections: ["hero", "featuredProducts", "trust", "contact"], plugins: ["cloudmonkey-paystack-gateway", "basic-seo"] },
    },
    {
      styleLabel: "Bold Commerce",
      headline: "Products front and centre",
      subheadline: "A high-contrast shopping experience built for quick buying decisions.",
      primaryColor: "#111827",
      secondaryColor: "#ef4444",
      accentColor: "#22c55e",
      backgroundColor: "#ffffff",
      sections: ["Categories", "Best sellers", "Offers", "Checkout"],
      designManifest: { theme: "bold-commerce", pageSections: ["categories", "bestSellers", "offers", "checkout"], plugins: ["cloudmonkey-paystack-gateway"] },
    },
    {
      styleLabel: "Editorial Service",
      headline: "Tell the brand story",
      subheadline: "A content-rich website and store hybrid for service-led selling.",
      primaryColor: "#0f766e",
      secondaryColor: "#6366f1",
      accentColor: "#f97316",
      backgroundColor: "#f8fafc",
      sections: ["Story", "Services", "Shop", "Reviews"],
      designManifest: { theme: "editorial-service", pageSections: ["storyHero", "services", "shop", "reviews"], plugins: ["basic-seo", "whatsapp-chat"] },
    },
    {
      styleLabel: "Compact Conversion",
      headline: "Fast path to purchase",
      subheadline: "A lean mobile-first layout for browsing and checkout.",
      primaryColor: "#2563eb",
      secondaryColor: "#14b8a6",
      accentColor: "#eab308",
      backgroundColor: "#ffffff",
      sections: ["Hero", "Products", "Offers", "FAQ"],
      designManifest: { theme: "compact-conversion", pageSections: ["hero", "products", "offers", "faq"], plugins: ["cloudmonkey-paystack-gateway", "basic-seo"] },
    },
  ];
  if (input.website.siteType !== "website") {
    return [
      {
        styleLabel: "Fashion Retail Editorial",
        headline: "Summer Flash Sale",
        subheadline: `A full ecommerce homepage for ${industry} with category discovery, product rails, collections, lookbook, testimonials and shoppable social blocks.`,
        primaryColor: "#111827",
        secondaryColor: "#d97706",
        accentColor: "#ef4444",
        backgroundColor: "#ffffff",
        sections: ["Hero sale", "Category mosaic", "New products", "Collections", "Hot products", "Lookbook", "Instagram"],
        designManifest: {
          templateKey: "fashion-retail-editorial",
          layoutPreset: "fashion-retail-editorial",
          theme: "fashion-retail-editorial",
          industry,
          headline: "Summer Flash Sale",
          subheadline: `A full ecommerce homepage for ${industry} with premium product discovery and secure checkout.`,
          categories: ["New Arrivals", "Women", "Men", "Bags", "Accessories", "Footwear"],
          pageSections: ["promoBar", "hero", "offerStrip", "categoryMosaic", "newProducts", "collections", "saleTicker", "hotProducts", "videoShoppable", "lookbook", "testimonials", "instagram", "benefits"],
          requiredPages: REQUIRED_ECOMMERCE_PAGES.map((page) => page.slug),
          plugins: ["cloudmonkey-paystack-gateway", "basic-seo", "whatsapp-chat"],
        },
      },
      ...concepts.slice(0, 3),
    ];
  }
  return concepts;
}

async function renderWebsiteDesignOptionsAsPng(concepts: WebsiteDesignConcept[], input: WebsiteDesignPreviewInput) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const rendered = [];
    for (const [index, concept] of concepts.slice(0, 4).entries()) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
      try {
        await page.setContent(buildWebsitePreviewHtml(concept, input), { waitUntil: "networkidle" });
        const png = await page.screenshot({ type: "png", fullPage: true });
        const imageUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
        rendered.push({
          ...concept,
          styleLabel: concept.styleLabel || `Concept ${index + 1}`,
          imageUrl,
          thumbnailUrl: imageUrl,
          imagePrompt: concept.imagePrompt || `${concept.styleLabel || `Concept ${index + 1}`} full website PNG preview`,
          tokenCost: Number(concept.tokenCost || 0),
          imageCost: Number(concept.imageCost || 0),
          source: concept.source || "cloudmonkey-preview-renderer",
          order: index + 1,
        });
      } finally {
        await page.close();
      }
    }
    return rendered;
  } finally {
    await browser.close();
  }
}

async function buildFallbackWebsiteDesignOptions(input: WebsiteDesignPreviewInput) {
  return renderWebsiteDesignOptionsAsPng(buildWebsiteDesignConcepts(input), input);
}

async function normalizeWebsiteDesignOptionsAsPng(options: WebsiteDesignConcept[], input: WebsiteDesignPreviewInput) {
  const fallbackConcepts = buildWebsiteDesignConcepts(input);
  const concepts = options.slice(0, 4).map((option, index) => {
    const fallback = fallbackConcepts[index] ?? fallbackConcepts[0];
    const manifest = typeof option.designManifest === "object" && option.designManifest ? option.designManifest : fallback.designManifest;
    return {
      ...fallback,
      ...option,
      designManifest: manifest,
      styleLabel: option.styleLabel || fallback.styleLabel || `Concept ${index + 1}`,
      headline: option.headline || manifest?.headline || fallback.headline,
      subheadline: option.subheadline || manifest?.subheadline || option.imagePrompt || fallback.subheadline,
      sections: Array.isArray(option.sections) ? option.sections : fallback.sections,
    };
  });
  return renderWebsiteDesignOptionsAsPng(concepts.length ? concepts : fallbackConcepts, input);
}

/*
 * Design previews are saved as PNG screenshots, not SVG placeholders. n8n can
 * still supply the concept/manifest, but CloudMonkey renders the final preview
 * image so the dashboard always shows a full-page website look.
 */
async function legacyBuildFallbackWebsiteDesignOptionsUnused(input: {
  website: Record<string, any>;
  onboardingAnswers: Record<string, any> | null;
}) {
  const businessName = input.website.businessName || input.website.name || "CloudMonkey Store";
  const industry = input.website.industry || input.onboardingAnswers?.industry || "online business";
  const concepts = [
    {
      styleLabel: "Modern Premium",
      headline: `${businessName}`,
      subheadline: `A polished ${industry} storefront with trust-led product discovery.`,
      primaryColor: "#1381ee",
      secondaryColor: "#10b981",
      accentColor: "#f59e0b",
      backgroundColor: "#f6f8fc",
      sections: ["Hero", "Featured products", "Trust", "Contact"],
      designManifest: { theme: "modern-premium", pageSections: ["hero", "featuredProducts", "trust", "contact"], plugins: ["cloudmonkey-paystack-gateway", "basic-seo"] },
    },
    {
      styleLabel: "Bold Commerce",
      headline: "Products front and centre",
      subheadline: "A high-contrast shopping experience built for quick buying decisions.",
      primaryColor: "#111827",
      secondaryColor: "#ef4444",
      accentColor: "#22c55e",
      backgroundColor: "#ffffff",
      sections: ["Categories", "Best sellers", "Offers", "Checkout"],
      designManifest: { theme: "bold-commerce", pageSections: ["categories", "bestSellers", "offers", "checkout"], plugins: ["cloudmonkey-paystack-gateway"] },
    },
    {
      styleLabel: "Editorial Service",
      headline: "Tell the brand story",
      subheadline: "A content-rich website and store hybrid for service-led selling.",
      primaryColor: "#0f766e",
      secondaryColor: "#6366f1",
      accentColor: "#f97316",
      backgroundColor: "#f8fafc",
      sections: ["Story", "Services", "Shop", "Reviews"],
      designManifest: { theme: "editorial-service", pageSections: ["storyHero", "services", "shop", "reviews"], plugins: ["basic-seo", "whatsapp-chat"] },
    },
    {
      styleLabel: "Compact Conversion",
      headline: "Fast path to purchase",
      subheadline: "A lean mobile-first layout for browsing and checkout.",
      primaryColor: "#2563eb",
      secondaryColor: "#14b8a6",
      accentColor: "#eab308",
      backgroundColor: "#ffffff",
      sections: ["Hero", "Products", "Offers", "FAQ"],
      designManifest: { theme: "compact-conversion", pageSections: ["hero", "products", "offers", "faq"], plugins: ["cloudmonkey-paystack-gateway", "basic-seo"] },
    },
  ];

  const escapeXml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] ?? char));
  return concepts.map((concept, index) => {
    const sectionCards = concept.sections.map((section, sectionIndex) => `
      <rect x="${72 + sectionIndex * 146}" y="330" width="118" height="74" rx="10" fill="white" opacity="0.92"/>
      <text x="${92 + sectionIndex * 146}" y="371" font-size="14" font-family="Inter,Arial" font-weight="700" fill="#111827">${escapeXml(section)}</text>
    `).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
      <rect width="1200" height="760" fill="${concept.backgroundColor}"/>
      <rect x="56" y="48" width="1088" height="664" rx="28" fill="white" stroke="#dfe4ef"/>
      <circle cx="104" cy="91" r="18" fill="${concept.primaryColor}"/>
      <text x="136" y="98" font-size="22" font-family="Inter,Arial" font-weight="800" fill="#07102c">${escapeXml(businessName)}</text>
      <rect x="890" y="74" width="96" height="34" rx="17" fill="${concept.primaryColor}"/>
      <rect x="1000" y="74" width="96" height="34" rx="17" fill="${concept.secondaryColor}"/>
      <rect x="96" y="180" width="490" height="420" rx="26" fill="${concept.primaryColor}" opacity="0.10"/>
      <text x="122" y="224" font-size="18" font-family="Inter,Arial" font-weight="800" fill="${concept.primaryColor}">${escapeXml(concept.styleLabel)}</text>
      <text x="122" y="286" font-size="46" font-family="Inter,Arial" font-weight="900" fill="#07102c">${escapeXml(concept.headline)}</text>
      <text x="124" y="336" font-size="22" font-family="Inter,Arial" fill="#4d5874">${escapeXml(concept.subheadline)}</text>
      <rect x="124" y="392" width="168" height="48" rx="24" fill="${concept.primaryColor}"/>
      <text x="158" y="423" font-size="17" font-family="Inter,Arial" font-weight="800" fill="white">Shop now</text>
      <rect x="312" y="392" width="168" height="48" rx="24" fill="${concept.accentColor}"/>
      <text x="346" y="423" font-size="17" font-family="Inter,Arial" font-weight="800" fill="#111827">View demo</text>
      <rect x="654" y="178" width="388" height="270" rx="28" fill="${concept.primaryColor}"/>
      <circle cx="980" cy="224" r="72" fill="${concept.accentColor}" opacity="0.9"/>
      <rect x="698" y="490" width="300" height="48" rx="12" fill="#eef2ff"/>
      <rect x="698" y="554" width="240" height="48" rx="12" fill="#ecfdf5"/>
      ${sectionCards}
    </svg>`;
    const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    return {
      styleLabel: concept.styleLabel,
      imageUrl,
      thumbnailUrl: imageUrl,
      imagePrompt: `${concept.styleLabel} website preview for ${businessName}`,
      designManifest: concept.designManifest,
      tokenCost: 0,
      imageCost: 0,
      source: "fallback",
      order: index + 1,
    };
  });
}

async function sendN8nWebsiteDesignPreviews(input: {
  website: Record<string, unknown>;
  onboardingAnswers: Record<string, unknown> | null;
  provisioningPlan: Record<string, unknown> | null;
  generationContext?: Record<string, unknown>;
  user: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_WEBSITE_DESIGN_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBSITE_DESIGN_WEBHOOK_SECRET ?? process.env.N8N_EMAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    return {
      ok: true,
      workflow: "local-fallback",
      options: await buildFallbackWebsiteDesignOptions({
        website: input.website as Record<string, any>,
        onboardingAnswers: input.onboardingAnswers as Record<string, any> | null,
      }),
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: "website.design_previews.requested",
      ...input,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`n8n website design preview webhook failed: ${response.status} ${responseText}`);
    return {
      ok: true,
      workflow: "local-fallback",
      warning: `n8n website design preview webhook failed: ${response.status}`,
      options: await buildFallbackWebsiteDesignOptions({
        website: input.website as Record<string, any>,
        onboardingAnswers: input.onboardingAnswers as Record<string, any> | null,
      }),
    };
  }

  try {
    const parsed = responseText ? JSON.parse(responseText) : {};
    const rawOptions = Array.isArray(parsed.options) && parsed.options.length
      ? parsed.options
      : await buildFallbackWebsiteDesignOptions({
          website: input.website as Record<string, any>,
          onboardingAnswers: input.onboardingAnswers as Record<string, any> | null,
        });
    const options = await normalizeWebsiteDesignOptionsAsPng(rawOptions, {
      website: input.website as Record<string, any>,
      onboardingAnswers: input.onboardingAnswers as Record<string, any> | null,
    });
    return { ...parsed, options };
  } catch {
    return {
      ok: true,
      workflow: "local-fallback",
      options: await buildFallbackWebsiteDesignOptions({
        website: input.website as Record<string, any>,
        onboardingAnswers: input.onboardingAnswers as Record<string, any> | null,
      }),
    };
  }
}

function getWebsiteDesignGenerationContext(siteType: string | null | undefined) {
  const isEcommerce = siteType === "ecommerce";
  return {
    costPolicy: {
      mode: "manifest_first",
      rule: "Use Gemini for structured concepts and manifests only. CloudMonkey renders PNG screenshots from approved components with Playwright.",
      avoid: ["full repository prompts", "raw source dumps", "per-customer app generation", "paid image generation unless explicitly requested"],
      maxConcepts: 4,
      maxOutputTokens: 3600,
    },
    modelPolicy: {
      defaultModel: process.env.GEMINI_WEBSITE_DESIGN_MODEL ?? "gemini-2.5-pro",
      fallbackModel: process.env.GEMINI_WEBSITE_DESIGN_FALLBACK_MODEL ?? "gemini-2.5-flash",
      useAdvancedModelFor: ["requirements synthesis", "theme direction", "component selection", "final build manifest"],
      useRendererFor: ["PNG previews", "layout screenshots", "repeatable visual output"],
    },
    repositories: [
      {
        key: "cloudmonkey-website-template",
        type: "website",
        useWhen: "Brochure, service, booking, lead generation, portfolio, contact-heavy sites.",
        components: ["site-header", "hero-split", "hero-centered", "service-grid", "gallery-grid", "lead-form", "reviews", "faq", "footer"],
      },
      {
        key: "cloudmonkey-commerce-template",
        type: "ecommerce",
        useWhen: "Stores needing products, inventory, orders, customers, checkout, POS, delivery, and payments.",
        components: ["commerce-header", "commerce-hero", "category-grid", "product-grid", "featured-products", "cart-summary", "checkout-panel", "inventory-alerts", "reviews", "footer"],
        layoutPresets: [
          {
            key: "fashion-retail-editorial",
            useWhen: "Fashion, apparel, accessories, beauty, lifestyle retail, boutiques, and image-led ecommerce.",
            sections: ["promoBar", "hero", "offerStrip", "categoryMosaic", "newProducts", "collections", "saleTicker", "hotProducts", "videoShoppable", "lookbook", "testimonials", "instagram", "benefits"],
          },
        ],
      },
      {
        key: "cloudmonkey-plugin-registry",
        type: "plugins",
        useWhen: "Only select approved plugins from this registry.",
        components: ["cloudmonkey-paystack-gateway", "customer-paystack-gateway", "local-delivery", "store-pickup", "whatsapp-chat", "seo-basic", "google-analytics", "facebook-pixel", "pos-basic"],
      },
    ],
    requiredManifestShape: {
      siteType: isEcommerce ? "ecommerce" : "website",
      templateKey: isEcommerce ? "Use approved layout preset keys such as fashion-retail-editorial when appropriate." : "Use approved website template keys.",
      theme: ["style", "primaryColor", "secondaryColor", "accentColor", "backgroundColor", "fontPairing", "density"],
      pages: isEcommerce ? REQUIRED_ECOMMERCE_PAGES.map((page) => page.slug) : ["slug", "template", "sections"],
      plugins: "approved plugin keys only",
      notes: "short implementation notes for CloudMonkey provisioner",
    },
  };
}

const SUPPORT_RAG_DIMENSIONS = Number(process.env.SUPPORT_RAG_DIMENSIONS ?? 768);
const SUPPORT_RAG_TOP_K = Number(process.env.SUPPORT_RAG_TOP_K ?? 6);
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function redactSupportKnowledge(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone]")
    .replace(/\b(?:sk|pk|api|key|token|secret|password)[_\-:=\s]+[A-Za-z0-9_.\-]{8,}/gi, "[secret]")
    .slice(0, 6000);
}

function vectorLiteral(values: number[]) {
  if (values.length !== SUPPORT_RAG_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid embedding vector");
  }
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

async function embedSupportText(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = GEMINI_EMBEDDING_MODEL.startsWith("models/")
    ? GEMINI_EMBEDDING_MODEL
    : `models/${GEMINI_EMBEDDING_MODEL}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      content: { parts: [{ text: redactSupportKnowledge(text) }] },
      taskType,
      outputDimensionality: SUPPORT_RAG_DIMENSIONS,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status} ${body.error?.message ?? ""}`.trim());
  }
  const values = body.embedding?.values ?? body.embeddings?.[0]?.values;
  return Array.isArray(values) ? values.map((value: unknown) => Number(value)) : null;
}

function summarizeDynamicSupportContext(context: Record<string, unknown>) {
  const domains = Array.isArray(context.domains) ? context.domains : [];
  const servers = Array.isArray(context.servers) ? context.servers : [];
  const websites = Array.isArray(context.websites) ? context.websites : [];
  const tickets = Array.isArray(context.tickets) ? context.tickets : [];
  const subscriptions = Array.isArray(context.subscriptions) ? context.subscriptions : [];
  const invoices = Array.isArray(context.invoices) ? context.invoices : [];
  return {
    customerAssets: {
      domains: domains.slice(0, 8).map((row: any) => ({ id: row.id, status: row.status, expiryDate: row.expiryDate })),
      servers: servers.slice(0, 8).map((row: any) => ({ id: row.id, label: row.label, status: row.status, region: row.region })),
      websites: websites.slice(0, 8).map((row: any) => ({ id: row.id, domain: row.domain, status: row.status })),
      subscriptions: subscriptions.slice(0, 8).map((row: any) => ({ id: row.id, name: row.name, status: row.status, interval: row.interval })),
    },
    recentSupport: tickets.slice(0, 5).map((row: any) => ({
      id: row.id,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      category: row.category,
      resolutionSummary: row.resolutionSummary,
    })),
    billing: invoices.slice(0, 5).map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.dueDate,
    })),
  };
}

async function retrieveSupportKnowledge(input: {
  userId: string;
  message: string;
  context: Record<string, unknown>;
}) {
  const dynamicContext = summarizeDynamicSupportContext(input.context);
  const fallbackContext = {
    memoryEnabled: Boolean(process.env.GEMINI_API_KEY),
    retrievedKnowledge: [],
    dynamicContext,
    instructions: [
      "Use retrievedKnowledge only when it matches the user's request.",
      "Use dynamicContext for customer-specific account, billing, domain, server, website, and subscription facts.",
      "Ask a clarifying question when confidence is low.",
      "Do not create a support ticket for normal guidance, FAQs, product selection, read-only domain checks, or DNS explanations.",
    ],
  };

  try {
    const embedding = await embedSupportText(input.message, "RETRIEVAL_QUERY");
    if (!embedding) return fallbackContext;
    const literal = vectorLiteral(embedding);
    const rows = await db.execute(sql`
      SELECT
        c."id",
        c."chunkText",
        c."confidence",
        c."metadata",
        s."title",
        s."sourceType",
        s."visibility",
        1 - (c."embedding" <=> ${literal}::vector) AS "score"
      FROM "support_knowledge_chunk" c
      JOIN "support_knowledge_source" s ON s."id" = c."sourceId"
      WHERE c."status" = 'active'
        AND s."status" = 'active'
        AND (c."userId" IS NULL OR c."userId" = ${input.userId})
        AND (s."userId" IS NULL OR s."userId" = ${input.userId})
      ORDER BY c."embedding" <=> ${literal}::vector
      LIMIT ${SUPPORT_RAG_TOP_K}
    `);
    return {
      ...fallbackContext,
      retrievedKnowledge: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        sourceType: row.sourceType,
        visibility: row.visibility,
        score: Number(row.score ?? 0),
        confidence: row.confidence,
        text: row.chunkText,
        metadata: safeJsonParse(row.metadata),
      })).filter((row: any) => row.score >= 0.45),
    };
  } catch (error) {
    console.error("Support RAG retrieval failed:", error);
    return fallbackContext;
  }
}

function shouldCreateEmergencyFallbackTicket(message: string) {
  const haystack = message.toLowerCase();
  return [
    "human",
    "support ticket",
    "agent",
    "site down",
    "website down",
    "cannot access",
    "can't access",
    "payment taken",
    "charged",
    "security breach",
    "hacked",
  ].some((phrase) => haystack.includes(phrase));
}

async function storeSupportLearning(input: {
  userId: string;
  sessionId: string;
  ticketId?: string | null;
  message: string;
  reply: string;
  intent?: string;
  summary?: string;
  createTicket: boolean;
}) {
  if (input.createTicket || !process.env.GEMINI_API_KEY) return;
  const reusableIntents = new Set(["billing", "signup_guidance", "domain_check", "dns_query", "onboarding", "general"]);
  if (input.intent && !reusableIntents.has(input.intent)) return;

  const summary = redactSupportKnowledge(input.summary || `Customer asked: ${input.message}\nAssistant answered: ${input.reply}`);
  if (summary.length < 80) return;

  try {
    const embedding = await embedSupportText(summary, "RETRIEVAL_DOCUMENT");
    if (!embedding) return;
    const now = new Date();
    const sourceId = makeId("ksrc");
    const chunkId = makeId("kchunk");
    const eventId = makeId("klearn");
    await db.insert(supportKnowledgeSource).values({
      id: sourceId,
      userId: input.userId,
      sourceType: "support_chat_summary",
      title: `AI chat summary ${input.sessionId}`,
      visibility: "customer",
      status: "active",
      metadata: JSON.stringify({ sessionId: input.sessionId, intent: input.intent ?? null }),
      createdAt: now,
      updatedAt: now,
    });
    await db.execute(sql`
      INSERT INTO "support_knowledge_chunk"
        ("id", "sourceId", "userId", "chunkText", "embedding", "tokenEstimate", "confidence", "status", "metadata", "createdAt", "updatedAt")
      VALUES
        (${chunkId}, ${sourceId}, ${input.userId}, ${summary}, ${vectorLiteral(embedding)}::vector, ${estimateTokens(summary)}, 70, 'active', ${JSON.stringify({ sessionId: input.sessionId, intent: input.intent ?? null })}, ${now}, ${now})
    `);
    await db.insert(supportLearningEvent).values({
      id: eventId,
      userId: input.userId,
      sessionId: input.sessionId,
      ticketId: input.ticketId ?? null,
      sourceId,
      eventType: "support_chat_summary",
      summary,
      status: "stored",
      metadata: JSON.stringify({ intent: input.intent ?? null }),
    });
  } catch (error) {
    console.error("Support learning storage failed:", error);
  }
}

function normalizeSupportAgentResponse(input: unknown) {
  const parsed = supportAgentResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      reply: "I could not process the support assistant response. Please send one more detail and I will try again.",
      intent: "general" as const,
      createTicket: false,
      toolCalls: [],
      suggestedActions: [],
      internalNote: JSON.stringify(parsed.error.flatten()),
    };
  }

  const data = parsed.data;
  return {
    ...data,
    reply: data.reply ?? data.message ?? "I can help with that. Please send one more detail so I can give you the right next step.",
    createTicket: data.createTicket ?? false,
    toolCalls: data.toolCalls ?? [],
    suggestedActions: data.suggestedActions ?? [],
  };
}

async function executeSupportToolCalls(userId: string, toolCalls: z.infer<typeof supportAgentToolCallSchema>[]) {
  const results = [];
  for (const toolCall of toolCalls.slice(0, 4)) {
    try {
      if (toolCall.type === "domain_availability") {
        results.push({ toolCall, ok: true, data: await checkDomainAvailability(toolCall.domain) });
      } else if (toolCall.type === "owned_domains") {
        const domains = await db.query.registeredDomain.findMany({ where: eq(registeredDomain.userId, userId) });
        results.push({ toolCall, ok: true, data: domains });
      } else if (toolCall.type === "domain_dns") {
        results.push({ toolCall, ok: true, data: await fetchOwnedDomainDns(userId, toolCall.domain) });
      } else if (toolCall.type === "domain_info") {
        results.push({ toolCall, ok: true, data: await fetchOwnedDomainInfo(userId, toolCall.domain) });
      }
    } catch (error) {
      results.push({
        toolCall,
        ok: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      });
    }
  }
  return results;
}

async function getSupportCrmContext(userId: string) {
  const [domains, servers, sites, tickets, subs, invoices] = await Promise.all([
    db.query.registeredDomain.findMany({ where: eq(registeredDomain.userId, userId) }),
    db.query.vultrInstance.findMany({ where: eq(vultrInstance.userId, userId) }),
    db.query.website.findMany({ where: eq(website.userId, userId) }),
    db.query.supportTicket.findMany({ where: eq(supportTicket.userId, userId), orderBy: (supportTicket, { desc }) => [desc(supportTicket.updatedAt)] }),
    db.query.subscription.findMany({ where: eq(subscription.userId, userId), orderBy: (subscription, { desc }) => [desc(subscription.updatedAt)] }),
    db.query.invoice.findMany({ where: eq(invoice.userId, userId), orderBy: (invoice, { desc }) => [desc(invoice.createdAt)] }),
  ]);
  return {
    domains,
    servers,
    websites: sites,
    tickets: tickets.slice(0, 10),
    subscriptions: subs,
    invoices: invoices.filter((row) => row.status !== "void").slice(0, 10),
  };
}

async function tryRegisterPaidDomainOrder(order: typeof domainOrder.$inferSelect, requestUrl: string) {
  const domainName = order.domainName.toLowerCase();
  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  const registerUrl = process.env.DOMAINS_CO_ZA_REGISTER_URL;

  if (!apiKey || !registerUrl) {
    await createDomainRegistrationTicket(order, "Domains API registration endpoint is not configured", requestUrl);
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

    await db.transaction(async (tx) => {
      await tx.insert(registeredDomain).values({
        id: domainName,
        userId: order.userId,
        status: "active",
        expiryDate: null,
      }).onConflictDoUpdate({
        target: registeredDomain.id,
        set: {
          userId: order.userId,
          status: "active",
          updatedAt: new Date(),
        },
      });
      await tx.update(domainOrder).set({
        status: "registered",
        providerResponse: text,
        registeredAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(domainOrder.id, order.id));
    });
  } catch (error: any) {
    await db.update(domainOrder).set({
      status: "registration_failed",
      providerError: error.message,
      updatedAt: new Date(),
    }).where(eq(domainOrder.id, order.id));
    await createDomainRegistrationTicket(order, error.message, requestUrl);
  }
}

async function createDomainRegistrationTicket(order: typeof domainOrder.$inferSelect, errorMessage: string, requestUrl: string) {
  const existing = await db.query.supportTicket.findFirst({
    where: eq(supportTicket.aiSessionId, `domain-order:${order.id}`),
  });
  if (existing) return existing;

  const [created] = await db.insert(supportTicket).values({
    id: makeId("ticket"),
    userId: order.userId,
    subject: `Domain registration follow-up: ${order.domainName}`,
    description: `Domain order ${order.id} was paid but needs manual registration follow-up.\n\n${errorMessage}`,
    priority: "high",
    status: "open",
    category: "domains",
    source: "system",
    aiSessionId: `domain-order:${order.id}`,
  }).returning();

  await recordAudit({
    action: "domain.registration_followup.created",
    entityType: "domain_order",
    entityId: order.id,
    message: `Domain registration follow-up created for ${order.domainName}`,
    level: "warning",
    metadata: { ticketId: created.id, error: errorMessage, url: requestUrl },
  });
  return created;
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
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
      const invoiceId = data.metadata?.invoice_id
        ?? data.metadata?.custom_fields?.find((f: any) => f.variable_name === "invoice_id")?.value;

      if (invoiceId) {
        const existingInvoice = await db.query.invoice.findFirst({
          where: eq(invoice.id, invoiceId),
        });

        if (existingInvoice) {
          if (existingInvoice.status !== "paid") {
            await db.update(invoice).set({
              status: "paid",
              paidAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(invoice.id, invoiceId));
          }

          const existingSubscription = await db.query.subscription.findFirst({
            where: eq(subscription.id, invoiceId),
          });

          if (existingSubscription) {
            await db.update(subscription).set({
              status: "active",
              updatedAt: new Date(),
              currentPeriodStart: new Date(),
            }).where(eq(subscription.id, invoiceId));
          }

          await createAffiliateCommissionForPayment({
            invoiceId,
            customerId: existingInvoice.userId,
            amount: existingInvoice.amount,
            subscriptionId: existingSubscription?.id ?? invoiceId,
            paymentId: data.reference ?? invoiceId,
          });

          await recordAudit({
            action: "subscription.activated",
            entityType: "subscription",
            entityId: invoiceId,
            message: `Subscription activated after Paystack payment for invoice ${invoiceId}`,
            metadata: { reference: data.reference, invoiceId },
          });
          const existingUser = await db.query.user.findFirst({ where: eq(user.id, existingInvoice.userId) });
          if (existingUser?.email && existingSubscription) {
            sendEmail({
              template: "payment_received",
              to: existingUser.email,
              subject: `Payment received for ${existingSubscription.name}`,
              data: {
                firstName: existingUser.name,
                productName: existingSubscription.name,
                subscriptionName: existingSubscription.name,
                totalDue: formatEmailMoney(existingInvoice.amount, existingInvoice.currency ?? "ZAR"),
                primaryCtaText: "Open dashboard",
                primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
              },
              idempotencyKey: `payment:${invoiceId}:received`,
            }).catch((error) => console.error("Payment receipt email failed:", error));
          }
          const paidDomainOrder = await db.query.domainOrder.findFirst({
            where: eq(domainOrder.invoiceId, invoiceId),
          });
          if (paidDomainOrder && !["registered", "registration_failed"].includes(paidDomainOrder.status)) {
            await db.update(domainOrder).set({
              status: "paid",
              updatedAt: new Date(),
            }).where(eq(domainOrder.id, paidDomainOrder.id));
            tryRegisterPaidDomainOrder(paidDomainOrder, request.url).catch((error) => {
              console.error("Domain registration follow-up failed:", error);
            });
          }
          console.log(`Invoice ${invoiceId} marked as paid and subscription activated.`);
        }
      }
    }

    return new Response("Webhook received", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal error", { status: 500 });
  }
}

async function handleDomainsCheck(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");

  if (!domain) {
    return new Response(JSON.stringify({ error: "Domain parameter is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const parts = domain.split(".");
  if (parts.length < 2) {
    return new Response(JSON.stringify({ error: "Invalid domain format" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const sld = parts[0];
  const tld = parts.slice(1).join(".");

  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey || apiKey === "your_domains_co_za_key") {
    return json({ error: "Domain availability is not configured" }, 503);
  }

  try {
    const response = await fetch(`https://api.domains.co.za/api/domain/check?sld=${sld}&tld=${tld}&key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`Domains API error: ${response.status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Domains API error:", error);
    return new Response(JSON.stringify({ error: "Failed to check domain" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

function splitDomainName(domain: string) {
  const value = domain.trim().toLowerCase();
  const parts = value.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw Object.assign(new Error("Invalid domain format"), { status: 400 });
  }
  return { domain: value, sld: parts[0], tld: parts.slice(1).join(".") };
}

async function checkDomainAvailability(domain: string) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey || apiKey === "your_domains_co_za_key") {
    throw Object.assign(new Error("Domain availability is not configured"), { status: 503 });
  }

  const response = await fetch(`https://api.domains.co.za/api/domain/check?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`);
  if (!response.ok) throw new Error(`Domains API error: ${response.status}`);
  const data = await response.json();
  return { domain: normalizedDomain, result: data };
}

async function fetchOwnedDomainDns(userId: string, domain: string) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const ownership = await db.query.registeredDomain.findFirst({
    where: eq(registeredDomain.id, normalizedDomain),
  });
  if (!ownership || ownership.userId !== userId) {
    throw Object.assign(new Error("Domain is not assigned to this account"), { status: 403 });
  }

  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Domains API is not configured"), { status: 503 });
  const response = await fetch(`https://api.domains.co.za/api/domain/dns?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`);
  if (!response.ok) throw new Error(`Domains DNS API error: ${response.status}`);
  return { domain: normalizedDomain, result: await response.json() };
}

async function fetchOwnedDomainInfo(userId: string, domain: string) {
  const { domain: normalizedDomain, sld, tld } = splitDomainName(domain);
  const ownership = await db.query.registeredDomain.findFirst({
    where: eq(registeredDomain.id, normalizedDomain),
  });
  if (!ownership || ownership.userId !== userId) {
    throw Object.assign(new Error("Domain is not assigned to this account"), { status: 403 });
  }

  const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Domains API is not configured"), { status: 503 });
  const response = await fetch(`https://api.domains.co.za/api/domain/info?sld=${encodeURIComponent(sld)}&tld=${encodeURIComponent(tld)}&key=${apiKey}`);
  if (!response.ok) throw new Error(`Domains info API error: ${response.status}`);
  return { domain: normalizedDomain, result: await response.json() };
}

type ProviderDomain = {
  domainName: string;
  status: string | null;
  expiryDate: string | null;
  raw: unknown;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseProviderDate(value: unknown) {
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

function getDomainNameFromProvider(item: any) {
  const fullName = firstString(
    item?.domainName,
    item?.domain,
    item?.name,
    item?.strDomain,
    item?.strDomainName,
    item?.fqdn,
  );
  if (fullName?.includes(".")) return fullName.toLowerCase();

  const sld = firstString(item?.sld, item?.strSLD, item?.strSld);
  const tld = firstString(item?.tld, item?.strTLD, item?.strTld);
  if (sld && tld) return `${sld}.${tld.replace(/^\./, "")}`.toLowerCase();

  return fullName?.toLowerCase() ?? null;
}

function normalizeProviderDomains(payload: any): ProviderDomain[] {
  const candidates = [
    payload?.arrDomains,
    payload?.domains,
    payload?.data,
    payload?.items,
    Array.isArray(payload) ? payload : null,
  ].find(Array.isArray) ?? [];

  return candidates
    .map((item: any) => {
      const domainName = getDomainNameFromProvider(item);
      if (!domainName) return null;

      return {
        domainName,
        status: firstString(item?.status, item?.strStatus, item?.domainStatus),
        expiryDate: parseProviderDate(item?.expiryDate ?? item?.expiresAt ?? item?.intExDate ?? item?.expiry ?? item?.renewalDate),
        raw: item,
      };
    })
    .filter((item): item is ProviderDomain => !!item);
}

function getAssignedUserMap<T extends { id: string; userId: string }>(rows: T[], key: (row: T) => string) {
  return new Map(rows.map((row) => [key(row), row]));
}

function getAgentConfig() {
  return {
    heartbeatIntervalSeconds: 60,
    snapshotIntervalSeconds: 300,
    dockerEnabled: true,
    websiteDiscoveryEnabled: true,
    securityScanEnabled: true,
  };
}

function getRemoteIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? null;
}

function toJsonText(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function toDateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function persistIntelligenceWebhookResult(body: z.infer<typeof intelligenceWebhookResultSchema>) {
  const job = await db.query.intelligenceJob.findFirst({
    where: eq(intelligenceJob.id, body.jobId),
  });
  if (!job) {
    throw Object.assign(new Error("Intelligence job not found"), { status: 404 });
  }

  const project = await db.query.intelligenceProject.findFirst({
    where: eq(intelligenceProject.id, job.projectId),
  });
  if (!project) {
    throw Object.assign(new Error("Intelligence project not found"), { status: 404 });
  }

  const now = new Date();
  const existingCompetitors = await db.query.intelligenceCompetitor.findMany({
    where: eq(intelligenceCompetitor.projectId, project.id),
  });
  const competitorIds = new Set(existingCompetitors.map((row) => row.id));
  const competitorByUrl = new Map(existingCompetitors.map((row) => [row.websiteUrl, row]));

  for (const competitorInput of body.competitors) {
    const existing = competitorByUrl.get(competitorInput.websiteUrl) ?? (competitorInput.id ? existingCompetitors.find((row) => row.id === competitorInput.id) : null);
    const values = {
      name: competitorInput.name,
      websiteUrl: competitorInput.websiteUrl,
      competitorType: competitorInput.competitorType ?? "organic",
      visibilityScore: competitorInput.visibilityScore ?? existing?.visibilityScore ?? 0,
      technicalSeoScore: competitorInput.technicalSeoScore ?? existing?.technicalSeoScore ?? 0,
      contentSeoScore: competitorInput.contentSeoScore ?? existing?.contentSeoScore ?? 0,
      localSeoScore: competitorInput.localSeoScore ?? existing?.localSeoScore ?? 0,
      metadata: toJsonText(competitorInput.metadata),
      updatedAt: now,
    };
    if (existing) {
      await db.update(intelligenceCompetitor).set(values).where(eq(intelligenceCompetitor.id, existing.id));
      competitorIds.add(existing.id);
    } else {
      const [created] = await db.insert(intelligenceCompetitor).values({
        id: competitorInput.id && !competitorIds.has(competitorInput.id) ? competitorInput.id : makeId("intelcomp"),
        projectId: project.id,
        userId: project.userId,
        ...values,
      }).returning();
      competitorIds.add(created.id);
      competitorByUrl.set(created.websiteUrl, created);
    }
  }

  const existingKeywords = await db.query.intelligenceKeyword.findMany({
    where: eq(intelligenceKeyword.projectId, project.id),
  });
  const keywordIds = new Set(existingKeywords.map((row) => row.id));

  if (body.rankings.length) {
    await db.insert(intelligenceKeywordRanking).values(body.rankings.map((row) => ({
      id: makeId("intelrank"),
      projectId: project.id,
      userId: project.userId,
      keywordId: row.keywordId && keywordIds.has(row.keywordId) ? row.keywordId : null,
      competitorId: row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
      keyword: row.keyword,
      target: row.target ?? "primary",
      rank: row.rank ?? null,
      previousRank: row.previousRank ?? null,
      bestRank: row.bestRank ?? null,
      searchVolume: row.searchVolume ?? null,
      difficulty: row.difficulty ?? null,
      opportunity: row.opportunity ?? null,
      serpFeatures: toJsonText(row.serpFeatures),
      raw: toJsonText(row.raw),
      observedAt: toDateOrNull(row.observedAt) ?? now,
    })));
  }

  if (body.crawlPages.length) {
    await db.insert(intelligenceCrawlPage).values(body.crawlPages.map((row) => ({
      id: makeId("intelpage"),
      projectId: project.id,
      jobId: job.id,
      userId: project.userId,
      competitorId: row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
      url: row.url,
      target: row.target ?? "primary",
      httpStatus: row.httpStatus ?? null,
      title: row.title ?? null,
      metaDescription: row.metaDescription ?? null,
      h1: row.h1 ?? null,
      h2Count: row.h2Count ?? 0,
      wordCount: row.wordCount ?? 0,
      internalLinkCount: row.internalLinkCount ?? 0,
      externalLinkCount: row.externalLinkCount ?? 0,
      imageMissingAltCount: row.imageMissingAltCount ?? 0,
      hasCanonical: row.hasCanonical ?? false,
      hasSchema: row.hasSchema ?? false,
      loadTimeMs: row.loadTimeMs ?? null,
      screenshotUrl: row.screenshotUrl ?? null,
      raw: toJsonText(row.raw),
      observedAt: toDateOrNull(row.observedAt) ?? now,
    })));
  }

  const auditIds = new Set<string>();
  if (body.audits.length) {
    for (const row of body.audits) {
      const [created] = await db.insert(intelligenceSeoAudit).values({
        id: makeId("intelaudit"),
        projectId: project.id,
        jobId: job.id,
        userId: project.userId,
        target: row.target ?? "primary",
        targetUrl: row.targetUrl,
        technicalScore: row.technicalScore ?? 0,
        contentScore: row.contentScore ?? 0,
        localScore: row.localScore ?? 0,
        performanceScore: row.performanceScore ?? 0,
        aiReadinessScore: row.aiReadinessScore ?? 0,
        summary: row.summary ?? null,
        raw: toJsonText(row.raw),
      }).returning();
      auditIds.add(created.id);
    }
  }

  if (body.issues.length) {
    await db.insert(intelligencePageIssue).values(body.issues.map((row) => ({
      id: makeId("intelissue"),
      projectId: project.id,
      userId: project.userId,
      auditId: row.auditId && auditIds.has(row.auditId) ? row.auditId : null,
      crawlPageId: null,
      category: row.category,
      severity: row.severity ?? "medium",
      title: row.title,
      description: row.description ?? null,
      recommendation: row.recommendation ?? null,
      sourceUrl: row.sourceUrl ?? null,
      status: row.status ?? "open",
    })));
  }

  if (body.contentGaps.length) {
    await db.insert(intelligenceContentGap).values(body.contentGaps.map((row) => ({
      id: makeId("intelgap"),
      projectId: project.id,
      userId: project.userId,
      competitorId: row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
      gapType: row.gapType,
      title: row.title,
      description: row.description ?? null,
      opportunity: row.opportunity ?? "medium",
      sourceUrl: row.sourceUrl ?? null,
      suggestedAction: row.suggestedAction ?? null,
      status: row.status ?? "open",
    })));
  }

  if (body.serpResults.length) {
    await db.insert(intelligenceSerpResult).values(body.serpResults.map((row) => ({
      id: makeId("intelserp"),
      projectId: project.id,
      userId: project.userId,
      keywordId: row.keywordId && keywordIds.has(row.keywordId) ? row.keywordId : null,
      keyword: row.keyword,
      location: row.location ?? null,
      device: row.device ?? null,
      resultUrl: row.resultUrl ?? null,
      resultTitle: row.resultTitle ?? null,
      domain: row.domain ?? null,
      rank: row.rank ?? null,
      resultType: row.resultType ?? "organic",
      hasAds: row.hasAds ?? false,
      hasMapPack: row.hasMapPack ?? false,
      hasAiOverview: row.hasAiOverview ?? false,
      raw: toJsonText(row.raw),
      observedAt: toDateOrNull(row.observedAt) ?? now,
    })));
  }

  if (body.recommendations.length) {
    await db.insert(intelligenceRecommendation).values(body.recommendations.map((row) => ({
      id: makeId("intelrec"),
      projectId: project.id,
      userId: project.userId,
      title: row.title,
      description: row.description ?? null,
      category: row.category ?? "seo",
      priority: row.priority ?? "medium",
      impact: row.impact ?? "medium",
      effort: row.effort ?? "medium",
      sourceType: row.sourceType ?? null,
      sourceId: row.sourceId ?? null,
      status: row.status ?? "open",
    })));
  }

  let report = null;
  if (body.report) {
    const [created] = await db.insert(intelligenceReport).values({
      id: makeId("intelreport"),
      projectId: project.id,
      jobId: job.id,
      userId: project.userId,
      title: body.report.title ?? `${project.businessName} Competitor Intelligence Report`,
      status: body.report.status ?? "published",
      executiveSummary: body.report.executiveSummary ?? null,
      insightPacket: toJsonText(body.report.insightPacket),
      reportJson: toJsonText(body.report.reportJson),
      pdfUrl: body.report.pdfUrl ?? null,
    }).returning();
    report = created;
  }

  const scoreUpdate = Object.fromEntries(
    Object.entries(body.scores).filter(([, value]) => typeof value === "number"),
  ) as Partial<typeof intelligenceProject.$inferInsert>;

  const [updatedProject] = await db.update(intelligenceProject).set({
    ...scoreUpdate,
    status: body.status === "completed" ? "active" : project.status,
    lastScanStatus: body.status,
    lastScanAt: body.status === "completed" ? now : project.lastScanAt,
    updatedAt: now,
  }).where(eq(intelligenceProject.id, project.id)).returning();

  const [updatedJob] = await db.update(intelligenceJob).set({
    status: body.status,
    externalRunId: body.externalRunId ?? job.externalRunId,
    error: body.error ?? null,
    output: JSON.stringify(body),
    startedAt: job.startedAt ?? now,
    completedAt: ["completed", "failed", "cancelled"].includes(body.status) ? now : null,
    updatedAt: now,
  }).where(eq(intelligenceJob.id, job.id)).returning();

  return { project: updatedProject, job: updatedJob, report };
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(trimmed)
    ? trimmed
    : null;
}

function extractDomainCandidates(...values: Array<string | null | undefined>) {
  const domains = new Set<string>();
  for (const value of values) {
    for (const match of String(value ?? "").matchAll(/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi)) {
      const domain = normalizeDomain(match[0]);
      if (domain) domains.add(domain);
    }
  }
  return [...domains];
}

function domainTokenMatches(label: string | null | undefined, domain: string) {
  const normalizedLabel = String(label ?? "").toLowerCase();
  return normalizedLabel.includes(domain) || normalizedLabel.includes(domain.split(".")[0]);
}

async function probeManagedWebsite(domain: string) {
  const httpsUrl = `https://${domain}`;
  const httpResult = await probeHttpUrl(httpsUrl);
  const ssl = await probeServerSsl(domain);
  return {
    id: `inferred:${domain}`,
    url: httpResult.url,
    domain,
    status: httpResult.ok ? "online" : "offline",
    httpStatus: httpResult.status,
    redirectUrl: httpResult.redirectUrl,
    sslStatus: ssl.status,
    sslIssuer: ssl.issuer,
    sslExpiresAt: ssl.expiresAt,
    sslHostnameMatches: ssl.hostnameMatches,
    appType: null,
    source: "cloudmonkey-inferred",
    raw: JSON.stringify({ source: "cloudmonkey-inferred", redirectUrl: httpResult.redirectUrl, sslHostnameMatches: ssl.hostnameMatches }),
    observedAt: new Date().toISOString(),
  };
}

async function probeHttpUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return {
      url,
      ok: response.ok,
      status: response.status,
      redirectUrl: response.url !== url ? response.url : null,
    };
  } catch {
    try {
      const response = await fetch(url.replace(/^https:/, "http:"), {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
      return {
        url: url.replace(/^https:/, "http:"),
        ok: response.ok,
        status: response.status,
        redirectUrl: response.url !== url.replace(/^https:/, "http:") ? response.url : null,
      };
    } catch {
      return { url, ok: false, status: null, redirectUrl: null };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function probeServerSsl(domain: string): Promise<{ status: string; issuer: string | null; expiresAt: string | null; hostnameMatches: boolean | null }> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, timeout: 6000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const expiresAt = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
      const hostnameError = cert ? tls.checkServerIdentity(domain, cert as tls.PeerCertificate) : new Error("No certificate");
      resolve({
        status: cert?.valid_to ? "valid" : "unknown",
        issuer: typeof cert?.issuer === "object" ? Object.values(cert.issuer).join(" ") : null,
        expiresAt,
        hostnameMatches: !hostnameError,
      });
    });
    socket.on("error", () => resolve({ status: "error", issuer: null, expiresAt: null, hostnameMatches: null }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ status: "timeout", issuer: null, expiresAt: null, hostnameMatches: null });
    });
  });
}

async function getServersWithTelemetry(userId: string, includeAll: boolean) {
  const instances = await db.query.vultrInstance.findMany({
    ...(includeAll ? {} : { where: eq(vultrInstance.userId, userId) }),
    orderBy: (vultrInstance, { desc }) => [desc(vultrInstance.createdAt)],
  });

  const userIds = [...new Set(instances.map((instance) => instance.userId))];
  const [domains, managedWebsites] = userIds.length ? await Promise.all([
    db.query.registeredDomain.findMany({
      ...(includeAll ? {} : { where: eq(registeredDomain.userId, userId) }),
    }),
    db.query.website.findMany({
      ...(includeAll ? {} : { where: eq(website.userId, userId) }),
    }),
  ]) : [[], []];

  return Promise.all(instances.map(async (instance) => {
    const agent = await db.query.serverAgent.findFirst({
      where: eq(serverAgent.instanceId, instance.id),
      orderBy: (serverAgent, { desc }) => [desc(serverAgent.createdAt)],
    });

    if (!agent) {
      return {
        ...instance,
        agent: null,
        latestTelemetry: null,
        websites: await getInferredWebsitesForInstance(instance, domains, managedWebsites, []),
        containers: [],
        databases: [],
        securityFindings: [],
        aiRuntimes: [],
        n8nIntegration: null,
        n8nWorkflows: [],
      };
    }

    const [latestTelemetry, websites, containers, databases, securityFindings, aiRuntimes, n8nIntegration] = await Promise.all([
      db.query.serverTelemetrySnapshot.findFirst({
        where: eq(serverTelemetrySnapshot.agentId, agent.id),
        orderBy: (serverTelemetrySnapshot, { desc }) => [desc(serverTelemetrySnapshot.observedAt)],
      }),
      db.query.serverWebsite.findMany({
        where: eq(serverWebsite.agentId, agent.id),
        orderBy: (serverWebsite, { desc }) => [desc(serverWebsite.observedAt)],
      }),
      db.query.serverContainer.findMany({
        where: eq(serverContainer.agentId, agent.id),
        orderBy: (serverContainer, { desc }) => [desc(serverContainer.observedAt)],
      }),
      db.query.serverDatabase.findMany({
        where: eq(serverDatabase.agentId, agent.id),
        orderBy: (serverDatabase, { desc }) => [desc(serverDatabase.observedAt)],
      }),
      db.query.serverSecurityFinding.findMany({
        where: eq(serverSecurityFinding.agentId, agent.id),
        orderBy: (serverSecurityFinding, { desc }) => [desc(serverSecurityFinding.observedAt)],
      }),
      db.query.detectedAiRuntime.findMany({
        where: eq(detectedAiRuntime.agentId, agent.id),
        orderBy: (detectedAiRuntime, { desc }) => [desc(detectedAiRuntime.observedAt)],
      }),
      db.query.serverN8nIntegration.findFirst({
        where: eq(serverN8nIntegration.instanceId, instance.id),
        orderBy: (serverN8nIntegration, { desc }) => [desc(serverN8nIntegration.updatedAt)],
      }),
    ]);
    const inferredWebsites = await getInferredWebsitesForInstance(instance, domains, managedWebsites, websites);
    const n8nWorkflows = n8nIntegration ? await db.query.serverN8nWorkflow.findMany({
      where: eq(serverN8nWorkflow.integrationId, n8nIntegration.id),
      orderBy: (serverN8nWorkflow, { desc }) => [desc(serverN8nWorkflow.workflowUpdatedAt)],
    }) : [];

    return {
      ...instance,
      agent,
      latestTelemetry,
      websites: [...websites, ...inferredWebsites],
      containers,
      databases,
      securityFindings,
      aiRuntimes,
      n8nIntegration: n8nIntegration ? sanitizeN8nIntegration(n8nIntegration) : null,
      n8nWorkflows,
    };
  }));
}

async function getInferredWebsitesForInstance(
  instance: typeof vultrInstance.$inferSelect,
  domains: Array<typeof registeredDomain.$inferSelect>,
  managedWebsites: Array<typeof website.$inferSelect>,
  discoveredWebsites: Array<typeof serverWebsite.$inferSelect>,
) {
  const alreadyDiscovered = new Set(discoveredWebsites.map((site) => normalizeDomain(site.domain)).filter(Boolean));
  const labelDomains = extractDomainCandidates(instance.label);
  const matchedRecordDomains = [
    ...domains.filter((domain) => domain.userId === instance.userId && domainTokenMatches(instance.label, domain.id)).map((domain) => domain.id),
    ...managedWebsites.filter((site) => site.userId === instance.userId && domainTokenMatches(instance.label, site.domain)).map((site) => site.domain),
  ].map((domain) => normalizeDomain(domain)).filter((domain): domain is string => !!domain);
  const candidates = [...new Set([...labelDomains, ...matchedRecordDomains])].filter((domain) => !alreadyDiscovered.has(domain));
  return Promise.all(candidates.map((domain) => probeManagedWebsite(domain)));
}

function sanitizeN8nIntegration(row: typeof serverN8nIntegration.$inferSelect) {
  const { apiKeySecret: _apiKeySecret, ...safeRow } = row;
  return safeRow;
}

async function syncN8nWorkflows(integration: typeof serverN8nIntegration.$inferSelect) {
  const apiKey = decryptSecret(integration.apiKeySecret);
  const baseUrl = integration.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/api/v1/workflows`, {
    headers: {
      "Accept": "application/json",
      "X-N8N-API-KEY": apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`n8n API returned ${response.status}`);
  }

  const payload = await response.json();
  const workflows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const observedAt = new Date();

  await db.delete(serverN8nWorkflow).where(eq(serverN8nWorkflow.integrationId, integration.id));
  if (workflows.length) {
    await db.insert(serverN8nWorkflow).values(workflows.map((workflow: any) => ({
      id: makeId("n8nwf"),
      integrationId: integration.id,
      instanceId: integration.instanceId,
      userId: integration.userId,
      workflowId: String(workflow.id),
      name: String(workflow.name ?? "Untitled workflow"),
      active: Boolean(workflow.active),
      triggerSummary: summarizeN8nTriggers(workflow),
      workflowUpdatedAt: toDateOrNull(workflow.updatedAt ?? workflow.updated_at),
      raw: JSON.stringify(workflow),
      observedAt,
    })));
  }

  const [updated] = await db.update(serverN8nIntegration).set({
    status: "synced",
    lastSyncAt: observedAt,
    lastError: null,
    updatedAt: observedAt,
  }).where(eq(serverN8nIntegration.id, integration.id)).returning();

  return {
    integration: sanitizeN8nIntegration(updated),
    workflows: await db.query.serverN8nWorkflow.findMany({
      where: eq(serverN8nWorkflow.integrationId, integration.id),
      orderBy: (serverN8nWorkflow, { desc }) => [desc(serverN8nWorkflow.workflowUpdatedAt)],
    }),
  };
}

function summarizeN8nTriggers(workflow: any) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const triggers = nodes
    .filter((node: any) => String(node?.type ?? "").toLowerCase().includes("trigger") || String(node?.type ?? "").toLowerCase().includes("webhook"))
    .map((node: any) => String(node?.name ?? node?.type ?? "Trigger"));
  return triggers.length ? triggers.join(", ") : "Manual or unknown trigger";
}

async function getDetectedAgentRows(userId: string, includeAll: boolean) {
  const rows = await db.query.detectedAiRuntime.findMany({
    ...(includeAll ? {} : { where: eq(detectedAiRuntime.userId, userId) }),
    with: { user: true, instance: true },
    orderBy: (detectedAiRuntime, { desc }) => [desc(detectedAiRuntime.observedAt)],
  });

  return rows.map((runtime) => ({
    id: `detected:${runtime.id}`,
    userId: runtime.userId,
    name: runtime.name,
    purpose: `${runtime.runtime === "openclaw" ? "OpenClaw" : runtime.runtime === "n8n" ? "n8n" : "Hermes"} runtime detected on ${runtime.instance?.label || runtime.instanceId}`,
    provider: runtime.runtime,
    model: runtime.version || runtime.image || null,
    status: runtime.status === "running" || runtime.status === "healthy" ? "active" : runtime.status,
    lastRunAt: runtime.observedAt,
    createdAt: runtime.createdAt,
    updatedAt: runtime.updatedAt,
    user: runtime.user,
    detectedRuntime: runtime,
    isDiscovered: true,
  }));
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const roleUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "support", "finance", "customer"]),
});

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["pending", "active", "trialing", "past_due", "cancelled"]).default("pending"),
  amount: z.coerce.number().int().nonnegative(),
  interval: z.enum(["month", "year"]).default("month"),
  planId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
  currentPeriodEnd: z.string().optional().nullable(),
});

const manualInvoiceSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  interval: z.enum(["month", "year"]).default("month"),
  planId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
  websitePackageType: z.enum(["website", "ecommerce"]).optional().nullable(),
  billingPeriodStart: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  billingPeriodEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerCompany: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerVatNumber: z.string().optional().nullable(),
});

const invoiceVoidSchema = z.object({
  reason: z.string().optional().nullable(),
});

const affiliateApplicationSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  socialLinks: z.string().optional().nullable(),
  affiliateType: z.enum(["individual", "agency", "msp", "it_consultant", "web_designer_developer", "existing_customer", "other"]).default("individual"),
  expectedReferralMethod: z.string().min(1),
  payoutMethod: z.string().optional().default("manual_eft"),
  payoutDetails: z.string().optional().nullable(),
  termsAccepted: z.boolean().refine(Boolean, "Affiliate terms must be accepted"),
});

const affiliateClickSchema = z.object({
  referralCode: z.string().min(2),
  visitorId: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  landingPage: z.string().optional().nullable(),
});

const affiliateProfileSchema = z.object({
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  socialLinks: z.string().optional().nullable(),
  expectedReferralMethod: z.string().optional().nullable(),
  payoutMethod: z.string().optional().default("manual_eft"),
  payoutDetails: z.string().optional().nullable(),
});

const adminAffiliateCreateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  tier: z.enum(["starter", "growth", "strategic"]).default("starter"),
  commissionRateBps: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const adminAffiliateUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended", "active", "inactive"]).optional(),
  tier: z.enum(["starter", "growth", "strategic"]).optional(),
  commissionRateBps: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const manualAttributionSchema = z.object({
  affiliateId: z.string().min(1),
  customerId: z.string().min(1),
  reason: z.string().min(3),
});

const commissionActionSchema = z.object({
  status: z.enum(["approved", "payable", "paid", "cancelled", "reversed"]),
  commissionAmount: z.coerce.number().int().nonnegative().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
});

const payoutMarkPaidSchema = z.object({
  affiliateId: z.string().min(1),
  commissionIds: z.array(z.string().min(1)).min(1),
  payoutReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const domainOrderSchema = z.object({
  domainName: z.string().min(3),
  domainPlanId: z.string().min(1),
  addonPlanIds: z.array(z.string().min(1)).optional().default([]),
});

const supportChatSchema = z.object({
  sessionId: z.string().optional().nullable(),
  message: z.string().optional().default(""),
  attachmentIds: z.array(z.string().min(1)).optional().default([]),
  clientCapabilities: z.object({
    audioReply: z.boolean().optional(),
    imageUpload: z.boolean().optional(),
    voiceNotes: z.boolean().optional(),
  }).optional().default({}),
}).refine((body) => body.message.trim().length > 0 || body.attachmentIds.length > 0, {
  message: "Message or attachment is required",
});

const supportAgentToolCallSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domain_availability"), domain: z.string().min(3) }),
  z.object({ type: z.literal("owned_domains") }),
  z.object({ type: z.literal("domain_dns"), domain: z.string().min(3) }),
  z.object({ type: z.literal("domain_info"), domain: z.string().min(3) }),
]);

const supportAgentResponseSchema = z.object({
  reply: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  intent: z.enum(["support", "billing", "signup_guidance", "domain_check", "dns_query", "onboarding", "general"]).optional(),
  createTicket: z.boolean().optional(),
  ticket: z.object({
    subject: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    category: z.string().optional(),
  }).optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().optional(),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  toolCalls: z.array(supportAgentToolCallSchema).optional().default([]),
  suggestedActions: z.array(z.object({ label: z.string(), href: z.string() })).optional().default([]),
  summary: z.string().optional(),
  internalNote: z.string().optional(),
  audioReplyText: z.string().optional(),
});

const agentSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1),
  purpose: z.string().min(1),
  provider: z.string().min(1).default("openrouter"),
  model: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
});

const intelligenceProjectSchema = z.object({
  name: z.string().min(2).max(140).optional(),
  businessName: z.string().min(2).max(140),
  websiteUrl: z.string().url(),
  location: z.string().max(160).optional().nullable(),
  industry: z.string().max(160).optional().nullable(),
  servicesProducts: z.string().max(2000).optional().nullable(),
  targetKeywords: z.array(z.string().min(2).max(180)).max(50).optional().default([]),
  competitors: z.array(z.object({
    name: z.string().min(1).max(140).optional().nullable(),
    websiteUrl: z.string().url(),
    competitorType: z.enum(["manual", "organic", "local", "ad", "content", "pricing"]).optional().default("manual"),
  })).max(10).optional().default([]),
});

const intelligenceProjectUpdateSchema = intelligenceProjectSchema.partial().omit({
  targetKeywords: true,
  competitors: true,
});

const intelligenceCompetitorSchema = z.object({
  name: z.string().min(1).max(140).optional().nullable(),
  websiteUrl: z.string().url(),
  competitorType: z.enum(["manual", "organic", "local", "ad", "content", "pricing"]).optional().default("manual"),
});

const intelligenceKeywordSchema = z.object({
  keyword: z.string().min(2).max(180),
  location: z.string().max(160).optional().nullable(),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  intent: z.string().max(80).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "very_high"]).default("medium"),
});

const intelligenceScanSchema = z.object({
  scanType: z.enum(["full", "serp", "crawl", "ai_report"]).default("full"),
});

const intelligenceWebhookResultSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).default("completed"),
  externalRunId: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
  scores: z.object({
    visibilityScore: z.coerce.number().int().min(0).max(100).optional(),
    technicalSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    contentSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    contentGapScore: z.coerce.number().int().min(0).max(100).optional(),
    localSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    performanceScore: z.coerce.number().int().min(0).max(100).optional(),
    aiReadinessScore: z.coerce.number().int().min(0).max(100).optional(),
    opportunityScore: z.coerce.number().int().min(0).max(100).optional(),
  }).optional().default({}),
  competitors: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    websiteUrl: z.string().url(),
    competitorType: z.string().optional().default("organic"),
    visibilityScore: z.coerce.number().int().min(0).max(100).optional(),
    technicalSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    contentSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    localSeoScore: z.coerce.number().int().min(0).max(100).optional(),
    metadata: z.unknown().optional(),
  })).optional().default([]),
  rankings: z.array(z.object({
    keywordId: z.string().optional().nullable(),
    competitorId: z.string().optional().nullable(),
    keyword: z.string().min(1),
    target: z.string().optional().default("primary"),
    rank: z.coerce.number().int().optional().nullable(),
    previousRank: z.coerce.number().int().optional().nullable(),
    bestRank: z.coerce.number().int().optional().nullable(),
    searchVolume: z.coerce.number().int().optional().nullable(),
    difficulty: z.coerce.number().int().optional().nullable(),
    opportunity: z.string().optional().nullable(),
    serpFeatures: z.unknown().optional(),
    raw: z.unknown().optional(),
    observedAt: z.string().optional().nullable(),
  })).optional().default([]),
  crawlPages: z.array(z.object({
    competitorId: z.string().optional().nullable(),
    url: z.string().url(),
    target: z.string().optional().default("primary"),
    httpStatus: z.coerce.number().int().optional().nullable(),
    title: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    h1: z.string().optional().nullable(),
    h2Count: z.coerce.number().int().optional().default(0),
    wordCount: z.coerce.number().int().optional().default(0),
    internalLinkCount: z.coerce.number().int().optional().default(0),
    externalLinkCount: z.coerce.number().int().optional().default(0),
    imageMissingAltCount: z.coerce.number().int().optional().default(0),
    hasCanonical: z.boolean().optional().default(false),
    hasSchema: z.boolean().optional().default(false),
    loadTimeMs: z.coerce.number().int().optional().nullable(),
    screenshotUrl: z.string().optional().nullable(),
    raw: z.unknown().optional(),
    observedAt: z.string().optional().nullable(),
  })).optional().default([]),
  audits: z.array(z.object({
    target: z.string().optional().default("primary"),
    targetUrl: z.string().url(),
    technicalScore: z.coerce.number().int().min(0).max(100).optional().default(0),
    contentScore: z.coerce.number().int().min(0).max(100).optional().default(0),
    localScore: z.coerce.number().int().min(0).max(100).optional().default(0),
    performanceScore: z.coerce.number().int().min(0).max(100).optional().default(0),
    aiReadinessScore: z.coerce.number().int().min(0).max(100).optional().default(0),
    summary: z.string().optional().nullable(),
    raw: z.unknown().optional(),
  })).optional().default([]),
  issues: z.array(z.object({
    auditId: z.string().optional().nullable(),
    crawlPageId: z.string().optional().nullable(),
    category: z.string().min(1),
    severity: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    recommendation: z.string().optional().nullable(),
    sourceUrl: z.string().optional().nullable(),
    status: z.string().optional().default("open"),
  })).optional().default([]),
  contentGaps: z.array(z.object({
    competitorId: z.string().optional().nullable(),
    gapType: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    opportunity: z.enum(["low", "medium", "high", "very_high"]).optional().default("medium"),
    sourceUrl: z.string().optional().nullable(),
    suggestedAction: z.string().optional().nullable(),
    status: z.string().optional().default("open"),
  })).optional().default([]),
  serpResults: z.array(z.object({
    keywordId: z.string().optional().nullable(),
    keyword: z.string().min(1),
    location: z.string().optional().nullable(),
    device: z.string().optional().nullable(),
    resultUrl: z.string().optional().nullable(),
    resultTitle: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
    rank: z.coerce.number().int().optional().nullable(),
    resultType: z.string().optional().default("organic"),
    hasAds: z.boolean().optional().default(false),
    hasMapPack: z.boolean().optional().default(false),
    hasAiOverview: z.boolean().optional().default(false),
    raw: z.unknown().optional(),
    observedAt: z.string().optional().nullable(),
  })).optional().default([]),
  recommendations: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    category: z.string().optional().default("seo"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
    impact: z.enum(["low", "medium", "high"]).optional().default("medium"),
    effort: z.enum(["low", "medium", "high"]).optional().default("medium"),
    sourceType: z.string().optional().nullable(),
    sourceId: z.string().optional().nullable(),
    status: z.string().optional().default("open"),
  })).optional().default([]),
  report: z.object({
    title: z.string().min(1).optional(),
    status: z.string().optional().default("published"),
    executiveSummary: z.string().optional().nullable(),
    insightPacket: z.unknown().optional(),
    reportJson: z.unknown().optional(),
    pdfUrl: z.string().optional().nullable(),
  }).optional(),
});

const n8nIntegrationSchema = z.object({
  instanceId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

const n8nSyncSchema = z.object({
  instanceId: z.string().min(1),
});

const ticketSchema = z.object({
  userId: z.string().optional(),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["open", "pending", "resolved", "closed"]).default("open"),
  category: z.string().min(1).default("general"),
  assignedToUserId: z.string().optional().nullable(),
  source: z.string().optional().default("manual"),
  aiSessionId: z.string().optional().nullable(),
  slaDueAt: z.string().optional().nullable(),
  resolutionSummary: z.string().optional().nullable(),
});

const ticketCommentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional().default(false),
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

const websiteSchema = z.object({
  userId: z.string().min(1),
  domain: z.string().min(1),
  plan: z.string().min(1),
  status: z.enum(["online", "offline", "maintenance"]).default("online"),
  githubRepo: z.string().optional().nullable(),
});

const runtimeServerSchema = z.object({
  id: z.string().min(3).optional(),
  provider: z.string().default("manual"),
  providerInstanceId: z.string().optional().nullable(),
  profileName: z.string().default("geek247-compatible-docker-host"),
  hostname: z.string().min(1),
  publicIp: z.string().optional().nullable(),
  privateIp: z.string().optional().nullable(),
  provisionerUrl: z.string().url(),
  provisionerSecret: z.string().min(16),
  ingressHostname: z.string().optional().nullable(),
  ingressIp: z.string().optional().nullable(),
  dockerNetworkName: z.string().default("cm_runtime"),
  proxyMode: z.enum(["caddy", "traefik", "nginx"]).default("caddy"),
  region: z.string().optional().nullable(),
  status: z.enum(["planned", "active", "maintenance", "offline"]).default("active"),
  cpuTotal: z.coerce.number().int().min(0).default(0),
  memoryTotalMb: z.coerce.number().int().min(0).default(0),
  diskTotalGb: z.coerce.number().int().min(0).default(0),
  maxSiteCount: z.coerce.number().int().min(0).default(0),
});

const userWebsiteCreateSchema = z.object({
  siteType: z.enum(["website", "ecommerce"]).default("website"),
  businessName: z.string().min(2).max(120),
  businessDescription: z.string().max(1000).optional().default(""),
  industry: z.string().max(120).optional().default(""),
  targetCustomers: z.string().max(500).optional().default(""),
  whatsapp: z.string().max(80).optional().default(""),
  email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  preferredSlug: z.string().max(80).optional().default(""),
  productCount: z.coerce.number().int().min(0).max(100000).optional().default(0),
  needsInventory: z.boolean().optional().default(false),
  needsDelivery: z.boolean().optional().default(false),
  needsPos: z.boolean().optional().default(false),
});

const websiteOnboardingSchema = z.object({
  subscriptionId: z.string().min(1),
  answers: z.record(z.unknown()),
});

const adminDesignOptionSchema = z.object({
  styleLabel: z.string().min(1).max(120),
  notes: z.string().max(1000).optional().default(""),
  imageUrl: z.string().url().optional().or(z.literal("")).default(""),
});

const websiteApprovalResponseSchema = z.object({
  action: z.enum(["approve", "changes_requested"]).default("approve"),
  designOptionId: z.string().optional(),
  comments: z.string().max(2000).optional().default(""),
});

const storeProductCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().default(""),
  sku: z.string().max(80).optional().default(""),
  price: z.coerce.number().min(0).max(100000000).default(0),
  inventoryQuantity: z.coerce.number().int().min(0).max(1000000).default(0),
  trackInventory: z.boolean().optional().default(true),
  status: z.enum(["draft", "active", "archived"]).default("active"),
});

const agentEnrollmentRequestSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().optional().nullable(),
});

const agentEnrollSchema = z.object({
  enrollmentToken: z.string().min(20),
  hostname: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
});

const agentHeartbeatSchema = z.object({
  hostname: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  status: z.enum(["online", "degraded", "offline"]).optional().default("online"),
});

const agentSnapshotSchema = z.object({
  observedAt: z.string().optional(),
  host: z.object({
    hostname: z.string().optional().nullable(),
    osName: z.string().optional().nullable(),
    kernel: z.string().optional().nullable(),
    uptimeSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }).optional().default({}),
  metrics: z.object({
    cpuUsagePercent: z.coerce.number().int().min(0).max(100).optional().nullable(),
    memoryUsedMb: z.coerce.number().int().nonnegative().optional().nullable(),
    memoryTotalMb: z.coerce.number().int().nonnegative().optional().nullable(),
    diskUsedGb: z.coerce.number().int().nonnegative().optional().nullable(),
    diskTotalGb: z.coerce.number().int().nonnegative().optional().nullable(),
  }).optional().default({}),
  security: z.object({
    score: z.coerce.number().int().min(0).max(100).optional().nullable(),
    summary: z.string().optional().nullable(),
    findings: z.array(z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      severity: z.enum(["info", "low", "medium", "high", "critical"]).default("info"),
      detail: z.string().optional().nullable(),
      evidence: z.unknown().optional().nullable(),
    })).optional().default([]),
  }).optional().default({ findings: [] }),
  websites: z.array(z.object({
    url: z.string().min(1),
    domain: z.string().min(1),
    status: z.string().optional().default("unknown"),
    httpStatus: z.coerce.number().int().optional().nullable(),
    redirectUrl: z.string().optional().nullable(),
    sslStatus: z.string().optional().nullable(),
    sslIssuer: z.string().optional().nullable(),
    sslExpiresAt: z.string().optional().nullable(),
    sslHostnameMatches: z.boolean().optional().nullable(),
    appType: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
  })).optional().default([]),
  containers: z.array(z.object({
    containerId: z.string().min(1),
    name: z.string().min(1),
    image: z.string().min(1),
    status: z.string().min(1),
    health: z.string().optional().nullable(),
    ports: z.unknown().optional().nullable(),
    labels: z.unknown().optional().nullable(),
    isPrivileged: z.boolean().optional().default(false),
    restartCount: z.coerce.number().int().nonnegative().optional().default(0),
  })).optional().default([]),
  databases: z.array(z.object({
    engine: z.string().min(1),
    version: z.string().optional().nullable(),
    source: z.string().optional().default("container"),
    containerName: z.string().optional().nullable(),
    port: z.coerce.number().int().optional().nullable(),
    status: z.string().optional().default("unknown"),
    isPublic: z.boolean().optional().default(false),
    hasPersistentVolume: z.boolean().optional().default(false),
  })).optional().default([]),
  aiRuntimes: z.array(z.object({
    runtime: z.enum(["hermes", "openclaw", "n8n"]),
    name: z.string().min(1),
    image: z.string().optional().nullable(),
    version: z.string().optional().nullable(),
    status: z.string().optional().default("unknown"),
    health: z.string().optional().nullable(),
    ports: z.unknown().optional().nullable(),
  })).optional().default([]),
});

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/sitemap.xml" && request.method === "GET") {
      return new Response(renderSitemapXml(), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname.startsWith("/api/auth")) {
      return auth.handler(request);
    }

    if (url.pathname === "/install-agent.sh") {
      const origin = "https://cloudmonkey.co.za";
      const script = `#!/usr/bin/env bash
set -euo pipefail

CM_API_URL="\${CM_API_URL:-${origin}}"
CM_ENROLLMENT_TOKEN="\${CM_ENROLLMENT_TOKEN:-\${1:-}}"
CM_AGENT_IMAGE="\${CM_AGENT_IMAGE:-geek247za/server-agent:latest}"

if [ -z "$CM_ENROLLMENT_TOKEN" ]; then
  echo "Missing enrollment token. Run: CM_ENROLLMENT_TOKEN=<token> bash install-agent.sh" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

mkdir -p /opt/cloudmonkey-agent
cat > /opt/cloudmonkey-agent/.env <<ENV
CM_API_URL=$CM_API_URL
CM_ENROLLMENT_TOKEN=$CM_ENROLLMENT_TOKEN
ENV

docker rm -f cloudmonkey-docker-socket-proxy cloudmonkey-agent >/dev/null 2>&1 || true
docker run -d --name cloudmonkey-docker-socket-proxy --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e CONTAINERS=1 -e IMAGES=1 -e INFO=1 -e VERSION=1 -e POST=0 \\
  -p 127.0.0.1:2375:2375 tecnativa/docker-socket-proxy:latest

docker run -d --name cloudmonkey-agent --restart unless-stopped \\
  --env-file /opt/cloudmonkey-agent/.env \\
  -e CM_DOCKER_HOST=http://127.0.0.1:2375 \\
  -v /opt/cloudmonkey-agent:/data \\
  -v /proc:/host/proc:ro \\
  -v /sys:/host/sys:ro \\
  -v /etc:/host/etc:ro \\
  -v /:/host/rootfs:ro \\
  --network host \\
  "$CM_AGENT_IMAGE"

echo "CloudMonkey agent installed."
`;
      return new Response(script, {
        headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
      });
    }

    if (url.pathname.startsWith("/api/public/website-design-options/") && url.pathname.endsWith("/image") && request.method === "GET") {
      const parts = url.pathname.split("/").filter(Boolean);
      const designOptionId = decodeURIComponent(parts[3] ?? "");
      const option = designOptionId
        ? await db.query.websiteDesignOption.findFirst({ where: eq(websiteDesignOption.id, designOptionId) })
        : null;
      const manifest = safeJsonParse(option?.designManifest);
      const storagePath = manifest?.storagePath ? String(manifest.storagePath) : null;
      if (!option || !storagePath) return json({ error: "Design image not found" }, 404);
      const fileStat = await stat(storagePath).catch(() => null);
      if (!fileStat?.isFile()) return json({ error: "Design image file not found" }, 404);
      return new Response(await readFile(storagePath), {
        headers: {
          "Content-Type": String(manifest.mimeType || "application/octet-stream"),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    if (url.pathname.startsWith("/api/public/website-approvals/")) {
      const token = decodeURIComponent(url.pathname.split("/").filter(Boolean)[3] ?? "");
      if (!token) return json({ error: "Approval token is required" }, 400);

      const tokenRow = await db.query.websiteApprovalToken.findFirst({
        where: eq(websiteApprovalToken.tokenHash, sha256(token)),
      });
      if (!tokenRow) return json({ error: "Approval link is invalid" }, 404);
      if (tokenRow.usedAt) return json({ error: "Approval link has already been used" }, 410);
      if (tokenRow.expiresAt.getTime() < Date.now()) return json({ error: "Approval link has expired" }, 410);

      const site = await getUserWebsiteDetail(tokenRow.userId, tokenRow.websiteId);
      if (!site) return json({ error: "Website not found" }, 404);

      if (request.method === "GET") {
        return json({
          token: { actionType: tokenRow.actionType, targetId: tokenRow.targetId, expiresAt: tokenRow.expiresAt },
          website: site,
        });
      }

      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

      try {
        const body = await parseBody(request, websiteApprovalResponseSchema);
        const respondedAt = new Date();
        const review = await db.query.websiteReviewRequest.findFirst({
          where: eq(websiteReviewRequest.targetId, tokenRow.targetId ?? tokenRow.websiteId),
          orderBy: (websiteReviewRequest, { desc }) => [desc(websiteReviewRequest.createdAt)],
        });

        if (tokenRow.actionType === "design_approval") {
          const designOptionId = body.designOptionId ?? tokenRow.targetId;
          if (!designOptionId) return json({ error: "Design option is required" }, 400);
          const selectedOption = await db.query.websiteDesignOption.findFirst({
            where: eq(websiteDesignOption.id, designOptionId),
          });
          if (!selectedOption || selectedOption.websiteId !== tokenRow.websiteId) {
            return json({ error: "Design option not found" }, 404);
          }
          if (body.action !== "approve") {
            if (review) {
              await db.update(websiteReviewRequest).set({
                status: "changes_requested",
                response: body.comments || null,
                respondedAt,
                updatedAt: respondedAt,
              }).where(eq(websiteReviewRequest.id, review.id));
            }
            await db.update(websiteApprovalToken).set({ usedAt: respondedAt }).where(eq(websiteApprovalToken.id, tokenRow.id));
            await db.update(website).set({ status: "design_changes_requested", updatedAt: respondedAt }).where(eq(website.id, tokenRow.websiteId));
            return json({ ok: true, status: "changes_requested" });
          }

          const designManifest = safeJsonParse(selectedOption.designManifest) ?? {};
          const buildManifest = {
            websiteId: tokenRow.websiteId,
            selectedDesignOptionId: designOptionId,
            styleLabel: selectedOption.styleLabel,
            designManifest,
            siteType: site.siteType,
            businessName: site.businessName,
            temporaryDomain: site.temporaryDomain,
            baseRepo: site.siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template",
            approvedAt: respondedAt.toISOString(),
          };
          await db.update(websiteDesignOption).set({ selectedAt: null }).where(eq(websiteDesignOption.websiteId, tokenRow.websiteId));
          await db.update(websiteDesignOption).set({ selectedAt: respondedAt }).where(eq(websiteDesignOption.id, designOptionId));
          await db.update(website).set({
            selectedDesignOptionId: designOptionId,
            buildManifest: JSON.stringify(buildManifest),
            baseRepo: buildManifest.baseRepo,
            aiGenerationStatus: "design_selected",
            status: "design_selected",
            updatedAt: respondedAt,
          }).where(eq(website.id, tokenRow.websiteId));
          if (review) {
            await db.update(websiteReviewRequest).set({
              status: "approved",
              response: body.comments || null,
              respondedAt,
              updatedAt: respondedAt,
            }).where(eq(websiteReviewRequest.id, review.id));
          }
          await db.update(websiteApprovalToken).set({ usedAt: respondedAt }).where(eq(websiteApprovalToken.id, tokenRow.id));
          await recordAudit({
            actorUserId: tokenRow.userId,
            action: "website.design_approved",
            entityType: "website",
            entityId: tokenRow.websiteId,
            message: `Design approved for ${site.businessName || site.domain}`,
            metadata: { designOptionId },
          });
          return json({ ok: true, status: "approved", designOptionId });
        }

        if (tokenRow.actionType === "staging_review") {
          const approved = body.action === "approve";
          if (review) {
            await db.update(websiteReviewRequest).set({
              status: approved ? "approved" : "changes_requested",
              response: body.comments || null,
              respondedAt,
              updatedAt: respondedAt,
            }).where(eq(websiteReviewRequest.id, review.id));
          }
          await db.update(websiteApprovalToken).set({ usedAt: respondedAt }).where(eq(websiteApprovalToken.id, tokenRow.id));
          await db.update(website).set({
            status: approved ? "staging_approved" : "staging_changes_requested",
            updatedAt: respondedAt,
          }).where(eq(website.id, tokenRow.websiteId));
          await recordAudit({
            actorUserId: tokenRow.userId,
            action: approved ? "website.staging_approved" : "website.staging_changes_requested",
            entityType: "website",
            entityId: tokenRow.websiteId,
            message: `Staging ${approved ? "approved" : "changes requested"} for ${site.businessName || site.domain}`,
            metadata: { comments: body.comments || null },
          });
          return json({ ok: true, status: approved ? "approved" : "changes_requested" });
        }

        return json({ error: "Unsupported approval action" }, 400);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/agent/enroll") && request.method === "POST") {
      try {
        const body = await parseBody(request, agentEnrollSchema);
        const tokenHash = sha256(body.enrollmentToken);
        const agent = await db.query.serverAgent.findFirst({
          where: eq(serverAgent.enrollmentTokenHash, tokenHash),
        });
        if (!agent) return json({ error: "Invalid enrollment token" }, 401);

        const signingSecret = `cm_secret_${crypto.randomBytes(32).toString("base64url")}`;
        const [updated] = await db.update(serverAgent).set({
          secretHash: encryptSecret(signingSecret),
          enrollmentTokenHash: null,
          hostname: body.hostname ?? agent.hostname,
          version: body.version ?? agent.version,
          status: "online",
          enrolledAt: new Date(),
          lastSeenAt: new Date(),
          lastIp: getRemoteIp(request),
          config: JSON.stringify(getAgentConfig()),
          updatedAt: new Date(),
        }).where(eq(serverAgent.id, agent.id)).returning();

        return json({
          agentId: updated.id,
          signingSecret,
          config: getAgentConfig(),
        });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/agent/config")) {
      const signed = await readSignedAgentRequest(request, url);
      if (signed.response) return signed.response;
      return json({ config: getAgentConfig(), agent: { id: signed.agent.id, instanceId: signed.agent.instanceId } });
    }

    if (url.pathname.startsWith("/api/agent/heartbeat") && request.method === "POST") {
      const signed = await readSignedAgentRequest(request, url);
      if (signed.response) return signed.response;
      try {
        const body = agentHeartbeatSchema.parse(signed.bodyText ? JSON.parse(signed.bodyText) : {});
        const [updated] = await db.update(serverAgent).set({
          hostname: body.hostname ?? signed.agent.hostname,
          version: body.version ?? signed.agent.version,
          status: body.status,
          lastSeenAt: new Date(),
          lastIp: getRemoteIp(request),
          updatedAt: new Date(),
        }).where(eq(serverAgent.id, signed.agent.id)).returning();
        return json({ ok: true, agent: { id: updated.id, status: updated.status, lastSeenAt: updated.lastSeenAt } });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/agent/snapshot") && request.method === "POST") {
      const signed = await readSignedAgentRequest(request, url);
      if (signed.response) return signed.response;
      try {
        const body = agentSnapshotSchema.parse(JSON.parse(signed.bodyText || "{}"));
        const observedAt = toDateOrNull(body.observedAt) ?? new Date();
        const snapshotId = makeId("snap");

        await db.insert(serverTelemetrySnapshot).values({
          id: snapshotId,
          agentId: signed.agent.id,
          instanceId: signed.agent.instanceId,
          userId: signed.agent.userId,
          status: "online",
          hostname: body.host.hostname ?? signed.agent.hostname,
          osName: body.host.osName,
          kernel: body.host.kernel,
          uptimeSeconds: body.host.uptimeSeconds ?? null,
          cpuUsagePercent: body.metrics.cpuUsagePercent ?? null,
          memoryUsedMb: body.metrics.memoryUsedMb ?? null,
          memoryTotalMb: body.metrics.memoryTotalMb ?? null,
          diskUsedGb: body.metrics.diskUsedGb ?? null,
          diskTotalGb: body.metrics.diskTotalGb ?? null,
          securityScore: body.security.score ?? null,
          securitySummary: body.security.summary ?? null,
          raw: JSON.stringify(body),
          observedAt,
        });

        await Promise.all([
          db.delete(serverSecurityFinding).where(eq(serverSecurityFinding.agentId, signed.agent.id)),
          db.delete(serverWebsite).where(eq(serverWebsite.agentId, signed.agent.id)),
          db.delete(serverContainer).where(eq(serverContainer.agentId, signed.agent.id)),
          db.delete(serverDatabase).where(eq(serverDatabase.agentId, signed.agent.id)),
          db.delete(detectedAiRuntime).where(eq(detectedAiRuntime.agentId, signed.agent.id)),
        ]);

        if (body.security.findings.length) {
          await db.insert(serverSecurityFinding).values(body.security.findings.map((finding) => ({
            id: makeId("finding"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            code: finding.code,
            title: finding.title,
            severity: finding.severity,
            status: "open",
            detail: finding.detail ?? null,
            evidence: toJsonText(finding.evidence),
            observedAt,
          })));
        }

        if (body.websites.length) {
          await db.insert(serverWebsite).values(body.websites.map((site) => ({
            id: makeId("siteobs"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            url: site.url,
            domain: site.domain,
            status: site.status,
            httpStatus: site.httpStatus ?? null,
            redirectUrl: site.redirectUrl ?? null,
            sslStatus: site.sslStatus ?? null,
            sslIssuer: site.sslIssuer ?? null,
            sslExpiresAt: toDateOrNull(site.sslExpiresAt),
            sslHostnameMatches: site.sslHostnameMatches ?? null,
            appType: site.appType ?? null,
            source: site.source ?? null,
            raw: JSON.stringify(site),
            observedAt,
          })));
        }

        if (body.containers.length) {
          await db.insert(serverContainer).values(body.containers.map((container) => ({
            id: makeId("container"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            containerId: container.containerId,
            name: container.name,
            image: container.image,
            status: container.status,
            health: container.health ?? null,
            ports: toJsonText(container.ports),
            labels: toJsonText(container.labels),
            isPrivileged: container.isPrivileged,
            restartCount: container.restartCount,
            observedAt,
          })));
        }

        if (body.databases.length) {
          await db.insert(serverDatabase).values(body.databases.map((database) => ({
            id: makeId("dbobs"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            engine: database.engine,
            version: database.version ?? null,
            source: database.source,
            containerName: database.containerName ?? null,
            port: database.port ?? null,
            status: database.status,
            isPublic: database.isPublic,
            hasPersistentVolume: database.hasPersistentVolume,
            raw: JSON.stringify(database),
            observedAt,
          })));
        }

        if (body.aiRuntimes.length) {
          await db.insert(detectedAiRuntime).values(body.aiRuntimes.map((runtime) => ({
            id: makeId("airuntime"),
            agentId: signed.agent.id,
            instanceId: signed.agent.instanceId,
            userId: signed.agent.userId,
            runtime: runtime.runtime,
            name: runtime.name,
            image: runtime.image ?? null,
            version: runtime.version ?? null,
            status: runtime.status,
            health: runtime.health ?? null,
            ports: toJsonText(runtime.ports),
            raw: JSON.stringify(runtime),
            observedAt,
          })));
        }

        await db.update(serverAgent).set({
          hostname: body.host.hostname ?? signed.agent.hostname,
          status: "online",
          lastSeenAt: new Date(),
          lastIp: getRemoteIp(request),
          updatedAt: new Date(),
        }).where(eq(serverAgent.id, signed.agent.id));

        return json({ ok: true, snapshotId });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/public/affiliate-click") && request.method === "POST") {
      try {
        const body = await parseBody(request, affiliateClickSchema);
        const affiliateRow = await db.query.affiliate.findFirst({
          where: eq(affiliate.referralCode, body.referralCode.trim()),
        });
        if (!affiliateRow || !canGenerateCommission(affiliateRow.status)) {
          return json({ ok: true, tracked: false });
        }

        const [created] = await db.insert(affiliateReferral).values({
          id: makeId("affref"),
          affiliateId: affiliateRow.id,
          referralCode: affiliateRow.referralCode,
          visitorId: body.visitorId ?? null,
          sourceUrl: body.sourceUrl ?? request.headers.get("referer"),
          landingPage: body.landingPage ?? url.pathname,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          attributionType: "link",
          attributionModel: "last_click",
          status: "clicked",
        }).returning();

        return json({ ok: true, tracked: true, referralId: created.id });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/public/affiliate-application") && request.method === "POST") {
      try {
        const body = await parseBody(request, affiliateApplicationSchema);
        const email = body.email.toLowerCase();
        const existing = await db.query.affiliate.findFirst({
          where: eq(affiliate.email, email),
        });
        if (existing) return json({ error: "An affiliate application already exists for this email" }, 409);

        const [created] = await db.insert(affiliate).values({
          id: makeId("aff"),
          fullName: body.fullName,
          email,
          phone: body.phone ?? null,
          companyName: body.companyName ?? null,
          website: body.website ?? null,
          socialLinks: body.socialLinks ?? null,
          affiliateType: body.affiliateType,
          expectedReferralMethod: body.expectedReferralMethod,
          status: "pending",
          referralCode: await generateUniqueReferralCode(body.fullName || email),
          payoutMethod: body.payoutMethod ?? "manual_eft",
          payoutDetails: body.payoutDetails ? encryptSecret(body.payoutDetails) : null,
          termsAcceptedAt: new Date(),
        }).returning();

        await recordAudit({
          action: "affiliate.application.created",
          entityType: "affiliate",
          entityId: created.id,
          message: `Affiliate application submitted by ${created.email}`,
          metadata: { affiliateType: created.affiliateType },
        });

        return json({ affiliate: sanitizeAffiliate(created, url.origin) }, 201);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/user/metrics")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      try {
        const userInvoiceRows = await db.query.invoice.findMany({
          where: eq(invoice.userId, session.user.id),
        });
        const totalSpend = userInvoiceRows
          .filter((row) => row.status === "paid")
          .reduce((total, row) => total + row.amount, 0);

        const domains = await db.query.registeredDomain.findMany({
          where: eq(registeredDomain.userId, session.user.id),
        });

        const servers = await db.query.vultrInstance.findMany({
          where: eq(vultrInstance.userId, session.user.id),
        });

        const websites = await db.query.website.findMany({
          where: eq(website.userId, session.user.id),
        });

        const agents = await db.query.aiAgent.findMany({
          where: eq(aiAgent.userId, session.user.id),
        });

        const openTickets = await db.query.supportTicket.findMany({
          where: eq(supportTicket.userId, session.user.id),
        });

        return new Response(JSON.stringify({
          totalSpend,
          domains: domains.length,
          cloudResources: servers.length,
          websites: websites.length,
          activeAgents: agents.filter((agent) => agent.status === "active").length,
          openTickets: openTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length
        }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error("Metrics error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch metrics" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/leads") && request.method === "POST") {
      try {
        const body = await request.json();
        const wizardAnswers = body.wizardAnswers && typeof body.wizardAnswers === "object" ? body.wizardAnswers : null;
        const servicesValue = wizardAnswers ? JSON.stringify(wizardAnswers) : body.services;
        await db.insert(lead).values({
          id: "lead_" + Date.now(),
          name: body.name,
          email: body.email,
          company: body.company,
          services: servicesValue,
          setupStyle: body.setupStyle,
        });
        await recordAudit({
          action: "lead.created",
          entityType: "lead",
          entityId: body.email,
          message: `Lead submitted by ${body.email}`,
          metadata: { services: body.services, setupStyle: body.setupStyle, wizardAnswers },
        });
        const settings = await getWorkspaceSettings();
        const adminEmail = settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
          sendN8nEmail({
            template: "lead_created",
            to: adminEmail,
            subject: "New CloudMonkey lead",
            data: { ...body, services: body.services, wizardAnswers },
            idempotencyKey: `lead:${body.email}:${Date.now()}`,
          }).catch((error) => console.error("Lead notification failed:", error));
        }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error("Lead submission error:", error);
        return new Response(JSON.stringify({ error: "Failed to submit lead" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/user/affiliate/attribute-signup") && request.method === "POST") {
      const { session, response } = await requireSession(request);
      if (response) return response;

      try {
        const body = await parseBody(request, z.object({
          referralCode: z.string().min(2),
          visitorId: z.string().optional().nullable(),
        }));
        const referral = await attributeSignupToAffiliate({
          userId: session.user.id,
          email: session.user.email ?? "",
          referralCode: body.referralCode,
          visitorId: body.visitorId,
          request,
        });
        return json({ attributed: !!referral, referral });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/webhooks/intelligence")) {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (!verifyIntelligenceWebhook(request)) return json({ error: "Invalid webhook secret" }, 401);

      try {
        const body = await parseBody(request, intelligenceWebhookResultSchema);
        const result = await persistIntelligenceWebhookResult(body);
        await recordAudit({
          action: `intelligence.webhook.${body.status}`,
          entityType: "intelligence_job",
          entityId: body.jobId,
          message: `Competitor intelligence job ${body.status}`,
          metadata: { projectId: result.project.id, externalRunId: body.externalRunId },
        });
        return json({ ok: true, ...result });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/user/intelligence")) {
      const { session, response } = await requireIntelligenceAccess(request);
      if (response) return response;

      const detailMatch = url.pathname.match(/^\/api\/user\/intelligence\/([^/]+)(?:\/([^/]+))?$/);

      if (url.pathname === "/api/user/intelligence/access" && request.method === "GET") {
        return json({ hasAccess: true });
      }

      if (url.pathname === "/api/user/intelligence" && request.method === "GET") {
        const rows = await db.query.intelligenceProject.findMany({
          where: eq(intelligenceProject.userId, session.user.id),
          orderBy: (intelligenceProject, { desc }) => [desc(intelligenceProject.updatedAt)],
        });
        return json({ projects: rows.map(publicProjectDto) });
      }

      if (url.pathname === "/api/user/intelligence" && request.method === "POST") {
        try {
          const body = await parseBody(request, intelligenceProjectSchema);
          const projectId = makeId("intelproj");
          const createdAt = new Date();
          const projectName = body.name?.trim() || `${body.businessName} intelligence`;

          const [created] = await db.insert(intelligenceProject).values({
            id: projectId,
            userId: session.user.id,
            name: projectName,
            businessName: body.businessName,
            websiteUrl: body.websiteUrl,
            location: body.location ?? null,
            industry: body.industry ?? null,
            servicesProducts: body.servicesProducts ?? null,
            status: "draft",
            metadata: JSON.stringify({ source: "dashboard" }),
            createdAt,
            updatedAt: createdAt,
          }).returning();

          if (body.targetKeywords.length) {
            await db.insert(intelligenceKeyword).values(body.targetKeywords.map((keyword) => ({
              id: makeId("intelkw"),
              projectId,
              userId: session.user.id,
              keyword,
              location: body.location ?? null,
              priority: "medium",
            })));
          }

          if (body.competitors.length) {
            await db.insert(intelligenceCompetitor).values(body.competitors.map((competitorInput) => ({
              id: makeId("intelcomp"),
              projectId,
              userId: session.user.id,
              name: competitorInput.name || defaultCompetitorName(competitorInput.websiteUrl),
              websiteUrl: competitorInput.websiteUrl,
              competitorType: competitorInput.competitorType ?? "manual",
              status: "active",
            })));
          }

          await recordAudit({
            actorUserId: session.user.id,
            action: "intelligence.project.created",
            entityType: "intelligence_project",
            entityId: created.id,
            message: `Competitor intelligence project created for ${created.businessName}`,
          });

          return json({ project: publicProjectDto(created) }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (detailMatch) {
        const projectId = decodeURIComponent(detailMatch[1]);
        const child = detailMatch[2] ? decodeURIComponent(detailMatch[2]) : null;
        const project = await getIntelligenceProjectForSession(projectId, session);
        if (!project) return json({ error: "Project not found" }, 404);

        if (!child && request.method === "GET") {
          return json(await buildIntelligenceOverview(project));
        }

        if (!child && request.method === "PATCH") {
          try {
            const body = await parseBody(request, intelligenceProjectUpdateSchema);
            const updates: Partial<typeof intelligenceProject.$inferInsert> = {
              updatedAt: new Date(),
            };
            if (body.name !== undefined) updates.name = body.name;
            if (body.businessName !== undefined) updates.businessName = body.businessName;
            if (body.websiteUrl !== undefined) updates.websiteUrl = body.websiteUrl;
            if (body.location !== undefined) updates.location = body.location ?? null;
            if (body.industry !== undefined) updates.industry = body.industry ?? null;
            if (body.servicesProducts !== undefined) updates.servicesProducts = body.servicesProducts ?? null;

            const [updated] = await db.update(intelligenceProject)
              .set(updates)
              .where(eq(intelligenceProject.id, project.id))
              .returning();
            return json({ project: publicProjectDto(updated) });
          } catch (error: any) {
            return json({ error: error.message, issues: error.issues }, error.status ?? 500);
          }
        }

        if (child === "overview" && request.method === "GET") {
          return json(await buildIntelligenceOverview(project));
        }

        if (child === "competitors" && request.method === "POST") {
          try {
            const body = await parseBody(request, intelligenceCompetitorSchema);
            const [created] = await db.insert(intelligenceCompetitor).values({
              id: makeId("intelcomp"),
              projectId: project.id,
              userId: project.userId,
              name: body.name || defaultCompetitorName(body.websiteUrl),
              websiteUrl: body.websiteUrl,
              competitorType: body.competitorType ?? "manual",
              status: "active",
            }).returning();
            await db.update(intelligenceProject).set({ updatedAt: new Date() }).where(eq(intelligenceProject.id, project.id));
            return json({ competitor: created }, 201);
          } catch (error: any) {
            return json({ error: error.message, issues: error.issues }, error.status ?? 500);
          }
        }

        if (child === "keywords" && request.method === "POST") {
          try {
            const body = await parseBody(request, intelligenceKeywordSchema);
            const [created] = await db.insert(intelligenceKeyword).values({
              id: makeId("intelkw"),
              projectId: project.id,
              userId: project.userId,
              keyword: body.keyword,
              location: body.location ?? project.location,
              device: body.device,
              intent: body.intent ?? null,
              priority: body.priority,
              status: "active",
            }).returning();
            await db.update(intelligenceProject).set({ updatedAt: new Date() }).where(eq(intelligenceProject.id, project.id));
            return json({ keyword: created }, 201);
          } catch (error: any) {
            return json({ error: error.message, issues: error.issues }, error.status ?? 500);
          }
        }

        if (child === "submit" && request.method === "POST") {
          try {
            const [competitors, keywords] = await Promise.all([
              db.query.intelligenceCompetitor.findMany({ where: eq(intelligenceCompetitor.projectId, project.id) }),
              db.query.intelligenceKeyword.findMany({ where: eq(intelligenceKeyword.projectId, project.id) }),
            ]);
            const missing = [
              !project.businessName ? "businessName" : null,
              !project.websiteUrl ? "websiteUrl" : null,
              !project.location ? "location" : null,
              !project.industry ? "industry" : null,
              !project.servicesProducts ? "servicesProducts" : null,
              keywords.length < 3 ? "targetKeywords" : null,
              competitors.length < 3 ? "competitors" : null,
            ].filter(Boolean);
            if (missing.length) {
              return json({ error: "Complete the required intelligence fields before submitting", missing }, 400);
            }

            const [updated] = await db.update(intelligenceProject).set({
              status: "submitted",
              updatedAt: new Date(),
              metadata: JSON.stringify({
                ...(safeJsonParse(project.metadata) ?? {}),
                submittedAt: new Date().toISOString(),
                submittedBy: session.user.id,
              }),
            }).where(eq(intelligenceProject.id, project.id)).returning();

            await recordAudit({
              actorUserId: session.user.id,
              action: "intelligence.project.submitted",
              entityType: "intelligence_project",
              entityId: project.id,
              message: `Competitor intelligence project submitted for ${project.businessName}`,
            });

            return json({ project: publicProjectDto(updated) });
          } catch (error: any) {
            return json({ error: error.message, issues: error.issues }, error.status ?? 500);
          }
        }

        if (child === "scan" && request.method === "POST") {
          if (!isAdmin(session)) {
            return json({ error: "Only admins can run Competitor Intelligence reports" }, 403);
          }
          try {
            const body = await parseBody(request, intelligenceScanSchema);
            const [competitors, keywords] = await Promise.all([
              db.query.intelligenceCompetitor.findMany({ where: eq(intelligenceCompetitor.projectId, project.id) }),
              db.query.intelligenceKeyword.findMany({ where: eq(intelligenceKeyword.projectId, project.id) }),
            ]);
            const scanTargets = [project.websiteUrl, ...competitors.map((competitor) => competitor.websiteUrl)].slice(0, 4);
            const freeCrawlPages: Array<ReturnType<typeof crawlSiteFingerprint> extends Promise<infer T> ? T : never> = [];
            for (const [index, targetUrl] of scanTargets.entries()) {
              try {
                const target = index === 0 ? "primary" : "competitor";
                const fingerprint = await crawlSiteFingerprint(targetUrl, target);
                freeCrawlPages.push({
                  ...fingerprint,
                  projectId: project.id,
                  jobId: null,
                  userId: project.userId,
                  competitorId: index === 0 ? null : competitors[index - 1]?.id ?? null,
                });
              } catch (crawlError: any) {
                freeCrawlPages.push({
                  id: makeId("intelpage"),
                  projectId: project.id,
                  jobId: null,
                  userId: project.userId,
                  competitorId: index === 0 ? null : competitors[index - 1]?.id ?? null,
                  url: targetUrl,
                  target: index === 0 ? "primary" : "competitor",
                  httpStatus: null,
                  title: null,
                  metaDescription: null,
                  h1: null,
                  h2Count: 0,
                  wordCount: 0,
                  internalLinkCount: 0,
                  externalLinkCount: 0,
                  imageMissingAltCount: 0,
                  hasCanonical: false,
                  hasSchema: false,
                  loadTimeMs: null,
                  screenshotUrl: null,
                  raw: { error: crawlError.message, sourceUrl: targetUrl, target: index === 0 ? "primary" : "competitor" },
                  observedAt: new Date().toISOString(),
                } as any);
              }
            }

            const freePrimaryPage = freeCrawlPages[0] ?? null;
            const freeSearchConsoleSnapshot = await fetchGoogleSearchConsoleSnapshot(session.user.id, project.websiteUrl).catch(() => null);
            const freeSearchConsoleSerpResults = freeSearchConsoleSnapshot?.connected
              ? freeSearchConsoleSnapshot.rows.slice(0, 25).map((row) => ({
                  keywordId: null,
                  keyword: row.query,
                  location: project.location ?? null,
                  device: "desktop",
                  resultUrl: row.page,
                  resultTitle: row.query,
                  domain: row.page ? new URL(row.page).hostname.replace(/^www\./, "") : null,
                  rank: Math.max(1, Math.round(row.position)),
                  resultType: "search_console",
                  hasAds: false,
                  hasMapPack: false,
                  hasAiOverview: false,
                  raw: { source: "google-search-console", clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
                  observedAt: new Date().toISOString(),
                }))
              : [];
            const freeAudits = freePrimaryPage
              ? [{
                  target: "primary",
                  targetUrl: project.websiteUrl,
                  technicalScore: Math.max(
                    10,
                    100 - (freePrimaryPage.imageMissingAltCount * 3) - (freePrimaryPage.hasCanonical ? 0 : 10) - (freePrimaryPage.hasSchema ? 0 : 8),
                  ),
                  contentScore: Math.max(10, Math.min(100, Math.round((freePrimaryPage.wordCount || 0) / 20))),
                  localScore: project.location ? 48 : 18,
                  performanceScore: freePrimaryPage.loadTimeMs ? Math.max(10, 100 - Math.round(freePrimaryPage.loadTimeMs / 50)) : 40,
                  aiReadinessScore: freePrimaryPage.hasSchema ? 72 : 52,
                  summary: "Free crawl fingerprint generated from the live website without a paid provider.",
                  raw: freePrimaryPage.raw,
                }]
              : [];

            if (freeCrawlPages.length) {
              await db.insert(intelligenceCrawlPage).values(freeCrawlPages.map((page) => ({
                id: page.id,
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                competitorId: page.competitorId ?? null,
                url: page.url,
                target: page.target,
                httpStatus: page.httpStatus ?? null,
                title: page.title ?? null,
                metaDescription: page.metaDescription ?? null,
                h1: page.h1 ?? null,
                h2Count: page.h2Count ?? 0,
                wordCount: page.wordCount ?? 0,
                internalLinkCount: page.internalLinkCount ?? 0,
                externalLinkCount: page.externalLinkCount ?? 0,
                imageMissingAltCount: page.imageMissingAltCount ?? 0,
                hasCanonical: page.hasCanonical ?? false,
                hasSchema: page.hasSchema ?? false,
                loadTimeMs: page.loadTimeMs ?? null,
                screenshotUrl: page.screenshotUrl ?? null,
                raw: JSON.stringify(page.raw ?? {}),
                observedAt: new Date(page.observedAt ?? new Date()),
              })));
            }

            if (freeAudits.length) {
              await db.insert(intelligenceSeoAudit).values(freeAudits.map((audit) => ({
                id: makeId("intelaudit"),
                projectId: project.id,
                jobId: null,
                userId: project.userId,
                target: audit.target ?? "primary",
                targetUrl: audit.targetUrl,
                technicalScore: audit.technicalScore ?? 0,
                contentScore: audit.contentScore ?? 0,
                localScore: audit.localScore ?? 0,
                performanceScore: audit.performanceScore ?? 0,
                aiReadinessScore: audit.aiReadinessScore ?? 0,
                summary: audit.summary ?? null,
                raw: JSON.stringify(audit.raw ?? {}),
              })));
            }

            if (freeSearchConsoleSerpResults.length) {
              await db.insert(intelligenceSerpResult).values(freeSearchConsoleSerpResults.map((row) => ({
                id: makeId("intelserp"),
                projectId: project.id,
                userId: project.userId,
                keywordId: null,
                keyword: row.keyword,
                location: row.location ?? null,
                device: row.device ?? null,
                resultUrl: row.resultUrl ?? null,
                resultTitle: row.resultTitle ?? null,
                domain: row.domain ?? null,
                rank: row.rank ?? null,
                resultType: row.resultType ?? "search_console",
                hasAds: row.hasAds ?? false,
                hasMapPack: row.hasMapPack ?? false,
                hasAiOverview: row.hasAiOverview ?? false,
                raw: JSON.stringify(row.raw ?? {}),
                observedAt: new Date(row.observedAt ?? new Date()),
              })));
            }

            const freeRecommendations: Array<{ title: string; description: string; category: string; priority: string; impact: string; effort: string; sourceType: string; sourceId: string | null }> = [];
            if (freeSearchConsoleSnapshot?.connected) {
              freeRecommendations.push({
                title: "Use Search Console queries to close ranking gaps",
                description: `Google Search Console is connected to ${freeSearchConsoleSnapshot.property}. Focus on pages with high impressions and positions between 4 and 20.`,
                category: "owned_site_growth",
                priority: "high",
                impact: "high",
                effort: "low",
                sourceType: "search_console",
                sourceId: project.id,
              });
            } else {
              freeRecommendations.push({
                title: "Connect Google Search Console",
                description: "This is the best free owned-site data source. It unlocks click, impression, and query data for your own website.",
                category: "integration",
                priority: "medium",
                impact: "high",
                effort: "low",
                sourceType: "integration",
                sourceId: project.id,
              });
            }
            if (freeCrawlPages.length) {
              const primary = freeCrawlPages[0];
              freeRecommendations.push({
                title: "Tighten the free crawl fingerprints",
                description: `The live crawl found ${primary.wordCount || 0} words on the homepage and ${primary.imageMissingAltCount || 0} images missing alt text.`,
                category: "technical_seo",
                priority: "medium",
                impact: "medium",
                effort: "low",
                sourceType: "crawl",
                sourceId: project.id,
              });
            }
            if (freeRecommendations.length) {
              await db.insert(intelligenceRecommendation).values(freeRecommendations.map((row) => ({
                id: makeId("intelrec"),
                projectId: project.id,
                userId: project.userId,
                title: row.title,
                description: row.description,
                category: row.category,
                priority: row.priority,
                impact: row.impact,
                effort: row.effort,
                sourceType: row.sourceType,
                sourceId: row.sourceId,
                status: "open",
              })));
            }

            const [job] = await db.insert(intelligenceJob).values({
              id: makeId("inteljob"),
              projectId: project.id,
              userId: project.userId,
              jobType: body.scanType,
              status: "queued",
              provider: "n8n",
              input: JSON.stringify({
                scanType: body.scanType,
                project,
                competitors,
                keywords,
                freeCrawlPages,
                freeAudits,
                freeSearchConsoleSnapshot,
                freeSearchConsoleSerpResults,
              }),
            }).returning();

            await db.update(intelligenceProject).set({
              lastScanStatus: "queued",
              updatedAt: new Date(),
            }).where(eq(intelligenceProject.id, project.id));

            try {
              const n8nResponse = await sendN8nCompetitorIntelligence({
                project,
                job,
                user: {
                  id: session.user.id,
                  name: session.user.name,
                  email: session.user.email,
                },
                competitors,
                keywords,
                freeCrawlPages,
                freeAudits,
                freeSearchConsoleSnapshot,
                freeSearchConsoleSerpResults,
                origin: url.origin,
                idempotencyKey: `intelligence:${job.id}`,
              });
              const [updatedJob] = await db.update(intelligenceJob).set({
                status: "sent_to_n8n",
                output: JSON.stringify(n8nResponse),
                startedAt: new Date(),
                updatedAt: new Date(),
              }).where(eq(intelligenceJob.id, job.id)).returning();
              await db.update(intelligenceProject).set({
                lastScanStatus: "sent_to_n8n",
                updatedAt: new Date(),
              }).where(eq(intelligenceProject.id, project.id));
              return json({ job: updatedJob, n8nStatus: "sent", n8nResponse }, 202);
            } catch (n8nError: any) {
              const [updatedJob] = await db.update(intelligenceJob).set({
                status: "n8n_failed",
                error: n8nError.message,
                updatedAt: new Date(),
              }).where(eq(intelligenceJob.id, job.id)).returning();
              await db.update(intelligenceProject).set({
                lastScanStatus: "n8n_failed",
                updatedAt: new Date(),
              }).where(eq(intelligenceProject.id, project.id));
              await recordAudit({
                actorUserId: session.user.id,
                action: "intelligence.scan.n8n_failed",
                entityType: "intelligence_job",
                entityId: job.id,
                message: `Competitor intelligence scan saved but n8n failed for ${project.businessName}`,
                level: "error",
                metadata: { error: n8nError.message },
              });
              return json({ job: updatedJob, n8nStatus: "failed", error: n8nError.message }, 202);
            }
          } catch (error: any) {
            return json({ error: error.message, issues: error.issues }, error.status ?? 500);
          }
        }

        if (["recommendations", "reports"].includes(child ?? "") && request.method === "GET") {
          const overview = await buildIntelligenceOverview(project);
          return json(child === "reports" ? { reports: overview.reports } : { recommendations: overview.recommendations });
        }
      }

      return json({ error: "Not found" }, 404);
    }

    if (url.pathname.startsWith("/api/admin/intelligence")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      const detailMatch = url.pathname.match(/^\/api\/admin\/intelligence\/([^/]+)(?:\/([^/]+))?$/);

      if (url.pathname === "/api/admin/intelligence" && request.method === "GET") {
        const rows = await db.query.intelligenceProject.findMany({
          orderBy: (intelligenceProject, { desc }) => [desc(intelligenceProject.updatedAt)],
        });
        const owners = await Promise.all(rows.map((row) => db.query.user.findFirst({ where: eq(user.id, row.userId) })));
        const ownerById = new Map(owners.filter(Boolean).map((row) => [row!.id, row!]));
        return json({
          projects: rows.map((row) => ({
            ...publicProjectDto(row),
            owner: ownerById.get(row.userId)
              ? {
                  id: ownerById.get(row.userId)!.id,
                  name: ownerById.get(row.userId)!.name,
                  email: ownerById.get(row.userId)!.email,
                }
              : null,
          })),
        });
      }

      if (detailMatch && !detailMatch[2] && request.method === "GET") {
        const project = await getIntelligenceProjectForSession(decodeURIComponent(detailMatch[1]), session);
        if (!project) return json({ error: "Project not found" }, 404);
        return json(await buildIntelligenceOverview(project));
      }

      if (detailMatch && decodeURIComponent(detailMatch[2] ?? "") === "scan" && request.method === "POST") {
        try {
          const project = await getIntelligenceProjectForSession(decodeURIComponent(detailMatch[1]), session);
          if (!project) return json({ error: "Project not found" }, 404);
          const body = await parseBody(request, intelligenceScanSchema);
          const [competitors, keywords, owner] = await Promise.all([
            db.query.intelligenceCompetitor.findMany({ where: eq(intelligenceCompetitor.projectId, project.id) }),
            db.query.intelligenceKeyword.findMany({ where: eq(intelligenceKeyword.projectId, project.id) }),
            db.query.user.findFirst({ where: eq(user.id, project.userId) }),
          ]);

          const [job] = await db.insert(intelligenceJob).values({
            id: makeId("inteljob"),
            projectId: project.id,
            userId: project.userId,
            jobType: body.scanType,
            status: "queued",
            provider: "n8n",
            input: JSON.stringify({
              scanType: body.scanType,
              project,
              competitors,
              keywords,
              dataForSeoConfigured: Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
              pageSpeedConfigured: Boolean(process.env.PAGESPEED_API_KEY),
              googleSearchConsoleOptional: true,
            }),
          }).returning();

          await db.update(intelligenceProject).set({
            status: "running",
            lastScanStatus: "queued",
            updatedAt: new Date(),
          }).where(eq(intelligenceProject.id, project.id));

          try {
            const n8nResponse = await sendN8nCompetitorIntelligence({
              project,
              job,
              user: {
                id: owner?.id ?? project.userId,
                name: owner?.name ?? null,
                email: owner?.email ?? null,
              },
              competitors,
              keywords,
              origin: url.origin,
              idempotencyKey: `intelligence:${job.id}`,
            });
            const [updatedJob] = await db.update(intelligenceJob).set({
              status: "sent_to_n8n",
              output: JSON.stringify(n8nResponse),
              startedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(intelligenceJob.id, job.id)).returning();
            await db.update(intelligenceProject).set({
              lastScanStatus: "sent_to_n8n",
              updatedAt: new Date(),
            }).where(eq(intelligenceProject.id, project.id));
            return json({ job: updatedJob, n8nStatus: "sent", n8nResponse }, 202);
          } catch (n8nError: any) {
            const [updatedJob] = await db.update(intelligenceJob).set({
              status: "n8n_failed",
              error: n8nError.message,
              updatedAt: new Date(),
            }).where(eq(intelligenceJob.id, job.id)).returning();
            await db.update(intelligenceProject).set({
              lastScanStatus: "n8n_failed",
              updatedAt: new Date(),
            }).where(eq(intelligenceProject.id, project.id));
            await recordAudit({
              actorUserId: session.user.id,
              action: "intelligence.scan.n8n_failed",
              entityType: "intelligence_job",
              entityId: job.id,
              message: `Competitor intelligence scan saved but n8n failed for ${project.businessName}`,
              level: "error",
              metadata: { error: n8nError.message },
            });
            return json({ job: updatedJob, n8nStatus: "failed", error: n8nError.message }, 202);
          }
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Not found" }, 404);
    }

    if (url.pathname.startsWith("/api/user/affiliate")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "GET") {
        try {
          const affiliateRow = await db.query.affiliate.findFirst({
            where: eq(affiliate.email, (session.user.email ?? "").toLowerCase()),
          }) ?? await db.query.affiliate.findFirst({
            where: eq(affiliate.userId, session.user.id),
          });

          if (!affiliateRow) return json({ affiliate: null });
          if (!affiliateRow.userId) {
            await db.update(affiliate).set({ userId: session.user.id, updatedAt: new Date() }).where(eq(affiliate.id, affiliateRow.id));
            affiliateRow.userId = session.user.id;
          }

          const [referrals, commissions, payouts, flags] = await Promise.all([
            db.query.affiliateReferral.findMany({
              where: eq(affiliateReferral.affiliateId, affiliateRow.id),
              orderBy: (affiliateReferral, { desc }) => [desc(affiliateReferral.createdAt)],
            }),
            db.query.affiliateCommission.findMany({
              where: eq(affiliateCommission.affiliateId, affiliateRow.id),
              orderBy: (affiliateCommission, { desc }) => [desc(affiliateCommission.createdAt)],
            }),
            db.query.affiliatePayout.findMany({
              where: eq(affiliatePayout.affiliateId, affiliateRow.id),
              orderBy: (affiliatePayout, { desc }) => [desc(affiliatePayout.createdAt)],
            }),
            db.query.affiliateFraudFlag.findMany({
              where: eq(affiliateFraudFlag.affiliateId, affiliateRow.id),
              orderBy: (affiliateFraudFlag, { desc }) => [desc(affiliateFraudFlag.createdAt)],
            }),
          ]);
          const customerRows = await Promise.all(referrals.filter((row) => row.customerId).map((row) => db.query.user.findFirst({ where: eq(user.id, row.customerId!) })));
          const customers = new Map(customerRows.filter(Boolean).map((row) => [row!.id, row!]));

          return json({
            affiliate: sanitizeAffiliate(affiliateRow, url.origin, true),
            summary: affiliateSummary({ referrals, commissions }),
            referrals: referrals.map((row) => {
              const customer = row.customerId ? customers.get(row.customerId) : null;
              const rowCommissions = commissions.filter((item) => item.referralId === row.id);
              return {
                id: row.id,
                customerName: customer?.name ?? customer?.email ?? "Lead",
                signupDate: row.signedUpAt,
                status: row.status,
                commissionStatus: rowCommissions[0]?.status ?? "pending",
              };
            }),
            commissions,
            payouts,
            flags: flags.filter((row) => row.status === "open"),
          });
        } catch (error: any) {
          console.error("Affiliate profile fetch error:", error);
          return json({ error: "Failed to load affiliate profile" }, 500);
        }
      }

      if (request.method === "PUT") {
        try {
          const body = await parseBody(request, affiliateProfileSchema);
          const affiliateRow = await db.query.affiliate.findFirst({ where: eq(affiliate.userId, session.user.id) })
            ?? await db.query.affiliate.findFirst({ where: eq(affiliate.email, (session.user.email ?? "").toLowerCase()) });
          if (!affiliateRow) return json({ error: "Affiliate profile not found" }, 404);
          const [updated] = await db.update(affiliate).set({
            phone: body.phone ?? affiliateRow.phone,
            companyName: body.companyName ?? affiliateRow.companyName,
            website: body.website ?? affiliateRow.website,
            socialLinks: body.socialLinks ?? affiliateRow.socialLinks,
            expectedReferralMethod: body.expectedReferralMethod ?? affiliateRow.expectedReferralMethod,
            payoutMethod: body.payoutMethod ?? affiliateRow.payoutMethod,
            payoutDetails: body.payoutDetails ? encryptSecret(body.payoutDetails) : affiliateRow.payoutDetails,
            userId: session.user.id,
            updatedAt: new Date(),
          }).where(eq(affiliate.id, affiliateRow.id)).returning();
          return json({ affiliate: sanitizeAffiliate(updated, url.origin, true) });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }
    }

    if (url.pathname.startsWith("/api/user/subscription/verify")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      try {
        const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
        const reference = url.searchParams.get("reference") ?? body.reference;
        const subscriptionId = url.searchParams.get("subscription") ?? body.subscriptionId;

        const targetInvoice = reference
          ? await db.query.invoice.findFirst({ where: eq(invoice.paystackReference, reference) })
          : subscriptionId
            ? await db.query.invoice.findFirst({ where: eq(invoice.id, subscriptionId) })
            : null;
        const targetSubscription = targetInvoice
          ? await db.query.subscription.findFirst({
              where: eq(subscription.id, targetInvoice.id),
              with: { plan: { with: { service: true } }, bundle: true },
            })
          : subscriptionId
            ? await db.query.subscription.findFirst({
                where: eq(subscription.id, subscriptionId),
                with: { plan: { with: { service: true } }, bundle: true },
              })
            : null;

        if (targetInvoice && targetInvoice.userId !== session.user.id) {
          return json({ error: "Payment record not found" }, 404);
        }

        if (!targetInvoice) {
          if (!targetSubscription || targetSubscription.userId !== session.user.id) {
            return json({ error: "Subscription not found" }, 404);
          }
          if (targetSubscription.status === "trialing") {
            return json({ verified: true, invoice: null, subscription: targetSubscription }, 200);
          }
          return json({ error: "Payment record not found" }, 404);
        }

        if (!targetSubscription || targetSubscription.userId !== session.user.id) {
          return json({ error: "Subscription not found" }, 404);
        }

        if (targetInvoice.status === "paid" && targetSubscription.status === "active") {
          return json({ verified: true, invoice: targetInvoice, subscription: targetSubscription });
        }

        if (!targetInvoice.paystackReference) {
          return json({ verified: false, invoice: targetInvoice, subscription: targetSubscription }, 200);
        }

        const verification = await verifyPayment(targetInvoice.paystackReference);
        const paid = verification?.data?.status === "success" || verification?.data?.gateway_response === "Successful";
        if (!paid) {
          return json({ verified: false, invoice: targetInvoice, subscription: targetSubscription, payment: verification?.data ?? null }, 200);
        }

        const [updatedInvoice] = await db.update(invoice).set({
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(invoice.id, targetInvoice.id)).returning();

        const [updatedSubscription] = await db.update(subscription).set({
          status: "active",
          updatedAt: new Date(),
          currentPeriodStart: new Date(),
        }).where(eq(subscription.id, targetSubscription.id)).returning();

        await createAffiliateCommissionForPayment({
          invoiceId: updatedInvoice.id,
          customerId: updatedInvoice.userId,
          amount: updatedInvoice.amount,
          subscriptionId: updatedSubscription.id,
          paymentId: updatedInvoice.paystackReference ?? updatedInvoice.id,
        });

        const paidDomainOrder = await db.query.domainOrder.findFirst({
          where: eq(domainOrder.invoiceId, targetInvoice.id),
        });
        if (paidDomainOrder && !["registered", "registration_failed"].includes(paidDomainOrder.status)) {
          await db.update(domainOrder).set({
            status: "paid",
            updatedAt: new Date(),
          }).where(eq(domainOrder.id, paidDomainOrder.id));
          tryRegisterPaidDomainOrder(paidDomainOrder, request.url).catch((error) => {
            console.error("Domain registration follow-up failed:", error);
          });
        }

        await recordAudit({
          actorUserId: session.user.id,
          action: "subscription.verified",
          entityType: "subscription",
          entityId: targetSubscription.id,
          message: `Subscription payment verified for ${targetSubscription.name}`,
          metadata: { reference: targetInvoice.paystackReference },
        });

        sendEmail({
          template: "payment_received",
          to: session.user.email ?? "",
          subject: `Payment received for ${targetSubscription.name}`,
          data: {
            firstName: session.user.name,
            productName: targetSubscription.name,
            subscriptionName: targetSubscription.name,
            totalDue: formatEmailMoney(updatedInvoice.amount, updatedInvoice.currency ?? "ZAR"),
            primaryCtaText: "Open dashboard",
            primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
          },
          idempotencyKey: `payment:${targetInvoice.id}:received`,
        }).catch((error) => console.error("Payment receipt email failed:", error));

        return json({ verified: true, invoice: updatedInvoice, subscription: updatedSubscription });
      } catch (error: any) {
        return json({ error: error.message }, 500);
      }
    }

    if (url.pathname.startsWith("/api/user/subscription")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(
            request,
            z.object({
              planId: z.string().min(1).optional().nullable(),
              bundleId: z.string().min(1).optional().nullable(),
              name: z.string().min(1).optional().nullable(),
              amount: z.coerce.number().int().nonnegative().optional().nullable(),
              interval: z.enum(["month", "year"]).optional(),
              currentPeriodEnd: z.string().optional().nullable(),
              couponCode: z.string().max(80).optional().nullable(),
            }).refine((value) => !(value.planId && value.bundleId), {
              message: "Choose either a plan or a bundle, not both",
            }),
          );

          const planRow = body.planId
            ? await db.query.servicePlan.findFirst({
                where: eq(servicePlan.id, body.planId),
                with: { service: true, features: true },
              })
            : null;

          const bundleRow = body.bundleId
            ? await db.query.bundle.findFirst({
                where: eq(bundle.id, body.bundleId),
                with: { features: true },
              })
            : null;

          const productId = planRow?.id ?? bundleRow?.id ?? null;
          const productType = planRow ? "plan" : bundleRow ? "bundle" : null;
          const trialDays = planRow?.trialDays && !bundleRow ? planRow.trialDays : null;
          const isTrialPlan = typeof trialDays === "number" && trialDays > 0;

          const originalAmount = planRow?.priceZar
            ? parseInt(planRow.priceZar, 10)
            : bundleRow
              ? parseInt(bundleRow.priceZar, 10)
              : (body.amount ?? 0);
          const coupon = resolveCoupon(body.couponCode);
          const hasCouponInput = !!normalizeCouponCode(body.couponCode);
          if (hasCouponInput && !coupon) {
            return json({ error: "Coupon code is invalid" }, 400);
          }
          const amount = coupon ? applyPercentDiscount(originalAmount, coupon.percentOff) : originalAmount;
          if (!originalAmount) {
            return json({ error: "A payable amount is required" }, 400);
          }

          const email = session.user.email ?? "";
          if (!email) {
            return json({ error: "User email is required for payment checkout" }, 400);
          }

          const name = body.name ?? (planRow ? `${planRow.service?.name ?? "Service"} - ${planRow.name}` : bundleRow?.name) ?? "Selected package";
          const interval = body.interval ?? "month";
          const currentPeriodEnd = body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : (() => {
            const end = new Date();
            end.setMonth(end.getMonth() + (interval === "year" ? 12 : 1));
            return end;
          })();
          const existingSubscriptions = await db.query.subscription.findMany({
            where: eq(subscription.userId, session.user.id),
            orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
          });
          const matchesProduct = (row: typeof existingSubscriptions[number]) => {
            if (!productId) return row.name === name;
            if (productType === "plan") return row.planId === productId;
            if (productType === "bundle") return row.bundleId === productId;
            return false;
          };
          const accessSubscription = existingSubscriptions.find((row) => (row.status === "active" || row.status === "trialing") && matchesProduct(row));
          if (accessSubscription) {
            return json({
              subscription: accessSubscription,
              alreadyActive: true,
            }, 200);
          }

          const pendingSubscription = existingSubscriptions.find((row) => row.status === "pending" && matchesProduct(row));
          const existingInvoice = pendingSubscription
            ? await db.query.invoice.findFirst({ where: eq(invoice.id, pendingSubscription.id) })
            : null;

          if (coupon && amount === 0) {
            const invoiceId = pendingSubscription?.id ?? makeId("inv");
            const subscriptionId = invoiceId;
            const issuedAt = new Date();
            const currentPeriodEnd = body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : (() => {
              const end = new Date();
              end.setMonth(end.getMonth() + (interval === "year" ? 12 : 1));
              return end;
            })();
            const dueDate = new Date();
            const settings = await getWorkspaceSettings();
            const workspaceBillingSnapshot = JSON.stringify(getWorkspaceBillingDetails(settings));
            const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId.replace(/^inv[_-]?/i, "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
            const couponNote = `Coupon ${coupon.code} applied: ${coupon.percentOff}% off original amount ${formatEmailMoney(originalAmount)}.`;
            const invoiceValues = {
              invoiceNumber,
              issuedAt,
              publishedAt: issuedAt,
              paidAt: issuedAt,
              billingPeriodStart: issuedAt,
              billingPeriodEnd: currentPeriodEnd,
              currency: "ZAR",
              vatRateBps: 0,
              customerName: session.user.name ?? null,
              customerEmail: email,
              workspaceBillingSnapshot,
              notes: [settings?.billingInvoiceNotes, couponNote].filter(Boolean).join("\n") || null,
            };

            if (pendingSubscription) {
              if (existingInvoice) {
                await db.update(invoice).set({
                  amount,
                  status: "paid",
                  dueDate,
                  ...invoiceValues,
                  updatedAt: new Date(),
                }).where(eq(invoice.id, existingInvoice.id));
                await db.insert(invoiceItem).values({
                  id: makeId("invitem"),
                  invoiceId,
                  description: `${name} - ${coupon.label}`,
                  quantity: 1,
                  unitPrice: 0,
                  amount: 0,
                });
              } else {
                await db.insert(invoice).values({
                  id: invoiceId,
                  userId: session.user.id,
                  amount,
                  status: "paid",
                  dueDate,
                  invoiceSource: "checkout",
                  ...invoiceValues,
                });
                await db.insert(invoiceItem).values({
                  id: makeId("invitem"),
                  invoiceId,
                  description: `${name} - ${coupon.label}`,
                  quantity: 1,
                  unitPrice: 0,
                  amount: 0,
                });
              }
              const [updatedSubscription] = await db.update(subscription).set({
                planId: planRow?.id ?? body.planId ?? null,
                bundleId: bundleRow?.id ?? body.bundleId ?? null,
                name,
                status: "active",
                amount,
                interval,
                currentPeriodStart: issuedAt,
                currentPeriodEnd,
                updatedAt: new Date(),
              }).where(eq(subscription.id, pendingSubscription.id)).returning();

              await recordAudit({
                actorUserId: session.user.id,
                action: "subscription.coupon.activated",
                entityType: "subscription",
                entityId: updatedSubscription.id,
                message: `Coupon subscription activated for ${name}`,
                metadata: { coupon: coupon.code, percentOff: coupon.percentOff, originalAmount, amount },
              });

              return json({ subscription: updatedSubscription, coupon, discounted: true, alreadyPaid: true }, 200);
            }

            let createdSubscription: typeof subscription.$inferSelect;
            let createdInvoice: typeof invoice.$inferSelect;
            await db.transaction(async (tx) => {
              [createdInvoice] = await tx.insert(invoice).values({
                id: invoiceId,
                userId: session.user.id,
                amount,
                status: "paid",
                dueDate,
                invoiceSource: "checkout",
                ...invoiceValues,
              }).returning();
              [createdSubscription] = await tx.insert(subscription).values({
                id: subscriptionId,
                userId: session.user.id,
                bundleId: bundleRow?.id ?? body.bundleId ?? null,
                planId: planRow?.id ?? body.planId ?? null,
                name,
                status: "active",
                amount,
                interval,
                currentPeriodStart: issuedAt,
                currentPeriodEnd,
              }).returning();
              await tx.insert(invoiceItem).values([
                {
                  id: makeId("invitem"),
                  invoiceId,
                  description: name,
                  quantity: 1,
                  unitPrice: originalAmount,
                  amount: originalAmount,
                },
                {
                  id: makeId("invitem"),
                  invoiceId,
                  description: `${coupon.label} (${coupon.code})`,
                  quantity: 1,
                  unitPrice: -originalAmount,
                  amount: -originalAmount,
                },
              ]);
            });

            await recordAudit({
              actorUserId: session.user.id,
              action: "subscription.coupon.activated",
              entityType: "subscription",
              entityId: createdSubscription!.id,
              message: `Coupon subscription activated for ${name}`,
              metadata: { coupon: coupon.code, percentOff: coupon.percentOff, originalAmount, amount, invoiceId: createdInvoice!.id },
            });

            sendEmail({
              template: "payment_received",
              to: email,
              subject: `CloudMonkey subscription activated: ${name}`,
              data: {
                firstName: session.user.name,
                productName: name,
                subscriptionName: name,
                totalDue: formatEmailMoney(amount),
                primaryCtaText: "Open dashboard",
                primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
              },
              idempotencyKey: `coupon:${invoiceId}:activated`,
            }).catch((error) => console.error("Coupon activation email failed:", error));

            return json({ invoice: createdInvoice!, subscription: createdSubscription!, coupon, discounted: true, alreadyPaid: true }, 201);
          }

          if (isTrialPlan) {
            const trialPeriodEnd = new Date();
            trialPeriodEnd.setDate(trialPeriodEnd.getDate() + trialDays);
            const trialSubscriptionId = pendingSubscription?.id ?? makeId("sub");

            if (pendingSubscription) {
              if (existingInvoice) {
                await db.update(invoice).set({
                  status: "cancelled",
                  updatedAt: new Date(),
                }).where(eq(invoice.id, existingInvoice.id));
              }
              const [updatedTrialSubscription] = await db.update(subscription).set({
                planId: planRow?.id ?? body.planId ?? null,
                bundleId: null,
                name,
                status: "trialing",
                amount: 0,
                interval,
                currentPeriodStart: new Date(),
                currentPeriodEnd: trialPeriodEnd,
                updatedAt: new Date(),
              }).where(eq(subscription.id, pendingSubscription.id)).returning();

              await recordAudit({
                actorUserId: session.user.id,
                action: "subscription.trial.started",
                entityType: "subscription",
                entityId: updatedTrialSubscription.id,
                message: `Free trial started for ${name}`,
                metadata: { trialDays, planId: planRow?.id ?? body.planId ?? null },
              });

              return json({
                subscription: updatedTrialSubscription,
                trialing: true,
              }, 200);
            }

            const [createdTrialSubscription] = await db.insert(subscription).values({
              id: trialSubscriptionId,
              userId: session.user.id,
              bundleId: null,
              planId: planRow?.id ?? body.planId ?? null,
              name,
              status: "trialing",
              amount: 0,
              interval,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialPeriodEnd,
            }).returning();

            await recordAudit({
              actorUserId: session.user.id,
              action: "subscription.trial.started",
              entityType: "subscription",
              entityId: createdTrialSubscription.id,
              message: `Free trial started for ${name}`,
              metadata: { trialDays, planId: planRow?.id ?? body.planId ?? null },
            });

            return json({
              subscription: createdTrialSubscription,
              trialing: true,
            }, 200);
          }

          if (pendingSubscription && existingInvoice?.paystackUrl) {
            return json({
              subscription: pendingSubscription,
              invoice: existingInvoice,
              authorization_url: existingInvoice.paystackUrl,
              access_code: null,
              reference: existingInvoice.paystackReference,
              alreadyPending: true,
            }, 200);
          }

          const invoiceId = pendingSubscription?.id ?? makeId("inv");
          const subscriptionId = invoiceId;
          const checkoutReturnPath = websiteWizardReturnPath(planRow?.id ?? body.planId ?? "");
          const callbackUrl = `${new URL(request.url).origin}${checkoutReturnPath}?payment=return&subscription=${encodeURIComponent(subscriptionId)}`;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);
          const issuedAt = new Date();
          const settings = await getWorkspaceSettings();
          const workspaceBillingSnapshot = JSON.stringify(getWorkspaceBillingDetails(settings));
          const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId.replace(/^inv[_-]?/i, "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
          const invoiceValues = {
            invoiceNumber,
            issuedAt,
            billingPeriodStart: issuedAt,
            billingPeriodEnd: currentPeriodEnd,
            currency: "ZAR",
            vatRateBps: 0,
            customerName: session.user.name ?? null,
            customerEmail: email,
            workspaceBillingSnapshot,
            notes: settings?.billingInvoiceNotes ?? null,
          };

          if (!pendingSubscription) {
            await db.transaction(async (tx) => {
              await tx.insert(invoice).values({
                id: invoiceId,
                userId: session.user.id,
                amount,
                status: "pending",
                dueDate,
                ...invoiceValues,
              });
              await tx.insert(subscription).values({
                id: subscriptionId,
                userId: session.user.id,
                bundleId: bundleRow?.id ?? body.bundleId ?? null,
                planId: planRow?.id ?? body.planId ?? null,
                name,
                status: "pending",
                amount,
                interval,
                currentPeriodStart: new Date(),
                currentPeriodEnd,
              });
              await tx.insert(invoiceItem).values({
                id: makeId("invitem"),
                invoiceId,
                description: name,
                quantity: 1,
                unitPrice: amount,
                amount,
              });
            });
          } else if (!existingInvoice) {
            await db.insert(invoice).values({
              id: invoiceId,
              userId: session.user.id,
              amount,
              status: "pending",
              dueDate,
              ...invoiceValues,
            });
            await db.insert(invoiceItem).values({
              id: makeId("invitem"),
              invoiceId,
              description: name,
              quantity: 1,
              unitPrice: amount,
              amount,
            });
          }

          let payment: Awaited<ReturnType<typeof initializePayment>>;
          try {
            payment = await initializePayment({
              email,
              amountCents: amount,
              invoiceId,
              subscriptionId,
              userId: session.user.id,
              planId: planRow?.id ?? body.planId ?? null,
              bundleId: bundleRow?.id ?? body.bundleId ?? null,
              callbackUrl,
            });
          } catch (error) {
            await db.update(invoice).set({
              status: "cancelled",
              updatedAt: new Date(),
            }).where(eq(invoice.id, invoiceId));
            await db.update(subscription).set({
              status: "cancelled",
              updatedAt: new Date(),
            }).where(eq(subscription.id, subscriptionId));
            throw error;
          }

          const [updatedInvoice] = await db.update(invoice).set({
            paystackReference: payment.data.reference,
            paystackUrl: payment.data.authorization_url,
            updatedAt: new Date(),
          }).where(eq(invoice.id, invoiceId)).returning();

          const [updatedSubscription] = await db.update(subscription).set({
            status: "pending",
            planId: planRow?.id ?? body.planId ?? null,
            bundleId: bundleRow?.id ?? body.bundleId ?? null,
            name,
            amount,
            interval,
            currentPeriodStart: new Date(),
            currentPeriodEnd,
            updatedAt: new Date(),
          }).where(eq(subscription.id, subscriptionId)).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "subscription.checkout.started",
            entityType: "subscription",
            entityId: subscriptionId,
            message: `Subscription checkout started for ${name}`,
            metadata: { invoiceId, reference: payment.data.reference },
          });

          sendEmail({
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
              totalDue: formatEmailMoney(updatedInvoice.amount, updatedInvoice.currency ?? "ZAR"),
              dueDate: formatEmailDate(updatedInvoice.dueDate),
              primaryCtaText: "View invoice",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`,
            },
            idempotencyKey: `invoice:${invoiceId}:created`,
          }).catch((error) => console.error("Invoice email failed:", error));

          return json({
            invoice: updatedInvoice,
            subscription: updatedSubscription,
            authorization_url: payment.data.authorization_url,
            access_code: payment.data.access_code,
            reference: payment.data.reference,
          }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.subscription.findMany({
        where: eq(subscription.userId, session.user.id),
        with: { plan: { with: { service: true, features: true } }, bundle: { with: { features: true } } },
        orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/user/website-onboarding")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

      try {
        const body = await parseBody(request, websiteOnboardingSchema);
        const activeSubscription = await db.query.subscription.findFirst({
          where: eq(subscription.id, body.subscriptionId),
          with: { plan: { with: { service: true, features: true } }, bundle: { with: { features: true } } },
        });

        if (!activeSubscription || activeSubscription.userId !== session.user.id) {
          return json({ error: "Subscription not found" }, 404);
        }
        if (!isWebsitePlanId(activeSubscription.planId)) {
          return json({ error: "This wizard is only for website and ecommerce plans" }, 400);
        }
        if (!["active", "trialing"].includes(activeSubscription.status)) {
          return json({ error: "Payment or trial activation is required before onboarding can be submitted" }, 402);
        }

        const productType = activeSubscription.planId ? "plan" : "bundle";
        const productId = activeSubscription.planId ?? activeSubscription.bundleId ?? activeSubscription.id;
        const existingSubmission = await db.query.onboardingSubmission.findFirst({
          where: eq(onboardingSubmission.subscriptionId, activeSubscription.id),
        });
        const submittedAt = new Date();
        const submissionValues = {
          userId: session.user.id,
          subscriptionId: activeSubscription.id,
          productType,
          productId,
          status: "submitted",
          answers: JSON.stringify(body.answers),
          submittedAt,
          updatedAt: new Date(),
        };
        const [savedSubmission] = existingSubmission
          ? await db.update(onboardingSubmission).set(submissionValues).where(eq(onboardingSubmission.id, existingSubmission.id)).returning()
          : await db.insert(onboardingSubmission).values({
              id: makeId("onboard"),
              ...submissionValues,
            }).returning();

        const subscriptionInvoice = await db.query.invoice.findFirst({
          where: eq(invoice.id, activeSubscription.id),
        });
        const websiteProject = await createWebsiteProjectFromOnboarding({
          userId: session.user.id,
          subscription: activeSubscription,
          invoiceId: subscriptionInvoice?.id ?? null,
          answers: body.answers,
        });

        const settings = await getWorkspaceSettings();
        const adminEmail = settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
          sendEmail({
            template: "onboarding_received",
            to: adminEmail,
            subject: `Website onboarding submitted: ${websiteProject.businessName || activeSubscription.name}`,
            data: {
              customerEmail: session.user.email,
              firstName: "team",
              subscriptionName: activeSubscription.name,
              primaryCtaText: "Open website projects",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/website-projects`,
            },
            idempotencyKey: `website-onboarding:${savedSubmission.id}:notification`,
          }).catch((error) => console.error("Website onboarding notification failed:", error));
        }

        await recordAudit({
          actorUserId: session.user.id,
          action: "website_onboarding.submitted",
          entityType: "onboarding_submission",
          entityId: savedSubmission.id,
          message: `Website onboarding submitted for ${activeSubscription.name}`,
          metadata: { subscriptionId: activeSubscription.id, websiteId: websiteProject.id },
        });

        return json({
          submission: savedSubmission,
          website: {
            ...websiteProject,
            onboardingAnswers: safeJsonParse(websiteProject.onboardingAnswers),
            provisioningPlan: safeJsonParse(websiteProject.provisioningPlan),
          },
        }, 201);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/user/onboarding")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "GET") {
        const subscriptionId = url.searchParams.get("subscriptionId");
        const rows = subscriptionId
          ? await db.query.onboardingSubmission.findMany({
              where: eq(onboardingSubmission.subscriptionId, subscriptionId),
              orderBy: (onboardingSubmission, { desc }) => [desc(onboardingSubmission.createdAt)],
            })
          : await db.query.onboardingSubmission.findMany({
              where: eq(onboardingSubmission.userId, session.user.id),
              orderBy: (onboardingSubmission, { desc }) => [desc(onboardingSubmission.createdAt)],
            });
        return json(rows.filter((row) => row.userId === session.user.id));
      }

      if (request.method === "POST") {
        try {
          const body = await parseBody(
            request,
            z.object({
              subscriptionId: z.string().min(1),
              answers: z.record(z.unknown()),
            }),
          );

          const activeSubscription = await db.query.subscription.findFirst({
            where: eq(subscription.id, body.subscriptionId),
            with: { plan: { with: { service: true, features: true } }, bundle: { with: { features: true } } },
          });

          if (!activeSubscription || activeSubscription.userId !== session.user.id) {
            return json({ error: "Subscription not found" }, 404);
          }

          if (activeSubscription.status !== "active") {
            return json({ error: "Payment must be confirmed before onboarding can be submitted" }, 402);
          }

          const productType = activeSubscription.planId ? "plan" : "bundle";
          const productId = activeSubscription.planId ?? activeSubscription.bundleId ?? activeSubscription.id;
          const existing = await db.query.onboardingSubmission.findFirst({
            where: eq(onboardingSubmission.subscriptionId, activeSubscription.id),
          });
          const answersJson = JSON.stringify(body.answers);
          const submittedAt = new Date();
          const submissionId = existing?.id ?? makeId("onboard");

          const submissionValues = {
            userId: session.user.id,
            subscriptionId: activeSubscription.id,
            productType,
            productId,
            status: "submitted",
            answers: answersJson,
            submittedAt,
            updatedAt: new Date(),
          };

          const [savedSubmission] = existing
            ? await db.update(onboardingSubmission).set(submissionValues).where(eq(onboardingSubmission.id, existing.id)).returning()
            : await db.insert(onboardingSubmission).values({
                id: submissionId,
                ...submissionValues,
              }).returning();

          const workflowPayload = {
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            subscription: activeSubscription,
            product: activeSubscription.plan
              ? {
                  type: "plan",
                  id: activeSubscription.plan.id,
                  name: activeSubscription.plan.name,
                  service: activeSubscription.plan.service,
                  features: activeSubscription.plan.features,
                }
              : {
                  type: "bundle",
                  id: activeSubscription.bundle?.id ?? activeSubscription.bundleId,
                  name: activeSubscription.bundle?.name ?? activeSubscription.name,
                  features: activeSubscription.bundle?.features ?? [],
                },
            onboarding: {
              id: savedSubmission.id,
              answers: body.answers,
              submittedAt: submittedAt.toISOString(),
            },
          };
          const settings = await getWorkspaceSettings();
          const adminEmail = settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;

          try {
            const n8nResponse = await sendN8nWorkflow({
              event: "onboarding.submitted",
              data: workflowPayload,
              idempotencyKey: `onboarding:${savedSubmission.id}:${activeSubscription.id}`,
            });
            const [sentSubmission] = await db.update(onboardingSubmission).set({
              status: "sent_to_n8n",
              n8nResponse: JSON.stringify(n8nResponse),
              updatedAt: new Date(),
            }).where(eq(onboardingSubmission.id, savedSubmission.id)).returning();

            await recordAudit({
              actorUserId: session.user.id,
              action: "onboarding.submitted",
              entityType: "onboarding_submission",
              entityId: sentSubmission.id,
              message: `Onboarding submitted for ${activeSubscription.name}`,
              metadata: { subscriptionId: activeSubscription.id, n8n: "sent" },
            });

            if (adminEmail) {
              sendEmail({
                template: "onboarding_received",
                to: adminEmail,
                subject: `Onboarding submitted: ${activeSubscription.name}`,
                data: {
                  customerEmail: session.user.email,
                  firstName: "team",
                  subscriptionName: activeSubscription.name,
                  primaryCtaText: "Review onboarding",
                  primaryCtaUrl: `${new URL(request.url).origin}/dashboard/crm`,
                },
                idempotencyKey: `onboarding:${savedSubmission.id}:notification`,
              }).catch((error) => console.error("Onboarding notification failed:", error));
            }

            return json({ submission: sentSubmission, n8nStatus: "sent" }, 201);
          } catch (n8nError: any) {
            const [failedSubmission] = await db.update(onboardingSubmission).set({
              status: "n8n_failed",
              n8nResponse: n8nError.message,
              updatedAt: new Date(),
            }).where(eq(onboardingSubmission.id, savedSubmission.id)).returning();

            await recordAudit({
              actorUserId: session.user.id,
              action: "onboarding.n8n_failed",
              entityType: "onboarding_submission",
              entityId: failedSubmission.id,
              message: `Onboarding saved but n8n failed for ${activeSubscription.name}`,
              level: "error",
              metadata: { subscriptionId: activeSubscription.id, error: n8nError.message },
            });

            return json({ submission: failedSubmission, n8nStatus: "failed", error: n8nError.message }, 202);
          }
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/user/agents")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, agentSchema.omit({ userId: true }));
          const [created] = await db.insert(aiAgent).values({
            id: makeId("agent"),
            userId: session.user.id,
            ...body,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "agent.created",
            entityType: "ai_agent",
            entityId: created.id,
            message: `AI agent created: ${created.name}`,
          });

          try {
            const n8nResponse = await sendN8nAgentProvisioning({
              agent: created,
              user: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
              },
              idempotencyKey: `agent:${created.id}`,
            });
            await recordAudit({
              actorUserId: session.user.id,
              action: "agent.provisioning.sent",
              entityType: "ai_agent",
              entityId: created.id,
              message: `Agent provisioning workflow accepted ${created.name}`,
              metadata: { n8n: n8nResponse },
            });
            return json({ agent: created, n8nStatus: "sent", n8nResponse }, 201);
          } catch (n8nError: any) {
            await recordAudit({
              actorUserId: session.user.id,
              action: "agent.provisioning_failed",
              entityType: "ai_agent",
              entityId: created.id,
              message: `Agent created but provisioning workflow failed for ${created.name}`,
              level: "error",
              metadata: { error: n8nError.message },
            });
            return json({ agent: created, n8nStatus: "failed", error: n8nError.message }, 202);
          }
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.aiAgent.findMany({
        where: eq(aiAgent.userId, session.user.id),
        orderBy: (aiAgent, { desc }) => [desc(aiAgent.createdAt)],
      });
      const discovered = await getDetectedAgentRows(session.user.id, false);
      return json([...rows, ...discovered]);
    }

    if (url.pathname.startsWith("/api/user/support-chat")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      const uploadMatch = url.pathname.match(/^\/api\/user\/support-chat\/uploads\/([^/]+)$/);
      if (uploadMatch && request.method === "GET") {
        const attachmentId = decodeURIComponent(uploadMatch[1]);
        const attachment = await db.query.supportChatAttachment.findFirst({
          where: eq(supportChatAttachment.id, attachmentId),
        });
        if (!attachment || attachment.userId !== session.user.id) return json({ error: "Attachment not found" }, 404);
        const fileStat = await stat(attachment.storagePath).catch(() => null);
        if (!fileStat?.isFile()) return json({ error: "Attachment file not found" }, 404);
        return new Response(await readFile(attachment.storagePath), {
          headers: {
            "Content-Type": attachment.mimeType,
            "Content-Length": String(attachment.sizeBytes),
            "Content-Disposition": `inline; filename="${sanitizeFileName(attachment.fileName)}"`,
          },
        });
      }

      if (url.pathname === "/api/user/support-chat/uploads" && request.method === "POST") {
        try {
          const formData = await request.formData();
          const requestedSessionId = typeof formData.get("sessionId") === "string" ? String(formData.get("sessionId")) : null;
          let chatSession = requestedSessionId
            ? await db.query.supportChatSession.findFirst({ where: eq(supportChatSession.id, requestedSessionId) })
            : null;
          if (chatSession && chatSession.userId !== session.user.id) return json({ error: "Chat session not found" }, 404);
          if (!chatSession) {
            [chatSession] = await db.insert(supportChatSession).values({
              id: makeId("chatsession"),
              userId: session.user.id,
              status: "open",
            }).returning();
          }

          const rawFiles = [...formData.getAll("files"), ...formData.getAll("file")];
          const files = rawFiles.filter((file): file is File => file instanceof File);
          if (!files.length) return json({ error: "No files uploaded" }, 400);
          if (files.length > 4) return json({ error: "Upload up to 4 files at a time" }, 400);

          await mkdir(CHAT_UPLOAD_DIR, { recursive: true });
          const saved = [];
          for (const file of files) {
            const kind = getAttachmentKind(file.type);
            if (!kind) return json({ error: `Unsupported file type: ${file.type || "unknown"}` }, 400);
            if (file.size > maxBytesForAttachment(kind)) {
              return json({ error: `${kind === "image" ? "Image" : "Audio"} upload is too large` }, 413);
            }

            const attachmentId = makeId("chatatt");
            const extension = path.extname(file.name || "") || (kind === "image" ? ".bin" : ".webm");
            const storagePath = path.join(CHAT_UPLOAD_DIR, `${attachmentId}${extension}`);
            await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
            const [attachment] = await db.insert(supportChatAttachment).values({
              id: attachmentId,
              sessionId: chatSession.id,
              userId: session.user.id,
              kind,
              mimeType: file.type,
              fileName: sanitizeFileName(file.name || `${kind}${extension}`),
              sizeBytes: file.size,
              storagePath,
              metadata: JSON.stringify({ originalName: file.name || null }),
            }).returning();
            saved.push(attachmentDto(attachment));
          }

          return json({ session: chatSession, attachments: saved }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, supportChatSchema);
          let chatSession = body.sessionId
            ? await db.query.supportChatSession.findFirst({ where: eq(supportChatSession.id, body.sessionId) })
            : null;
          if (chatSession && chatSession.userId !== session.user.id) {
            return json({ error: "Chat session not found" }, 404);
          }
          if (!chatSession) {
            [chatSession] = await db.insert(supportChatSession).values({
              id: makeId("chatsession"),
              userId: session.user.id,
              status: "open",
            }).returning();
          }

          const userMessage = await db.insert(supportChatMessage).values({
            id: makeId("chatmsg"),
            sessionId: chatSession.id,
            userId: session.user.id,
            role: "user",
            body: body.message,
          }).returning();

          const [createdUserMessage] = userMessage;
          const attachments = body.attachmentIds.length
            ? await db.query.supportChatAttachment.findMany({
                where: eq(supportChatAttachment.sessionId, chatSession.id),
              })
            : [];
          const selectedAttachments = attachments.filter((attachment) =>
            body.attachmentIds.includes(attachment.id) && attachment.userId === session.user.id
          );
          if (body.attachmentIds.length !== selectedAttachments.length) {
            return json({ error: "One or more attachments were not found" }, 400);
          }
          for (const attachment of selectedAttachments) {
            await db.update(supportChatAttachment).set({
              messageId: createdUserMessage.id,
              metadata: JSON.stringify({
                ...(safeJsonParse(attachment.metadata) ?? {}),
                attachedToMessageAt: new Date().toISOString(),
              }),
            }).where(eq(supportChatAttachment.id, attachment.id));
          }

          const crmContext = await getSupportCrmContext(session.user.id);
          const ragContext = await retrieveSupportKnowledge({
            userId: session.user.id,
            message: body.message,
            context: crmContext,
          });
          let aiResult: ReturnType<typeof normalizeSupportAgentResponse>;
          const attachmentPayload = selectedAttachments.map(attachmentDto);
          try {
            aiResult = await sendN8nSupportChat({
              sessionId: chatSession.id,
              message: body.message,
              user: {
                id: session.user.id,
                name: session.user.name ?? null,
                email: session.user.email ?? null,
              },
              context: crmContext,
              ragContext,
              attachments: attachmentPayload,
              clientCapabilities: body.clientCapabilities,
              idempotencyKey: `support-chat:${chatSession.id}:${Date.now()}`,
            });
            if (aiResult.toolCalls.length) {
              const toolResults = await executeSupportToolCalls(session.user.id, aiResult.toolCalls);
              aiResult = await sendN8nSupportChat({
                sessionId: chatSession.id,
                message: body.message,
                user: {
                  id: session.user.id,
                  name: session.user.name ?? null,
                  email: session.user.email ?? null,
                },
                context: crmContext,
                ragContext,
                attachments: attachmentPayload,
                toolResults,
                clientCapabilities: body.clientCapabilities,
                event: "support.chat.tool_results",
                idempotencyKey: `support-chat-tools:${chatSession.id}:${Date.now()}`,
              });
            }
          } catch (error: any) {
            const shouldEscalate = shouldCreateEmergencyFallbackTicket(body.message);
            aiResult = {
              reply: shouldEscalate
                ? "I could not reach the AI assistant, so I have created a support ticket for the CloudMonkey team."
                : "I could not reach the AI assistant right now. You can try again in a moment or open a support ticket from the support page.",
              intent: shouldEscalate ? "support" : "general",
              createTicket: shouldEscalate,
              toolCalls: [],
              suggestedActions: shouldEscalate ? [] : [{ label: "Open support", href: "/dashboard/support" }],
              subject: body.message.slice(0, 80),
              description: body.message,
              priority: "medium",
              category: "general",
              error: error.message,
            };
          }

          const reply = String(aiResult?.reply ?? aiResult?.message ?? "I have logged this for the CloudMonkey team.");
          const shouldCreateTicket = aiResult?.createTicket === true;
          let ticket = chatSession.ticketId
            ? await db.query.supportTicket.findFirst({ where: eq(supportTicket.id, chatSession.ticketId) })
            : null;

          if (shouldCreateTicket && !ticket) {
            const subject = String(aiResult?.ticket?.subject ?? aiResult?.subject ?? body.message).slice(0, 120) || "AI support request";
            const description = String(aiResult?.ticket?.description ?? aiResult?.description ?? body.message);
            const priority = aiResult?.ticket?.priority ?? aiResult?.priority;
            const [createdTicket] = await db.insert(supportTicket).values({
              id: makeId("ticket"),
              userId: session.user.id,
              subject,
              description,
              priority: priority && ["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium",
              status: ["open", "pending", "resolved", "closed"].includes(aiResult?.status) ? aiResult.status : "open",
              category: String(aiResult?.ticket?.category ?? aiResult?.category ?? "support"),
              source: "ai_chat",
              aiSessionId: chatSession.id,
              lastCustomerMessageAt: new Date(),
            }).returning();
            ticket = createdTicket;
            await db.update(supportChatSession).set({
              ticketId: createdTicket.id,
              summary: aiResult?.summary ? String(aiResult.summary) : subject,
              updatedAt: new Date(),
            }).where(eq(supportChatSession.id, chatSession.id));
          } else if (ticket) {
            await db.update(supportTicket).set({
              lastCustomerMessageAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(supportTicket.id, ticket.id));
          }

          if (ticket && aiResult?.internalNote) {
            await db.insert(supportTicketComment).values({
              id: makeId("comment"),
              ticketId: ticket.id,
              userId: session.user.id,
              body: `[AI] ${String(aiResult.internalNote)}`,
              isInternal: true,
            });
          }

          const [assistantMessage] = await db.insert(supportChatMessage).values({
            id: makeId("chatmsg"),
            sessionId: chatSession.id,
            userId: session.user.id,
            role: "assistant",
            body: reply,
            metadata: JSON.stringify(aiResult ?? {}),
          }).returning();
          await db.update(supportChatSession).set({ updatedAt: new Date() }).where(eq(supportChatSession.id, chatSession.id));
          await storeSupportLearning({
            userId: session.user.id,
            sessionId: chatSession.id,
            ticketId: ticket?.id ?? null,
            message: body.message,
            reply,
            intent: aiResult.intent,
            summary: aiResult.summary,
            createTicket: shouldCreateTicket,
          });

          return json({
            session: await db.query.supportChatSession.findFirst({ where: eq(supportChatSession.id, chatSession.id) }),
            reply,
            ticket,
            messages: [createdUserMessage, assistantMessage],
            attachments: selectedAttachments.map(attachmentDto),
            suggestedActions: aiResult.suggestedActions,
            intent: aiResult.intent,
            audioReplyText: aiResult.audioReplyText,
          });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/user/tickets")) {
      const { session, response } = await requireSession(request);
      if (response) return response;
      const parts = url.pathname.split("/").filter(Boolean);
      const ticketId = parts[3];

      if (ticketId && parts[4] === "comments" && request.method === "POST") {
        try {
          const body = await parseBody(request, ticketCommentSchema.omit({ isInternal: true }));
          const ticket = await db.query.supportTicket.findFirst({
            where: eq(supportTicket.id, ticketId),
            with: { comments: true },
          });
          if (!ticket || ticket.userId !== session.user.id) return json({ error: "Ticket not found" }, 404);
          const [created] = await db.insert(supportTicketComment).values({
            id: makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: body.body,
            isInternal: false,
          }).returning();
          await db.update(supportTicket).set({ updatedAt: new Date() }).where(eq(supportTicket.id, ticketId));
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.comment.created",
            entityType: "support_ticket",
            entityId: ticketId,
            message: `Comment added to ticket ${ticket.subject}`,
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (ticketId && request.method === "GET") {
        const ticket = await db.query.supportTicket.findFirst({
          where: eq(supportTicket.id, ticketId),
          with: { comments: true },
        });
        if (!ticket || ticket.userId !== session.user.id) return json({ error: "Ticket not found" }, 404);
        return json({
          ...ticket,
          comments: ticket.comments.filter((comment) => !comment.isInternal),
        });
      }

      if (request.method === "POST") {
        try {
          const settings = await getWorkspaceSettings();
          if (!settings?.allowCustomerTicketCreation && !isAdmin(session)) {
            return json({ error: "Customer ticket creation is disabled" }, 403);
          }

          const body = await parseBody(request, ticketSchema.omit({ userId: true, assignedToUserId: true }));
          const [created] = await db.insert(supportTicket).values({
            id: makeId("ticket"),
            userId: session.user.id,
            ...body,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.created",
            entityType: "support_ticket",
            entityId: created.id,
            message: `Support ticket opened: ${created.subject}`,
          });
          const adminEmail = settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;
          if (adminEmail) {
            sendN8nEmail({
              template: "support_notification",
              to: adminEmail,
              subject: `New support ticket: ${created.subject}`,
              data: {
                ...created,
                firstName: "team",
                summary: `New support ticket opened: ${created.subject}`,
                body: created.description ?? created.subject,
                primaryCtaText: "Open tickets",
                primaryCtaUrl: `${new URL(request.url).origin}/dashboard/support`,
              },
              idempotencyKey: `ticket:${created.id}:created`,
            }).catch((error) => console.error("Ticket notification failed:", error));
          }
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.supportTicket.findMany({
        where: eq(supportTicket.userId, session.user.id),
        with: { comments: true },
        orderBy: (supportTicket, { desc }) => [desc(supportTicket.updatedAt)],
      });
      return json(rows.map((ticket) => ({
        ...ticket,
        comments: ticket.comments.filter((comment) => !comment.isInternal),
      })));
    }

    if (url.pathname.startsWith("/api/admin/leads")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      const leads = await db.query.lead.findMany({
        orderBy: (lead, { desc }) => [desc(lead.createdAt)],
      });
      return new Response(JSON.stringify(leads), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/admin/onboarding")) {
      const { response } = await requireAdmin(request);
      if (response) return response;

      const rows = await db.query.onboardingSubmission.findMany({
        with: { user: true, subscription: true },
        orderBy: (onboardingSubmission, { desc }) => [desc(onboardingSubmission.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/invoices")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });
      const parts = url.pathname.split("/").filter(Boolean);
      const invoiceId = parts[2];

      if (invoiceId) {
        const origin = `${url.protocol}//${url.host}`;
        const payload = await getInvoiceDocumentPayload(decodeURIComponent(invoiceId), session, origin);
        if (!payload) return json({ error: "Invoice not found" }, 404);

        if (parts[3] === "pdf") {
          try {
            const pdf = await renderInvoicePdf(payload.document);
            return new Response(pdf, {
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${payload.document.invoice.invoiceNumber}.pdf"`,
              },
            });
          } catch (error: any) {
            console.error("Invoice PDF failed:", error);
            return json({ error: error.message || "Failed to generate PDF" }, 500);
          }
        }

        return json(payload);
      }

      const userInvoices = await db.query.invoice.findMany({
        where: eq(invoice.userId, session.user.id),
        orderBy: (invoice, { desc }) => [desc(invoice.createdAt)],
      });
      return new Response(JSON.stringify(userInvoices.filter((row) => row.status !== "draft")), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/user/vultr") && request.method === "POST") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      try {
        const body = await request.json();
        const { instanceId, action } = body;

        // Verify ownership (Admin can perform actions on any resource)
        const ownership = await db.query.vultrInstance.findFirst({
          where: eq(vultrInstance.id, instanceId),
        });

        if (!ownership || (ownership.userId !== session.user.id && !isAdmin(session))) {
          return new Response("Forbidden", { status: 403 });
        }

        switch (action) {
          case "start": await startInstance(instanceId); break;
          case "stop": await stopInstance(instanceId); break;
          case "reboot": await rebootInstance(instanceId); break;
          case "reinstall": await reinstallInstance(instanceId); break;
          default: return new Response("Invalid action", { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: "Action failed" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/user/vultr")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      const instances = await getServersWithTelemetry(session.user.id, isAdmin(session));
      return new Response(JSON.stringify(instances), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/user/domain-orders")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "GET") {
        const rows = await db.query.domainOrder.findMany({
          where: eq(domainOrder.userId, session.user.id),
          with: { invoice: true, subscription: true, plan: true },
          orderBy: (domainOrder, { desc }) => [desc(domainOrder.createdAt)],
        });
        return json(rows);
      }

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, domainOrderSchema);
          const domainName = body.domainName.trim().toLowerCase();
          const email = session.user.email ?? "";
          if (!email) return json({ error: "User email is required for checkout" }, 400);

          const domainPlan = await db.query.servicePlan.findFirst({
            where: eq(servicePlan.id, body.domainPlanId),
            with: { service: true },
          });
          if (!domainPlan || domainPlan.service?.id !== "domains") {
            return json({ error: "Valid domain plan is required" }, 400);
          }

          const addonPlans = [];
          for (const planId of body.addonPlanIds ?? []) {
            const plan = await db.query.servicePlan.findFirst({
              where: eq(servicePlan.id, planId),
              with: { service: true },
            });
            if (plan) addonPlans.push(plan);
          }

          const domainAmount = parseInt(domainPlan.priceZar ?? "0", 10);
          const addonAmount = addonPlans.reduce((total, plan) => total + parseInt(plan.priceZar ?? "0", 10), 0);
          const amount = domainAmount + addonAmount;
          if (amount <= 0) return json({ error: "Domain checkout requires a payable price" }, 400);

          const invoiceId = makeId("inv");
          const subscriptionId = invoiceId;
          const orderId = makeId("domainorder");
          const issuedAt = new Date();
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);
          const billingPeriodEnd = new Date(issuedAt);
          billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
          const settings = await getWorkspaceSettings();
          const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId.replace(/^inv[_-]?/i, "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
          const name = `Domain registration: ${domainName}`;
          const callbackUrl = `${new URL(request.url).origin}/dashboard/domains/new?payment=return&subscription=${encodeURIComponent(subscriptionId)}&domainOrder=${encodeURIComponent(orderId)}`;

          await db.transaction(async (tx) => {
            await tx.insert(invoice).values({
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
              workspaceBillingSnapshot: JSON.stringify(getWorkspaceBillingDetails(settings)),
              notes: settings?.billingInvoiceNotes ?? null,
            });
            await tx.insert(subscription).values({
              id: subscriptionId,
              userId: session.user.id,
              planId: domainPlan.id,
              name,
              status: "pending",
              amount,
              interval: "year",
              currentPeriodStart: issuedAt,
              currentPeriodEnd: billingPeriodEnd,
            });
            await tx.insert(invoiceItem).values({
              id: makeId("invitem"),
              invoiceId,
              description: `${domainName} - ${domainPlan.name}`,
              quantity: 1,
              unitPrice: domainAmount,
              amount: domainAmount,
            });
            for (const plan of addonPlans) {
              const planAmount = parseInt(plan.priceZar ?? "0", 10);
              await tx.insert(invoiceItem).values({
                id: makeId("invitem"),
                invoiceId,
                description: `${plan.service?.name ?? "Service"} - ${plan.name}`,
                quantity: 1,
                unitPrice: planAmount,
                amount: planAmount,
              });
            }
            await tx.insert(domainOrder).values({
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

          let payment: Awaited<ReturnType<typeof initializePayment>>;
          try {
            payment = await initializePayment({
              email,
              amountCents: amount,
              invoiceId,
              subscriptionId,
              userId: session.user.id,
              planId: domainPlan.id,
              callbackUrl,
            });
          } catch (error) {
            await db.update(invoice).set({ status: "cancelled", updatedAt: new Date() }).where(eq(invoice.id, invoiceId));
            await db.update(subscription).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscription.id, subscriptionId));
            await db.update(domainOrder).set({ status: "cancelled", updatedAt: new Date() }).where(eq(domainOrder.id, orderId));
            throw error;
          }

          const [updatedInvoice] = await db.update(invoice).set({
            paystackReference: payment.data.reference,
            paystackUrl: payment.data.authorization_url,
            updatedAt: new Date(),
          }).where(eq(invoice.id, invoiceId)).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "domain_order.checkout.started",
            entityType: "domain_order",
            entityId: orderId,
            message: `Domain checkout started for ${domainName}`,
            metadata: { invoiceId, reference: payment.data.reference, addonPlanIds: addonPlans.map((plan) => plan.id) },
          });

          sendEmail({
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
              totalDue: formatEmailMoney(updatedInvoice.amount, updatedInvoice.currency ?? "ZAR"),
              dueDate: formatEmailDate(updatedInvoice.dueDate),
              primaryCtaText: "View invoice",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`,
            },
            idempotencyKey: `domain-order:${orderId}:invoice`,
          }).catch((error) => console.error("Domain invoice email failed:", error));

          return json({
            order: await db.query.domainOrder.findFirst({ where: eq(domainOrder.id, orderId) }),
            invoice: updatedInvoice,
            subscriptionId,
            authorization_url: payment.data.authorization_url,
            access_code: payment.data.access_code,
            reference: payment.data.reference,
          }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/user/domains/dns")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      const domainName = url.searchParams.get("domain");
      if (!domainName) return new Response("Domain required", { status: 400 });

      // Verify ownership
      const ownership = await db.query.registeredDomain.findFirst({
        where: eq(registeredDomain.id, domainName),
      });

      if (!ownership || (ownership.userId !== session.user.id && !isAdmin(session))) {
        return new Response("Forbidden", { status: 403 });
      }

      const parts = domainName.split(".");
      const sld = parts[0];
      const tld = parts.slice(1).join(".");
      const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;

      if (request.method === "GET") {
        try {
          const response = await fetch(`https://api.domains.co.za/api/domain/dns?sld=${sld}&tld=${tld}&key=${apiKey}`);
          const data = await response.json();
          return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Failed to fetch DNS" }), { status: 500 });
        }
      }

      if (request.method === "POST") {
        try {
          const body = await request.json();
          const response = await fetch(`https://api.domains.co.za/api/domain/dns/entry?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sld, tld, ...body }),
          });
          const data = await response.json();
          return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Failed to add record" }), { status: 500 });
        }
      }

      if (request.method === "DELETE") {
        const dnsId = url.searchParams.get("dnsId");
        try {
          const response = await fetch(`https://api.domains.co.za/api/domain/dns/entry?sld=${sld}&tld=${tld}&dnsId=${dnsId}&key=${apiKey}`, {
            method: "DELETE",
          });
          const data = await response.json();
          return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Failed to delete record" }), { status: 500 });
        }
      }
    }

    if (url.pathname.startsWith("/api/user/domains/info")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      const domainName = url.searchParams.get("domain");
      if (!domainName) return new Response("Domain required", { status: 400 });

      // Verify ownership
      const ownership = await db.query.registeredDomain.findFirst({
        where: eq(registeredDomain.id, domainName),
      });

      if (!ownership || (ownership.userId !== session.user.id && !isAdmin(session))) {
        return new Response("Forbidden", { status: 403 });
      }

      const parts = domainName.split(".");
      const sld = parts[0];
      const tld = parts.slice(1).join(".");
      const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;

      try {
        const response = await fetch(`https://api.domains.co.za/api/domain/info?sld=${sld}&tld=${tld}&key=${apiKey}`);
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch domain info" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/user/domains")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });

      const domains = await db.query.registeredDomain.findMany({
        where: eq(registeredDomain.userId, session.user.id),
      });
      return new Response(JSON.stringify(domains), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/user/websites/")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      const parts = url.pathname.split("/").filter(Boolean);
      const websiteId = parts[3];
      const subresource = parts[4];
      if (!websiteId) return json({ error: "Website id is required" }, 400);

      if (request.method === "GET" && !subresource) {
        const detail = await getUserWebsiteDetail(session.user.id, websiteId);
        if (!detail) return json({ error: "Website not found" }, 404);
        return json(detail);
      }

      if (subresource === "design-options" && parts[5] === "generate" && request.method === "POST") {
        try {
          const detail = await getUserWebsiteDetail(session.user.id, websiteId);
          if (!detail?.store) return json({ error: "Website store not found" }, 404);

          await db.update(website).set({
            aiGenerationStatus: "design_generating",
            updatedAt: new Date(),
          }).where(eq(website.id, websiteId));

          const n8nResult = await sendN8nWebsiteDesignPreviews({
            website: {
              id: detail.id,
              siteType: detail.siteType,
              businessName: detail.businessName,
              name: detail.name,
              industry: detail.industry,
              domain: detail.domain,
              temporaryDomain: detail.temporaryDomain,
              status: detail.status,
            },
            onboardingAnswers: detail.onboardingAnswers,
            provisioningPlan: detail.provisioningPlan,
            generationContext: getWebsiteDesignGenerationContext(detail.siteType),
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            idempotencyKey: `website-design-${websiteId}-${Date.now()}`,
          });

          const options = Array.isArray((n8nResult as any).options) ? (n8nResult as any).options.slice(0, 4) : [];
          if (!options.length) throw new Error("No design options were returned");

          await db.delete(websiteDesignOption).where(eq(websiteDesignOption.websiteId, websiteId));
          const saved = await db.insert(websiteDesignOption).values(options.map((option: any, index: number) => ({
            id: makeId("design"),
            websiteId,
            userId: session.user.id,
            styleLabel: String(option.styleLabel || `Concept ${index + 1}`),
            imageUrl: option.imageUrl || null,
            thumbnailUrl: option.thumbnailUrl || option.imageUrl || null,
            designManifest: JSON.stringify(option.designManifest || option),
            promptVersion: String((n8nResult as any).workflow || "cloudmonkey-website-design-previews"),
            tokenCost: Number(option.tokenCost || 0),
            imageCost: Number(option.imageCost || 0),
          }))).returning();

          const [updatedSite] = await db.update(website).set({
            aiGenerationStatus: "awaiting_design_selection",
            status: "awaiting_design_selection",
            updatedAt: new Date(),
          }).where(eq(website.id, websiteId)).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "website.design_options.generated",
            entityType: "website",
            entityId: websiteId,
            message: `Design previews generated for ${detail.businessName || detail.domain}`,
            metadata: { workflow: (n8nResult as any).workflow, optionCount: saved.length },
          });

          return json({
            website: updatedSite,
            n8n: { ok: (n8nResult as any).ok ?? true, workflow: (n8nResult as any).workflow },
            designOptions: saved.map((option) => ({
              ...option,
              designManifest: safeJsonParse(option.designManifest),
            })),
          });
        } catch (error: any) {
          await db.update(website).set({
            aiGenerationStatus: "failed",
            updatedAt: new Date(),
          }).where(eq(website.id, websiteId));
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (subresource === "design-options" && parts[6] === "select" && request.method === "POST") {
        try {
          const designOptionId = parts[5];
          if (!designOptionId) return json({ error: "Design option id is required" }, 400);

          const detail = await getUserWebsiteDetail(session.user.id, websiteId);
          if (!detail?.store) return json({ error: "Website store not found" }, 404);

          const selectedOption = await db.query.websiteDesignOption.findFirst({
            where: eq(websiteDesignOption.id, designOptionId),
          });
          if (!selectedOption || selectedOption.websiteId !== websiteId || selectedOption.userId !== session.user.id) {
            return json({ error: "Design option not found" }, 404);
          }

          const selectedAt = new Date();
          const designManifest = safeJsonParse(selectedOption.designManifest) ?? {};
          const buildManifest = {
            websiteId,
            selectedDesignOptionId: designOptionId,
            styleLabel: selectedOption.styleLabel,
            designManifest,
            siteType: detail.siteType,
            businessName: detail.businessName,
            temporaryDomain: detail.temporaryDomain,
            baseRepo: detail.siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template",
            createdAt: selectedAt.toISOString(),
          };

          await db.update(websiteDesignOption)
            .set({ selectedAt: null })
            .where(eq(websiteDesignOption.websiteId, websiteId));
          const [updatedOption] = await db.update(websiteDesignOption)
            .set({ selectedAt })
            .where(eq(websiteDesignOption.id, designOptionId))
            .returning();
          const [updatedSite] = await db.update(website).set({
            selectedDesignOptionId: designOptionId,
            buildManifest: JSON.stringify(buildManifest),
            baseRepo: buildManifest.baseRepo,
            aiGenerationStatus: "design_selected",
            status: "design_selected",
            updatedAt: selectedAt,
          }).where(eq(website.id, websiteId)).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "website.design_option.selected",
            entityType: "website",
            entityId: websiteId,
            message: `Design option selected for ${detail.businessName || detail.domain}`,
            metadata: { designOptionId, styleLabel: selectedOption.styleLabel },
          });

          return json({
            website: {
              ...updatedSite,
              buildManifest,
            },
            designOption: {
              ...updatedOption,
              designManifest,
            },
          });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (subresource === "provision" && request.method === "POST") {
        return json({ error: "CloudMonkey admins provision managed website runtimes after design approval" }, 403);
      }

      if (subresource === "products" && request.method === "POST") {
        try {
          const detail = await getUserWebsiteDetail(session.user.id, websiteId);
          if (!detail?.store) return json({ error: "Website store not found" }, 404);
          if (detail.siteType !== "ecommerce") return json({ error: "Products are only available for ecommerce stores" }, 400);

          const body = await parseBody(request, storeProductCreateSchema);
          if (detail.containerStatus === "running" && detail.temporaryDomain) {
            const created = await createMedusaProductForWebsite(detail as typeof website.$inferSelect, body);
            await recordAudit({
              actorUserId: session.user.id,
              action: "store.medusa_product.created",
              entityType: "website",
              entityId: websiteId,
              message: `${body.title} added to ${detail.businessName || detail.domain} through Medusa`,
              metadata: { websiteId, storeId: detail.store.id, engine: "medusa" },
            });
            return json(created, 201);
          }

          const productId = makeId("storeprod");
          const slug = `${slugifySiteName(body.title)}-${crypto.randomBytes(2).toString("hex")}`;
          const priceCents = Math.round(body.price * 100);

          const [createdProduct] = await db.insert(storeProduct).values({
            id: productId,
            storeId: detail.store.id,
            userId: session.user.id,
            title: body.title,
            slug,
            description: body.description,
            sku: body.sku || null,
            status: body.status,
            price: priceCents,
            trackInventory: body.trackInventory,
          }).returning();

          const [createdVariant] = await db.insert(storeProductVariant).values({
            id: makeId("storevar"),
            productId,
            storeId: detail.store.id,
            sku: body.sku || null,
            title: "Default",
            price: priceCents,
            inventoryQuantity: body.inventoryQuantity,
            status: body.status === "archived" ? "archived" : "active",
          }).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "store.product.created",
            entityType: "store_product",
            entityId: productId,
            message: `${body.title} added to ${detail.businessName || detail.domain}`,
            metadata: { websiteId, storeId: detail.store.id },
          });

          return json({ ...createdProduct, variants: [createdVariant] }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/user/websites") {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, userWebsiteCreateSchema);
          const now = new Date();
          const trialEndsAt = addDays(now, 7);
          const graceEndsAt = addDays(trialEndsAt, 30);
          const baseSlug = slugifySiteName(body.preferredSlug || body.businessName);
          const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
          const temporaryDomain = `${slug}.cloudmonkey.co.za`;
          const websiteId = makeId("web");
          const storeId = makeId("store");
          const onboardingAnswers = {
            businessName: body.businessName,
            businessDescription: body.businessDescription,
            industry: body.industry,
            targetCustomers: body.targetCustomers,
            whatsapp: body.whatsapp,
            email: body.email || null,
            productCount: body.productCount,
            needsInventory: body.needsInventory,
            needsDelivery: body.needsDelivery,
            needsPos: body.needsPos,
          };
          const databaseRecord = body.siteType === "ecommerce"
            ? buildStoreDatabaseRecord({
                websiteId,
                storeId,
                userId: session.user.id,
              })
            : null;
          const provisioningPlan = buildWebsiteProvisioningPlan({
            websiteId,
            storeId,
            temporaryDomain,
            siteType: body.siteType,
            database: databaseRecord ?? undefined,
          });
          const baseRepo = body.siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template";

          const [createdWebsite] = await db.insert(website).values({
            id: websiteId,
            userId: session.user.id,
            domain: temporaryDomain,
            plan: "trial",
            status: "onboarding",
            siteType: body.siteType,
            name: body.businessName,
            businessName: body.businessName,
            businessDescription: body.businessDescription,
            industry: body.industry,
            temporaryDomain,
            primaryDomain: temporaryDomain,
            onboardingAnswers: JSON.stringify(onboardingAnswers),
            provisioningPlan: JSON.stringify(provisioningPlan),
            aiGenerationStatus: "not_started",
            containerStatus: "not_provisioned",
            baseRepo,
            trialStartedAt: now,
            trialEndsAt,
            graceEndsAt,
            terminationScheduledAt: graceEndsAt,
          }).returning();

          const [createdStore] = await db.insert(websiteStore).values({
            id: storeId,
            websiteId,
            userId: session.user.id,
            name: body.businessName,
            siteType: body.siteType,
            status: "trial",
            paymentMode: "cloudmonkey_gateway",
            trialStartedAt: now,
            trialEndsAt,
            terminationScheduledAt: graceEndsAt,
          }).returning();

          const [createdDatabase] = databaseRecord
            ? await db.insert(websiteStoreDatabase).values(databaseRecord).returning()
            : [null];
          const [createdDomain] = await db.insert(websiteDomain).values({
            id: makeId("webdomain"),
            websiteId,
            userId: session.user.id,
            domain: temporaryDomain,
            type: "temporary",
            status: "reserved",
            dnsTarget: "wildcard.cloudmonkey.co.za",
            sslStatus: "pending",
            isPrimary: true,
          }).returning();

          if (body.siteType === "ecommerce") {
            await db.insert(websitePluginInstall).values([
              {
                id: makeId("webplugin"),
                websiteId,
                storeId,
                userId: session.user.id,
                pluginKey: "cloudmonkey-paystack-gateway",
                status: "planned",
                config: JSON.stringify({ transactionFeeBps: 700, currency: "ZAR" }),
              },
              {
                id: makeId("webplugin"),
                websiteId,
                storeId,
                userId: session.user.id,
                pluginKey: "basic-seo",
                status: "planned",
                config: JSON.stringify({ sitemap: true, robots: true }),
              },
            ]);
          }

          await recordAudit({
            actorUserId: session.user.id,
            action: "website.created",
            entityType: "website",
            entityId: websiteId,
            message: `${body.businessName} ${body.siteType === "ecommerce" ? "ecommerce runtime created with dedicated SQL container" : "static website runtime created"}`,
            metadata: {
              siteType: body.siteType,
              temporaryDomain,
              databaseContainer: databaseRecord?.containerName ?? null,
            },
          });

          return json({
            ...createdWebsite,
            onboardingAnswers,
            provisioningPlan,
            store: {
              ...createdStore,
              database: createdDatabase ? {
                id: createdDatabase.id,
                engine: createdDatabase.engine,
                version: createdDatabase.version,
                host: createdDatabase.host,
                port: createdDatabase.port,
                databaseName: createdDatabase.databaseName,
                username: createdDatabase.username,
                containerName: createdDatabase.containerName,
                volumeName: createdDatabase.volumeName,
                status: createdDatabase.status,
                backupStatus: createdDatabase.backupStatus,
              } : null,
            },
            domains: [createdDomain],
            plugins: body.siteType === "ecommerce" ? [
              { pluginKey: "cloudmonkey-paystack-gateway", status: "planned" },
              { pluginKey: "basic-seo", status: "planned" },
            ] : [],
          }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, 405);
      }

      return json(await getUserWebsiteDashboardRows(session.user.id));
    }

    if (url.pathname.startsWith("/api/webhooks/paystack")) {
      return handlePaystackWebhook(request);
    }

    if (url.pathname.startsWith("/api/domains/check")) {
      return handleDomainsCheck(request);
    }

    if (url.pathname.startsWith("/api/admin/server-agents/enrollment") && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      try {
        const body = await parseBody(request, agentEnrollmentRequestSchema);
        const instance = await db.query.vultrInstance.findFirst({
          where: eq(vultrInstance.id, body.instanceId),
        });
        if (!instance) return json({ error: "CloudMonkey VPS server is not assigned in CloudMonkey" }, 404);

        const enrollmentToken = `cm_enroll_${crypto.randomBytes(32).toString("base64url")}`;
        const existingAgent = await db.query.serverAgent.findFirst({
          where: eq(serverAgent.instanceId, instance.id),
          orderBy: (serverAgent, { desc }) => [desc(serverAgent.createdAt)],
        });
        const agentId = existingAgent?.id ?? makeId("agent");
        const [agent] = await db.insert(serverAgent).values({
          id: agentId,
          instanceId: instance.id,
          userId: instance.userId,
          name: body.name ?? instance.label ?? instance.id,
          status: "pending",
          enrollmentTokenHash: sha256(enrollmentToken),
          config: JSON.stringify(getAgentConfig()),
        }).onConflictDoUpdate({
          target: serverAgent.id,
          set: {
            enrollmentTokenHash: sha256(enrollmentToken),
            status: "pending",
            updatedAt: new Date(),
          },
        }).returning();

        await recordAudit({
          actorUserId: session.user.id,
          action: "server_agent.enrollment_created",
          entityType: "server_agent",
          entityId: agent.id,
          message: `Server agent enrollment token created for ${instance.label || instance.id}`,
          metadata: { instanceId: instance.id },
        });

        const installCommand = `curl -fsSL https://cloudmonkey.co.za/install-agent.sh | sudo CM_ENROLLMENT_TOKEN='${enrollmentToken}' bash`;
        return json({
          agent,
          enrollmentToken,
          installCommand,
          expiresHint: "Token is one-time use. Regenerate if it is exposed before enrollment.",
        }, 201);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/admin/platform-matrix")) {
      const { response } = await requireAdmin(request);
      if (response) return response;

      const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
      const [usersResult, localDomainsResult, localServersResult, localAgentsResult, providerDomainsResult, vultrInstancesResult, vultrPlansResult] = await Promise.allSettled([
        db.query.user.findMany(),
        db.query.registeredDomain.findMany(),
        db.query.vultrInstance.findMany(),
        db.query.serverAgent.findMany(),
        apiKey
          ? fetch(`https://api.domains.co.za/api/domain/list?key=${apiKey}`).then(async (providerResponse) => {
              if (!providerResponse.ok) {
                throw new Error(`Domains API returned ${providerResponse.status}`);
              }
              return providerResponse.json();
            })
          : Promise.reject(new Error("Domains API key is not configured")),
        listInstances(),
        listPlans(),
      ]);

      const users = usersResult.status === "fulfilled" ? usersResult.value : [];
      const localDomains = localDomainsResult.status === "fulfilled" ? localDomainsResult.value : [];
      const localServers = localServersResult.status === "fulfilled" ? localServersResult.value : [];
      const localAgents = localAgentsResult.status === "fulfilled" ? localAgentsResult.value : [];
      const providerDomains = providerDomainsResult.status === "fulfilled"
        ? normalizeProviderDomains(providerDomainsResult.value)
        : [];
      const vultrInstances = vultrInstancesResult.status === "fulfilled" ? vultrInstancesResult.value : [];
      const vultrPlans = vultrPlansResult.status === "fulfilled" ? vultrPlansResult.value : [];

      const localDomainMap = getAssignedUserMap(localDomains, (row) => row.id.toLowerCase());
      const localServerMap = getAssignedUserMap(localServers, (row) => row.id);
      const localAgentMap = new Map(localAgents.map((row) => [row.instanceId, row]));
      const userMap = new Map(users.map((row) => [row.id, row]));
      const seenProviderDomains = new Set(providerDomains.map((row) => row.domainName.toLowerCase()));

      const domains = [
        ...providerDomains.map((domainRow) => {
          const assignment = localDomainMap.get(domainRow.domainName.toLowerCase());
          return {
            ...domainRow,
            source: "domains.co.za",
            assignment,
            user: assignment ? userMap.get(assignment.userId) ?? null : null,
          };
        }),
        ...localDomains
          .filter((domainRow) => !seenProviderDomains.has(domainRow.id.toLowerCase()))
          .map((domainRow) => ({
            domainName: domainRow.id,
            status: domainRow.status,
            expiryDate: domainRow.expiryDate?.toISOString() ?? null,
            source: "cloudmonkey",
            raw: null,
            assignment: domainRow,
            user: userMap.get(domainRow.userId) ?? null,
          })),
      ].sort((a, b) => a.domainName.localeCompare(b.domainName));

      const servers = vultrInstances.map((instance) => {
        const assignment = localServerMap.get(instance.id);
        return {
          ...instance,
          assignment,
          user: assignment ? userMap.get(assignment.userId) ?? null : null,
          agent: localAgentMap.get(instance.id) ?? null,
        };
      });

      return json({
        users,
        domains,
        servers,
        vultrPlans,
        localDomains,
        localServers,
        errors: {
          users: usersResult.status === "rejected" ? usersResult.reason.message : null,
          localDomains: localDomainsResult.status === "rejected" ? localDomainsResult.reason.message : null,
          localServers: localServersResult.status === "rejected" ? localServersResult.reason.message : null,
          localAgents: localAgentsResult.status === "rejected" ? localAgentsResult.reason.message : null,
          domainsProvider: providerDomainsResult.status === "rejected" ? providerDomainsResult.reason.message : null,
          vultrInstances: vultrInstancesResult.status === "rejected" ? vultrInstancesResult.reason.message : null,
          vultrPlans: vultrPlansResult.status === "rejected" ? vultrPlansResult.reason.message : null,
        },
      });
    }

    if (url.pathname.startsWith("/api/admin/affiliates/payouts") && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      try {
        const body = await parseBody(request, payoutMarkPaidSchema);
        const rows = await db.query.affiliateCommission.findMany({
          where: eq(affiliateCommission.affiliateId, body.affiliateId),
        });
        const selected = rows.filter((row) => body.commissionIds.includes(row.id) && ["approved", "payable"].includes(row.status));
        if (selected.length !== body.commissionIds.length) return json({ error: "Only approved or payable commissions can be paid" }, 400);
        const totalAmount = selected.reduce((sum, row) => sum + row.commissionAmount, 0);
        if (totalAmount < 25000) return json({ error: "Payout total is below the R250 minimum threshold" }, 400);

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [payout] = await db.insert(affiliatePayout).values({
          id: makeId("affpay"),
          affiliateId: body.affiliateId,
          payoutPeriodStart: periodStart,
          payoutPeriodEnd: now,
          totalAmount,
          payoutReference: body.payoutReference ?? null,
          status: "paid",
          paidAt: now,
          adminId: session.user.id,
          notes: body.notes ?? null,
        }).returning();

        for (const commissionRow of selected) {
          await db.update(affiliateCommission).set({
            status: "paid",
            paidAt: now,
            updatedAt: now,
            adminNotes: body.notes ?? commissionRow.adminNotes,
          }).where(eq(affiliateCommission.id, commissionRow.id));
        }

        await recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.payout.paid",
          entityType: "affiliate_payout",
          entityId: payout.id,
          message: `Affiliate payout marked paid for ${formatEmailMoney(totalAmount)}`,
          metadata: { affiliateId: body.affiliateId, commissionIds: body.commissionIds },
        });

        return json({ payout });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/admin/affiliates/manual-attribution") && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      try {
        const body = await parseBody(request, manualAttributionSchema);
        const [affiliateRow, customer] = await Promise.all([
          db.query.affiliate.findFirst({ where: eq(affiliate.id, body.affiliateId) }),
          db.query.user.findFirst({ where: eq(user.id, body.customerId) }),
        ]);
        if (!affiliateRow) return json({ error: "Affiliate not found" }, 404);
        if (!customer) return json({ error: "Customer not found" }, 404);
        const rule = getAffiliateTierRule(affiliateRow.tier);
        const [referral] = await db.insert(affiliateReferral).values({
          id: makeId("affref"),
          affiliateId: affiliateRow.id,
          referralCode: affiliateRow.referralCode,
          customerId: customer.id,
          attributionType: "manual",
          attributionModel: "manual_admin",
          status: "signup",
          signedUpAt: new Date(),
          tierAtSignup: affiliateRow.tier,
          commissionTypeAtSignup: affiliateRow.commissionType ?? rule.commissionType,
          commissionRateBpsAtSignup: affiliateRow.commissionRateBps ?? rule.commissionRateBps,
          recurringDurationMonthsAtSignup: affiliateRow.recurringDurationMonths ?? rule.recurringDurationMonths,
        }).returning();

        await recordAudit({
          actorUserId: session.user.id,
          action: "affiliate.referral.manually_attributed",
          entityType: "affiliate_referral",
          entityId: referral.id,
          message: `Customer ${customer.email} manually attributed to ${affiliateRow.email}`,
          level: "warning",
          metadata: { reason: body.reason },
        });

        return json({ referral }, 201);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/admin/affiliates/commissions/")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      const commissionId = url.pathname.split("/").filter(Boolean)[4];
      if (request.method === "PUT") {
        try {
          const body = await parseBody(request, commissionActionSchema);
          const existing = await db.query.affiliateCommission.findFirst({ where: eq(affiliateCommission.id, commissionId) });
          if (!existing) return json({ error: "Commission not found" }, 404);
          const now = new Date();
          const [updated] = await db.update(affiliateCommission).set({
            status: body.status,
            commissionAmount: body.commissionAmount ?? existing.commissionAmount,
            approvedAt: body.status === "approved" || body.status === "payable" ? now : existing.approvedAt,
            payableAt: body.status === "payable" ? now : existing.payableAt,
            paidAt: body.status === "paid" ? now : existing.paidAt,
            cancelledAt: body.status === "cancelled" || body.status === "reversed" ? now : existing.cancelledAt,
            adminNotes: body.adminNotes ?? existing.adminNotes,
            updatedAt: now,
          }).where(eq(affiliateCommission.id, commissionId)).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "affiliate.commission.updated",
            entityType: "affiliate_commission",
            entityId: commissionId,
            message: `Affiliate commission changed to ${body.status}`,
            metadata: { adminNotes: body.adminNotes ?? null },
          });

          return json({ commission: updated });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }
    }

    if (url.pathname.startsWith("/api/admin/affiliates")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      const parts = url.pathname.split("/").filter(Boolean);
      const isAffiliateCollection = parts.length === 3;
      const affiliateId = parts.length === 4 ? parts[3] : null;

      if (isAffiliateCollection && request.method === "GET") {
        const [affiliates, referrals, commissions, payouts, flags, users] = await Promise.all([
          db.query.affiliate.findMany({ orderBy: (affiliate, { desc }) => [desc(affiliate.createdAt)] }),
          db.query.affiliateReferral.findMany({ orderBy: (affiliateReferral, { desc }) => [desc(affiliateReferral.createdAt)] }),
          db.query.affiliateCommission.findMany({ orderBy: (affiliateCommission, { desc }) => [desc(affiliateCommission.createdAt)] }),
          db.query.affiliatePayout.findMany({ orderBy: (affiliatePayout, { desc }) => [desc(affiliatePayout.createdAt)] }),
          db.query.affiliateFraudFlag.findMany({ orderBy: (affiliateFraudFlag, { desc }) => [desc(affiliateFraudFlag.createdAt)] }),
          db.query.user.findMany(),
        ]);
        return json({
          affiliates: affiliates.map((row) => ({
            ...sanitizeAffiliate(row, url.origin, true),
            summary: affiliateSummary({
              referrals: referrals.filter((item) => item.affiliateId === row.id),
              commissions: commissions.filter((item) => item.affiliateId === row.id),
            }),
            openFlags: flags.filter((item) => item.affiliateId === row.id && item.status === "open").length,
          })),
          referrals,
          commissions,
          payouts,
          flags,
          users: users.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role })),
        });
      }

      if (isAffiliateCollection && request.method === "POST") {
        try {
          const body = await parseBody(request, adminAffiliateCreateSchema);
          const email = body.email.toLowerCase();
          const existing = await db.query.affiliate.findFirst({ where: eq(affiliate.email, email) });
          if (existing) return json({ error: "Affiliate already exists" }, 409);
          const rule = getAffiliateTierRule(body.tier);
          const [created] = await db.insert(affiliate).values({
            id: makeId("aff"),
            fullName: body.fullName,
            email,
            tier: body.tier,
            status: "approved",
            referralCode: await generateUniqueReferralCode(body.fullName || email),
            commissionType: rule.commissionType,
            commissionRateBps: body.commissionRateBps ?? rule.commissionRateBps,
            recurringDurationMonths: rule.recurringDurationMonths,
            termsAcceptedAt: new Date(),
            approvedAt: new Date(),
            notes: body.notes ?? null,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "affiliate.invited",
            entityType: "affiliate",
            entityId: created.id,
            message: `Affiliate invited/created for ${email}`,
          });
          return json({ affiliate: sanitizeAffiliate(created, url.origin, true) }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (affiliateId && request.method === "PUT") {
        try {
          const body = await parseBody(request, adminAffiliateUpdateSchema);
          const existing = await db.query.affiliate.findFirst({ where: eq(affiliate.id, affiliateId) });
          if (!existing) return json({ error: "Affiliate not found" }, 404);
          const nextTier = body.tier ?? normalizeAffiliateTier(existing.tier);
          const rule = getAffiliateTierRule(nextTier);
          const nextStatus = body.status ?? existing.status;
          const [updated] = await db.update(affiliate).set({
            status: nextStatus,
            tier: nextTier,
            commissionType: rule.commissionType,
            commissionRateBps: body.commissionRateBps ?? rule.commissionRateBps,
            recurringDurationMonths: rule.recurringDurationMonths,
            notes: body.notes ?? existing.notes,
            approvedAt: nextStatus === "approved" || nextStatus === "active" ? existing.approvedAt ?? new Date() : existing.approvedAt,
            rejectedAt: nextStatus === "rejected" ? new Date() : existing.rejectedAt,
            suspendedAt: nextStatus === "suspended" ? new Date() : existing.suspendedAt,
            updatedAt: new Date(),
          }).where(eq(affiliate.id, affiliateId)).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "affiliate.updated",
            entityType: "affiliate",
            entityId: affiliateId,
            message: `Affiliate ${updated.email} updated`,
            metadata: body,
          });
          return json({ affiliate: sanitizeAffiliate(updated, url.origin, true) });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Affiliate route not found" }, 404);
    }

    if (url.pathname.startsWith("/api/admin/vultr")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      try {
        const instances = await listInstances();
        return new Response(JSON.stringify(instances), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch CloudMonkey VPS servers" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/domains")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      const apiKey = process.env.DOMAINS_CO_ZA_API_KEY;
      try {
        const response = await fetch(`https://api.domains.co.za/api/domain/list?key=${apiKey}`);
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch domains" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/public/pricing")) {
      try {
        const categories = await db.query.serviceCategory.findMany({
          with: {
            services: {
              with: {
                plans: {
                  with: {
                    features: true
                  }
                }
              }
            }
          }
        });

        const bundles = await db.query.bundle.findMany({
          with: {
            features: true
          }
        });

        const publicCategories = categories.map((category) => ({
          ...category,
          services: category.services.filter((serviceRow) => serviceRow.id !== "vultr"),
        }));

        return new Response(JSON.stringify({ categories: publicCategories, bundles }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error("Pricing fetch error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch pricing" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/products") && request.method === "PUT") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      try {
        const body = await request.json();
        const { id, name, tagline, priceZar } = body;
        const nextPrice = priceZar === "" || priceZar == null ? null : (parseFloat(priceZar) * 100).toString();

        const [updated] = await db.update(servicePlan)
          .set({ name, tagline, priceZar: nextPrice })
          .where(eq(servicePlan.id, id))
          .returning();
        await recordAudit({
          actorUserId: session.user.id,
          action: "product.updated",
          entityType: "service_plan",
          entityId: id,
          message: `Product updated: ${updated?.name ?? name}`,
        });

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to update product" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/products")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      try {
        const plans = await db.query.servicePlan.findMany({
          with: { service: true }
        });
        return new Response(JSON.stringify(plans), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch products" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/manual-invoices")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      const parts = url.pathname.split("/").filter(Boolean);
      const invoiceId = parts[3];
      const action = parts[4];

      if (request.method === "GET") {
        const userId = url.searchParams.get("userId");
        const rows = await db.query.invoice.findMany({
          where: userId ? eq(invoice.userId, userId) : undefined,
          orderBy: (invoice, { desc }) => [desc(invoice.createdAt)],
        });
        return json(rows.filter((row) => row.invoiceSource === "manual"));
      }

      if (invoiceId && action === "void" && request.method === "POST") {
        try {
          const body = await parseBody(request, invoiceVoidSchema);
          const existing = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
          if (!existing || existing.invoiceSource !== "manual") return json({ error: "Invoice not found" }, 404);
          if (existing.status === "void") return json({ invoice: existing });
          if (existing.status === "paid") return json({ error: "Paid invoices cannot be voided" }, 409);

          const [updated] = await db.update(invoice).set({
            status: "void",
            paystackUrl: null,
            updatedAt: new Date(),
          }).where(eq(invoice.id, invoiceId)).returning();

          const linkedSubscription = await db.query.subscription.findFirst({ where: eq(subscription.id, invoiceId) });
          if (linkedSubscription && linkedSubscription.status !== "active") {
            await db.update(subscription).set({
              status: "cancelled",
              updatedAt: new Date(),
            }).where(eq(subscription.id, invoiceId));
          }

          await recordAudit({
            actorUserId: session.user.id,
            action: "manual_invoice.voided",
            entityType: "invoice",
            entityId: invoiceId,
            message: `Manual invoice voided: ${existing.invoiceNumber ?? invoiceId}`,
            metadata: { reason: body.reason ?? null },
          });
          return json({ invoice: updated });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (!invoiceId && request.method === "POST") {
        try {
          const body = await parseBody(request, manualInvoiceSchema);
          const targetUser = await db.query.user.findFirst({ where: eq(user.id, body.userId) });
          if (!targetUser) return json({ error: "User not found" }, 404);
          const selectedPlan = body.planId
            ? await db.query.servicePlan.findFirst({
                where: eq(servicePlan.id, body.planId),
                with: { service: true },
              })
            : null;
          const isWebsiteOrEcommercePlan = Boolean(
            selectedPlan?.id?.startsWith("web-")
              || selectedPlan?.id?.startsWith("ecom-")
              || ["websites", "ecommerce"].includes(selectedPlan?.service?.id ?? ""),
          );
          if (isWebsiteOrEcommercePlan) {
            if (!body.websitePackageType) {
              return json({ error: "Choose whether this package is a website or ecommerce store" }, 400);
            }
            const expectedPrefix = body.websitePackageType === "ecommerce" ? "ecom-" : "web-";
            if (!selectedPlan?.id?.startsWith(expectedPrefix)) {
              return json({ error: `Choose a ${body.websitePackageType} plan for this package` }, 400);
            }
          }

          const settings = await getWorkspaceSettings();
          const issuedAt = new Date();
          const billingPeriodStart = body.billingPeriodStart ? new Date(body.billingPeriodStart) : issuedAt;
          const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const billingPeriodEnd = body.billingPeriodEnd ? new Date(body.billingPeriodEnd) : (() => {
            const end = new Date(billingPeriodStart);
            end.setMonth(end.getMonth() + (body.interval === "year" ? 12 : 1));
            return end;
          })();
          const createdId = makeId("inv");
          const invoiceNumber = `INV-${issuedAt.getFullYear()}-${createdId.replace(/^inv[_-]?/i, "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;

          const [created] = await db.transaction(async (tx) => {
            const [createdInvoice] = await tx.insert(invoice).values({
              id: createdId,
              userId: body.userId,
              invoiceNumber,
              invoiceSource: "manual",
              amount: body.amount,
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
              workspaceBillingSnapshot: JSON.stringify(getWorkspaceBillingDetails(settings)),
              notes: body.notes ?? settings?.billingInvoiceNotes ?? null,
            }).returning();
            await tx.insert(invoiceItem).values({
              id: makeId("invitem"),
              invoiceId: createdId,
              description: body.name,
              quantity: 1,
              unitPrice: body.amount,
              amount: body.amount,
            });
            if (body.planId || body.bundleId) {
              await tx.insert(subscription).values({
                id: createdId,
                userId: body.userId,
                planId: body.planId ?? null,
                bundleId: body.bundleId ?? null,
                name: body.name,
                status: "pending",
                amount: body.amount,
                interval: body.interval,
                currentPeriodStart: billingPeriodStart,
                currentPeriodEnd: billingPeriodEnd,
              }).onConflictDoUpdate({
                target: subscription.id,
                set: {
                  planId: body.planId ?? null,
                  bundleId: body.bundleId ?? null,
                  name: body.name,
                  status: "pending",
                  amount: body.amount,
                  interval: body.interval,
                  currentPeriodStart: billingPeriodStart,
                  currentPeriodEnd: billingPeriodEnd,
                  updatedAt: new Date(),
                },
              });
            }
            return [createdInvoice];
          });

          await recordAudit({
            actorUserId: session.user.id,
            action: "manual_invoice.created",
            entityType: "invoice",
            entityId: created.id,
            message: `Manual invoice draft created for ${targetUser.email}`,
            metadata: { userId: body.userId, amount: body.amount, planId: body.planId ?? null, websitePackageType: body.websitePackageType ?? null },
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (invoiceId && request.method === "PUT") {
        try {
          const body = await parseBody(request, manualInvoiceSchema.partial().extend({ userId: z.string().min(1) }));
          const existing = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
          if (!existing || existing.invoiceSource !== "manual") return json({ error: "Invoice not found" }, 404);
          if (existing.status !== "draft") return json({ error: "Only draft manual invoices can be edited" }, 409);

          const updateValues: Partial<typeof invoice.$inferInsert> = {
            amount: body.amount ?? existing.amount,
            billingPeriodStart: body.billingPeriodStart ? new Date(body.billingPeriodStart) : existing.billingPeriodStart,
            dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
            billingPeriodEnd: body.billingPeriodEnd ? new Date(body.billingPeriodEnd) : existing.billingPeriodEnd,
            customerCompany: body.customerCompany ?? existing.customerCompany,
            customerAddress: body.customerAddress ?? existing.customerAddress,
            customerVatNumber: body.customerVatNumber ?? existing.customerVatNumber,
            notes: body.notes ?? existing.notes,
            updatedAt: new Date(),
          };
          const [updated] = await db.update(invoice).set(updateValues).where(eq(invoice.id, invoiceId)).returning();
          if (body.name || body.amount) {
            const existingItem = await db.query.invoiceItem.findFirst({ where: eq(invoiceItem.invoiceId, invoiceId) });
            if (existingItem) {
              await db.update(invoiceItem).set({
                description: body.name ?? existingItem.description,
                unitPrice: body.amount ?? existingItem.unitPrice,
                amount: body.amount ?? existingItem.amount,
              }).where(eq(invoiceItem.id, existingItem.id));
            }
          }
          return json(updated);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (invoiceId && action === "publish" && request.method === "POST") {
        try {
          const existing = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
          if (!existing || existing.invoiceSource !== "manual") return json({ error: "Invoice not found" }, 404);
          if (existing.status !== "draft") return json({ error: "Invoice is already published" }, 409);
          const targetUser = await db.query.user.findFirst({ where: eq(user.id, existing.userId) });
          if (!targetUser?.email) return json({ error: "Customer email is required" }, 400);
          const item = await db.query.invoiceItem.findFirst({ where: eq(invoiceItem.invoiceId, invoiceId) });
          const name = item?.description ?? existing.invoiceNumber ?? "Manual CloudMonkey invoice";
          const callbackUrl = `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`;
          const payment = await initializePayment({
            email: targetUser.email,
            amountCents: existing.amount,
            invoiceId,
            subscriptionId: invoiceId,
            userId: existing.userId,
            callbackUrl,
          });

          await db.transaction(async (tx) => {
            const existingSubscription = await db.query.subscription.findFirst({ where: eq(subscription.id, invoiceId) });
            await tx.insert(subscription).values({
              id: invoiceId,
              userId: existing.userId,
              planId: existingSubscription?.planId ?? null,
              bundleId: existingSubscription?.bundleId ?? null,
              name,
              status: "pending",
              amount: existing.amount,
              interval: existingSubscription?.interval ?? "month",
              currentPeriodStart: existing.billingPeriodStart ?? new Date(),
              currentPeriodEnd: existing.billingPeriodEnd,
            }).onConflictDoUpdate({
              target: subscription.id,
              set: {
                name,
                status: "pending",
                amount: existing.amount,
                interval: existingSubscription?.interval ?? "month",
                currentPeriodStart: existing.billingPeriodStart ?? new Date(),
                currentPeriodEnd: existing.billingPeriodEnd,
                updatedAt: new Date(),
              },
            });
            await tx.update(invoice).set({
              status: "pending",
              publishedAt: new Date(),
              paystackReference: payment.data.reference,
              paystackUrl: payment.data.authorization_url,
              updatedAt: new Date(),
            }).where(eq(invoice.id, invoiceId));
          });

          await recordAudit({
            actorUserId: session.user.id,
            action: "manual_invoice.published",
            entityType: "invoice",
            entityId: invoiceId,
            message: `Manual invoice published for ${targetUser.email}`,
            metadata: { reference: payment.data.reference },
          });

          const updated = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
          return json({ invoice: updated, authorization_url: payment.data.authorization_url, reference: payment.data.reference });
        } catch (error: any) {
          return json({ error: error.message }, 500);
        }
      }

      if (invoiceId && action === "email" && request.method === "POST") {
        try {
          const existing = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
          if (!existing || existing.invoiceSource !== "manual") return json({ error: "Invoice not found" }, 404);
          if (existing.status === "draft") return json({ error: "Publish the invoice before emailing it" }, 409);
          if (!existing.paystackUrl) return json({ error: "Invoice does not have a payment link yet" }, 409);
          const targetUser = await db.query.user.findFirst({ where: eq(user.id, existing.userId) });
          if (!targetUser?.email) return json({ error: "Customer email is required" }, 400);
          const item = await db.query.invoiceItem.findFirst({ where: eq(invoiceItem.invoiceId, invoiceId) });

          await sendEmail({
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
              totalDue: formatEmailMoney(existing.amount, existing.currency ?? "ZAR"),
              dueDate: formatEmailDate(existing.dueDate),
              primaryCtaText: "View and pay invoice",
              primaryCtaUrl: `${new URL(request.url).origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`,
            },
            idempotencyKey: `manual-invoice:${invoiceId}:email:${Date.now()}`,
          });

          const [updated] = await db.update(invoice).set({
            emailedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(invoice.id, invoiceId)).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "manual_invoice.emailed",
            entityType: "invoice",
            entityId: invoiceId,
            message: `Manual invoice emailed to ${targetUser.email}`,
          });
          return json(updated);
        } catch (error: any) {
          return json({ error: error.message }, 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/admin/subscriptions")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, subscriptionSchema);
          const [created] = await db.insert(subscription).values({
            id: makeId("sub"),
            ...body,
            currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : null,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "subscription.created",
            entityType: "subscription",
            entityId: created.id,
            message: `Subscription created for ${created.name}`,
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.subscription.findMany({
        with: { user: true, plan: true, bundle: true },
        orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/admin/server-n8n")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      if (url.pathname.endsWith("/sync") && request.method === "POST") {
        try {
          const body = await parseBody(request, n8nSyncSchema);
          const integration = await db.query.serverN8nIntegration.findFirst({
            where: eq(serverN8nIntegration.instanceId, body.instanceId),
            orderBy: (serverN8nIntegration, { desc }) => [desc(serverN8nIntegration.updatedAt)],
          });
          if (!integration) return json({ error: "n8n integration is not configured for this server" }, 404);

          try {
            const result = await syncN8nWorkflows(integration);
            await recordAudit({
              actorUserId: session.user.id,
              action: "n8n.synced",
              entityType: "server_n8n_integration",
              entityId: integration.id,
              message: `n8n workflows synced for ${integration.baseUrl}`,
            });
            return json(result);
          } catch (syncError: any) {
            const [updated] = await db.update(serverN8nIntegration).set({
              status: "error",
              lastError: syncError.message,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(serverN8nIntegration.id, integration.id)).returning();
            return json({ integration: sanitizeN8nIntegration(updated), workflows: [], error: syncError.message }, 202);
          }
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, n8nIntegrationSchema);
          const instance = await db.query.vultrInstance.findFirst({
            where: eq(vultrInstance.id, body.instanceId),
          });
          if (!instance) return json({ error: "Server not found" }, 404);

          const existing = await db.query.serverN8nIntegration.findFirst({
            where: eq(serverN8nIntegration.instanceId, body.instanceId),
          });
          const values = {
            instanceId: body.instanceId,
            userId: instance.userId,
            baseUrl: body.baseUrl.replace(/\/+$/, ""),
            apiKeySecret: encryptSecret(body.apiKey),
            status: "configured",
            lastError: null,
            updatedAt: new Date(),
          };
          const [saved] = existing
            ? await db.update(serverN8nIntegration).set(values).where(eq(serverN8nIntegration.id, existing.id)).returning()
            : await db.insert(serverN8nIntegration).values({
              id: makeId("n8n"),
              ...values,
            }).returning();

          await recordAudit({
            actorUserId: session.user.id,
            action: "n8n.configured",
            entityType: "server_n8n_integration",
            entityId: saved.id,
            message: `n8n integration configured for ${saved.baseUrl}`,
          });
          return json({ integration: sanitizeN8nIntegration(saved) }, existing ? 200 : 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/customers" && request.method === "GET") {
      const { response } = await requireAdmin(request);
      if (response) return response;

      const [
        users,
        subscriptions,
        invoices,
        registeredDomains,
        domainOrders,
        servers,
        websites,
        stores,
        storeDatabases,
        websiteDomains,
        agents,
        tickets,
        affiliates,
      ] = await Promise.all([
        db.query.user.findMany({ orderBy: (user, { desc }) => [desc(user.createdAt)] }),
        db.query.subscription.findMany({ orderBy: (subscription, { desc }) => [desc(subscription.createdAt)] }),
        db.query.invoice.findMany({ orderBy: (invoice, { desc }) => [desc(invoice.createdAt)] }),
        db.query.registeredDomain.findMany(),
        db.query.domainOrder.findMany({ orderBy: (domainOrder, { desc }) => [desc(domainOrder.createdAt)] }),
        db.query.vultrInstance.findMany({ orderBy: (vultrInstance, { desc }) => [desc(vultrInstance.createdAt)] }),
        db.query.website.findMany({ orderBy: (website, { desc }) => [desc(website.createdAt)] }),
        db.query.websiteStore.findMany(),
        db.query.websiteStoreDatabase.findMany(),
        db.query.websiteDomain.findMany(),
        db.query.aiAgent.findMany({ orderBy: (aiAgent, { desc }) => [desc(aiAgent.createdAt)] }),
        db.query.supportTicket.findMany({ orderBy: (supportTicket, { desc }) => [desc(supportTicket.updatedAt)] }),
        db.query.affiliate.findMany(),
      ]);

      const activeStatuses = new Set(["active", "online", "running", "live_trial", "trial", "paid", "approved"]);
      const warningStatuses = new Set(["pending", "pending_payment", "trial", "live_trial", "past_due", "open"]);
      const badStatuses = new Set(["failed", "suspended", "cancelled", "canceled", "terminated", "expired", "rejected"]);

      const customers = users.map((customer) => {
        const userSubscriptions = subscriptions.filter((row) => row.userId === customer.id);
        const userInvoices = invoices.filter((row) => row.userId === customer.id);
        const userRegisteredDomains = registeredDomains.filter((row) => row.userId === customer.id);
        const userDomainOrders = domainOrders.filter((row) => row.userId === customer.id);
        const userServers = servers.filter((row) => row.userId === customer.id);
        const userWebsites = websites.filter((row) => row.userId === customer.id);
        const userStores = stores.filter((row) => row.userId === customer.id);
        const userWebsiteDomains = websiteDomains.filter((row) => row.userId === customer.id);
        const userAgents = agents.filter((row) => row.userId === customer.id);
        const userTickets = tickets.filter((row) => row.userId === customer.id);
        const userAffiliate = affiliates.find((row) => row.userId === customer.id || row.email.toLowerCase() === customer.email.toLowerCase()) ?? null;
        const userStoreIds = new Set(userStores.map((row) => row.id));
        const userDatabases = storeDatabases.filter((row) => row.userId === customer.id || userStoreIds.has(row.storeId));

        const serviceItems = [
          ...userSubscriptions.map((row) => ({
            id: row.id,
            type: "subscription",
            label: row.name,
            status: row.status,
            amount: row.amount,
            interval: row.interval,
            currentPeriodEnd: row.currentPeriodEnd,
          })),
          ...userRegisteredDomains.map((row) => ({
            id: row.id,
            type: "domain",
            label: row.id,
            status: row.status,
            expiryDate: row.expiryDate,
            autoRenew: row.autoRenew,
          })),
          ...userDomainOrders.map((row) => ({
            id: row.id,
            type: "domain_order",
            label: row.domainName,
            status: row.status,
            invoiceId: row.invoiceId,
            subscriptionId: row.subscriptionId,
          })),
          ...userServers.map((row) => ({
            id: row.id,
            type: "server",
            label: row.label || row.mainIp || row.id,
            status: row.status,
            powerStatus: row.powerStatus,
            mainIp: row.mainIp,
            region: row.region,
            ram: row.ram,
            disk: row.disk,
          })),
          ...userWebsites.map((row) => {
            const store = userStores.find((storeRow) => storeRow.websiteId === row.id) ?? null;
            const database = store ? userDatabases.find((databaseRow) => databaseRow.storeId === store.id) ?? null : null;
            return {
              id: row.id,
              type: row.siteType === "ecommerce" ? "ecommerce" : "website",
              label: row.businessName || row.name || row.temporaryDomain || row.domain,
              status: row.status,
              siteType: row.siteType,
              temporaryDomain: row.temporaryDomain,
              primaryDomain: row.primaryDomain,
              containerStatus: row.containerStatus,
              aiGenerationStatus: row.aiGenerationStatus,
              trialEndsAt: row.trialEndsAt,
              store: store ? {
                id: store.id,
                status: store.status,
                paymentMode: store.paymentMode,
                database: database ? {
                  id: database.id,
                  containerName: database.containerName,
                  databaseName: database.databaseName,
                  status: database.status,
                  backupStatus: database.backupStatus,
                } : null,
              } : null,
              domains: userWebsiteDomains.filter((domain) => domain.websiteId === row.id).map((domain) => ({
                domain: domain.domain,
                type: domain.type,
                status: domain.status,
                sslStatus: domain.sslStatus,
              })),
            };
          }),
          ...userAgents.map((row) => ({
            id: row.id,
            type: "ai_agent",
            label: row.name,
            status: row.status,
            provider: row.provider,
            model: row.model,
            lastRunAt: row.lastRunAt,
          })),
          ...(userAffiliate ? [{
            id: userAffiliate.id,
            type: "affiliate",
            label: userAffiliate.fullName,
            status: userAffiliate.status,
            tier: userAffiliate.tier,
            referralCode: userAffiliate.referralCode,
          }] : []),
        ];

        const openTickets = userTickets.filter((ticket) => !["closed", "resolved"].includes(ticket.status)).length;
        const unpaidInvoices = userInvoices.filter((row) => ["pending", "overdue"].includes(row.status));
        const statusValues = serviceItems.flatMap((item: any) => [item.status, item.containerStatus, item.store?.status, item.store?.database?.status].filter(Boolean));
        const activeServices = statusValues.filter((status) => activeStatuses.has(String(status))).length;
        const warningServices = statusValues.filter((status) => warningStatuses.has(String(status))).length;
        const problemServices = statusValues.filter((status) => badStatuses.has(String(status))).length;
        const billingStatus = unpaidInvoices.some((row) => row.status === "overdue")
          ? "overdue"
          : unpaidInvoices.length
            ? "pending"
            : userSubscriptions.some((row) => row.status === "active")
              ? "active"
              : "none";

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          role: customer.role,
          emailVerified: customer.emailVerified,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          summary: {
            totalServices: serviceItems.length,
            activeServices,
            warningServices,
            problemServices,
            openTickets,
            billingStatus,
            unpaidInvoiceCount: unpaidInvoices.length,
            unpaidInvoiceAmount: unpaidInvoices.reduce((sum, row) => sum + row.amount, 0),
          },
          services: {
            items: serviceItems,
            subscriptions: userSubscriptions,
            invoices: userInvoices.slice(0, 10),
            registeredDomains: userRegisteredDomains,
            domainOrders: userDomainOrders,
            servers: userServers,
            websites: userWebsites,
            stores: userStores,
            storeDatabases: userDatabases.map((row) => ({
              id: row.id,
              storeId: row.storeId,
              websiteId: row.websiteId,
              engine: row.engine,
              version: row.version,
              host: row.host,
              port: row.port,
              databaseName: row.databaseName,
              username: row.username,
              containerName: row.containerName,
              status: row.status,
              backupStatus: row.backupStatus,
            })),
            websiteDomains: userWebsiteDomains,
            agents: userAgents,
            tickets: userTickets.slice(0, 10),
            affiliate: userAffiliate,
          },
        };
      });

      return json({
        customers,
        summary: {
          totalCustomers: customers.length,
          totalServices: customers.reduce((sum, row) => sum + row.summary.totalServices, 0),
          activeServices: customers.reduce((sum, row) => sum + row.summary.activeServices, 0),
          problemServices: customers.reduce((sum, row) => sum + row.summary.problemServices, 0),
          openTickets: customers.reduce((sum, row) => sum + row.summary.openTickets, 0),
          unpaidInvoiceAmount: customers.reduce((sum, row) => sum + row.summary.unpaidInvoiceAmount, 0),
        },
      });
    }

    if (url.pathname.startsWith("/api/admin/agents")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, agentSchema.extend({ userId: z.string().min(1) }));
          const [created] = await db.insert(aiAgent).values({
            id: makeId("agent"),
            ...body,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "agent.created",
            entityType: "ai_agent",
            entityId: created.id,
            message: `AI agent created: ${created.name}`,
          });

          const owner = await db.query.user.findFirst({ where: eq(user.id, created.userId) });
          try {
            const n8nResponse = await sendN8nAgentProvisioning({
              agent: created,
              user: {
                id: owner?.id ?? created.userId,
                name: owner?.name ?? null,
                email: owner?.email ?? null,
              },
              idempotencyKey: `agent:${created.id}`,
            });
            await recordAudit({
              actorUserId: session.user.id,
              action: "agent.provisioning.sent",
              entityType: "ai_agent",
              entityId: created.id,
              message: `Agent provisioning workflow accepted ${created.name}`,
              metadata: { n8n: n8nResponse },
            });
            return json({ agent: created, n8nStatus: "sent", n8nResponse }, 201);
          } catch (n8nError: any) {
            await recordAudit({
              actorUserId: session.user.id,
              action: "agent.provisioning_failed",
              entityType: "ai_agent",
              entityId: created.id,
              message: `Agent created but provisioning workflow failed for ${created.name}`,
              level: "error",
              metadata: { error: n8nError.message },
            });
            return json({ agent: created, n8nStatus: "failed", error: n8nError.message }, 202);
          }
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.aiAgent.findMany({
        with: { user: true },
        orderBy: (aiAgent, { desc }) => [desc(aiAgent.createdAt)],
      });
      const discovered = await getDetectedAgentRows(session.user.id, true);
      return json([...rows, ...discovered]);
    }

    if (url.pathname.startsWith("/api/admin/tickets")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      const parts = url.pathname.split("/").filter(Boolean);
      const ticketId = parts[3];

      if (ticketId && parts[4] === "comments" && request.method === "POST") {
        try {
          const body = await parseBody(request, ticketCommentSchema);
          const ticket = await db.query.supportTicket.findFirst({ where: eq(supportTicket.id, ticketId) });
          if (!ticket) return json({ error: "Ticket not found" }, 404);
          const [created] = await db.insert(supportTicketComment).values({
            id: makeId("comment"),
            ticketId,
            userId: session.user.id,
            body: body.body,
            isInternal: body.isInternal,
          }).returning();
          await db.update(supportTicket).set({ updatedAt: new Date() }).where(eq(supportTicket.id, ticketId));
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.comment.created",
            entityType: "support_ticket",
            entityId: ticketId,
            message: `Comment added to ticket ${ticket.subject}`,
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (ticketId && request.method === "PUT") {
        try {
          const body = await parseBody(request, ticketSchema.partial());
          const [updated] = await db.update(supportTicket).set({
            ...body,
            updatedAt: new Date(),
          }).where(eq(supportTicket.id, ticketId)).returning();
          if (!updated) return json({ error: "Ticket not found" }, 404);
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.updated",
            entityType: "support_ticket",
            entityId: updated.id,
            message: `Ticket updated: ${updated.subject}`,
          });
          return json(updated);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, ticketSchema.extend({ userId: z.string().min(1) }));
          const [created] = await db.insert(supportTicket).values({
            id: makeId("ticket"),
            ...body,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.created",
            entityType: "support_ticket",
            entityId: created.id,
            message: `Support ticket opened: ${created.subject}`,
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (ticketId) {
        const row = await db.query.supportTicket.findFirst({
          where: eq(supportTicket.id, ticketId),
          with: { user: true, assignee: true, comments: true },
        });
        return row ? json(row) : json({ error: "Ticket not found" }, 404);
      }

      const rows = await db.query.supportTicket.findMany({
        with: { user: true, assignee: true, comments: true },
        orderBy: (supportTicket, { desc }) => [desc(supportTicket.updatedAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/admin/audit-logs")) {
      const { response } = await requireAdmin(request);
      if (response) return response;
      const rows = await db.query.auditLog.findMany({
        orderBy: (auditLog, { desc }) => [desc(auditLog.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/admin/settings")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      if (request.method === "PUT") {
        try {
          const body = await parseBody(request, settingsSchema);
          const [updated] = await db.insert(workspaceSettings).values({
            id: "default",
            ...body,
          }).onConflictDoUpdate({
            target: workspaceSettings.id,
            set: { ...body, updatedAt: new Date() },
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "settings.updated",
            entityType: "workspace_settings",
            entityId: "default",
            message: "Workspace settings updated",
          });
          return json(updated);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      return json(await getWorkspaceSettings());
    }

    if (url.pathname.startsWith("/api/admin/website-runtime-servers")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      const runtimeParts = url.pathname.split("/").filter(Boolean);
      const runtimeId = runtimeParts[3];
      const runtimeAction = runtimeParts[4];
      if (runtimeId && runtimeAction === "health" && request.method === "GET") {
        const runtime = await db.query.websiteRuntimeServer.findFirst({ where: eq(websiteRuntimeServer.id, runtimeId) });
        if (!runtime) return json({ error: "Runtime server not found" }, 404);
        if (!runtime.provisionerUrl) return json({ error: "Runtime server has no provisioner URL" }, 400);
        try {
          const healthResponse = await fetch(`${runtime.provisionerUrl.replace(/\/+$/, "")}/health`);
          const text = await healthResponse.text();
          let payload: unknown = text;
          try {
            payload = JSON.parse(text);
          } catch {
            // Non-JSON health responses are still useful for diagnostics.
          }
          await db.update(websiteRuntimeServer).set({
            status: healthResponse.ok ? "active" : runtime.status,
            lastHealthCheckAt: new Date(),
            lastError: healthResponse.ok ? null : `Health check failed: ${healthResponse.status}`,
            updatedAt: new Date(),
          }).where(eq(websiteRuntimeServer.id, runtime.id));
          return json({ ok: healthResponse.ok, status: healthResponse.status, health: payload });
        } catch (error: any) {
          await db.update(websiteRuntimeServer).set({
            lastHealthCheckAt: new Date(),
            lastError: error.message,
            updatedAt: new Date(),
          }).where(eq(websiteRuntimeServer.id, runtime.id));
          return json({ ok: false, error: error.message }, 502);
        }
      }

      if (request.method === "POST" || request.method === "PUT") {
        try {
          const body = await parseBody(request, runtimeServerSchema);
          const runtimeId = body.id ?? makeId("runtime");
          const values = {
            ...body,
            id: runtimeId,
            provisionerSecret: encryptSecret(body.provisionerSecret),
            updatedAt: new Date(),
          };
          const [saved] = await db.insert(websiteRuntimeServer).values(values).onConflictDoUpdate({
            target: websiteRuntimeServer.id,
            set: {
              provider: values.provider,
              providerInstanceId: values.providerInstanceId,
              profileName: values.profileName,
              hostname: values.hostname,
              publicIp: values.publicIp,
              privateIp: values.privateIp,
              provisionerUrl: values.provisionerUrl,
              provisionerSecret: values.provisionerSecret,
              ingressHostname: values.ingressHostname,
              ingressIp: values.ingressIp,
              dockerNetworkName: values.dockerNetworkName,
              proxyMode: values.proxyMode,
              region: values.region,
              status: values.status,
              cpuTotal: values.cpuTotal,
              memoryTotalMb: values.memoryTotalMb,
              diskTotalGb: values.diskTotalGb,
              maxSiteCount: values.maxSiteCount,
              lastError: null,
              updatedAt: new Date(),
            },
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "website_runtime_server.saved",
            entityType: "website_runtime_server",
            entityId: saved.id,
            message: `Website runtime server saved: ${saved.hostname}`,
          });
          return json({ ...saved, provisionerSecret: "********" }, request.method === "POST" ? 201 : 200);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.websiteRuntimeServer.findMany({
        orderBy: (websiteRuntimeServer, { desc }) => [desc(websiteRuntimeServer.updatedAt)],
      });
      return json(rows.map((row) => ({ ...row, provisionerSecret: row.provisionerSecret ? "********" : null })));
    }

    if (url.pathname.startsWith("/api/admin/website-projects")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      const parts = url.pathname.split("/").filter(Boolean);
      const websiteId = parts[3];
      const action = parts[4];

      const getProject = async (id: string) => {
        const site = await db.query.website.findFirst({
          where: eq(website.id, id),
          with: { user: true, subscription: { with: { plan: true, bundle: true } }, invoice: true },
        });
        if (!site) return null;
        const detail = await getUserWebsiteDetail(site.userId, site.id);
        const submissions = await db.query.onboardingSubmission.findMany({
          where: site.subscriptionId ? eq(onboardingSubmission.subscriptionId, site.subscriptionId) : eq(onboardingSubmission.userId, site.userId),
          orderBy: (onboardingSubmission, { desc }) => [desc(onboardingSubmission.createdAt)],
        });
        const reviews = await db.query.websiteReviewRequest.findMany({
          where: eq(websiteReviewRequest.websiteId, site.id),
          orderBy: (websiteReviewRequest, { desc }) => [desc(websiteReviewRequest.createdAt)],
        });
        return {
          ...detail,
          user: site.user,
          subscription: site.subscription,
          invoice: site.invoice,
          onboardingSubmissions: submissions.map((row) => ({ ...row, answers: safeJsonParse(row.answers) })),
          reviewRequests: reviews,
        };
      };

      if (!websiteId && request.method === "GET") {
        const sites = await db.query.website.findMany({
          with: { user: true, subscription: { with: { plan: true, bundle: true } }, invoice: true },
          orderBy: (website, { desc }) => [desc(website.createdAt)],
        });
        const rows = sites
          .filter((site) => isWebsitePlanId(site.subscription?.planId ?? site.plan) || site.siteType === "ecommerce" || site.siteType === "website")
          .map((site) => ({
            ...site,
            onboardingAnswers: safeJsonParse(site.onboardingAnswers),
            requirementManifest: safeJsonParse(site.requirementManifest),
            buildManifest: safeJsonParse(site.buildManifest),
            provisioningPlan: safeJsonParse(site.provisioningPlan),
            user: site.user,
            subscription: site.subscription,
            invoice: site.invoice,
            nextAction: !site.onboardingAnswers
              ? "awaiting_onboarding"
              : !site.selectedDesignOptionId
                ? "upload_or_send_designs"
                : site.containerStatus === "not_provisioned"
                  ? "provision_runtime"
                  : site.status === "staging_approved"
                    ? "mark_live"
                    : "review_staging",
          }));
        return json(rows);
      }

      if (!websiteId) return json({ error: "Website id is required" }, 400);

      if (request.method === "GET" && !action) {
        const project = await getProject(websiteId);
        return project ? json(project) : json({ error: "Website project not found" }, 404);
      }

      const site = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
      if (!site) return json({ error: "Website project not found" }, 404);

      if (action === "design-options" && request.method === "POST") {
        try {
          let styleLabel = "";
          let notes = "";
          let imageUrl = "";
          let uploadMeta: Record<string, unknown> = {};
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            styleLabel = String(form.get("styleLabel") || form.get("label") || "Design option");
            notes = String(form.get("notes") || "");
            imageUrl = String(form.get("imageUrl") || "");
            const file = form.get("image");
            if (file instanceof File && file.size > 0) {
              if (!ALLOWED_WEBSITE_DESIGN_TYPES.has(file.type)) return json({ error: "Unsupported design image type" }, 400);
              if (file.size > WEBSITE_MAX_DESIGN_BYTES) return json({ error: "Design image is too large" }, 413);
              const optionId = makeId("design");
              const extension = path.extname(file.name || "") || `.${file.type.split("/")[1] || "bin"}`;
              const storageDir = path.join(WEBSITE_UPLOAD_DIR, websiteId);
              await mkdir(storageDir, { recursive: true });
              const storagePath = path.join(storageDir, `${optionId}${extension}`);
              await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
              uploadMeta = {
                optionId,
                storagePath,
                mimeType: file.type,
                fileName: sanitizeFileName(file.name || `${optionId}${extension}`),
                sizeBytes: file.size,
              };
              imageUrl = publicDesignImageUrl(optionId);
            }
          } else {
            const body = await parseBody(request, adminDesignOptionSchema);
            styleLabel = body.styleLabel;
            notes = body.notes;
            imageUrl = body.imageUrl || "";
          }
          const designOptionId = String(uploadMeta.optionId || makeId("design"));
          const [created] = await db.insert(websiteDesignOption).values({
            id: designOptionId,
            websiteId,
            userId: site.userId,
            styleLabel,
            imageUrl: imageUrl || null,
            thumbnailUrl: imageUrl || null,
            designManifest: JSON.stringify({
              source: "admin_upload",
              notes,
              uploadedBy: session.user.id,
              ...uploadMeta,
            }),
            promptVersion: "admin-upload",
          }).returning();
          await db.update(website).set({
            status: "design_options_uploaded",
            aiGenerationStatus: "awaiting_design_selection",
            updatedAt: new Date(),
          }).where(eq(website.id, websiteId));
          await recordAudit({
            actorUserId: session.user.id,
            action: "website.design_option.uploaded",
            entityType: "website",
            entityId: websiteId,
            message: `Design option uploaded for ${site.businessName || site.domain}`,
            metadata: { designOptionId: created.id, styleLabel },
          });
          return json({ ...created, designManifest: safeJsonParse(created.designManifest) }, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (action === "send-design-email" && request.method === "POST") {
        try {
          const project = await getProject(websiteId);
          if (!project?.designOptions?.length) return json({ error: "Upload at least one design option first" }, 400);
          const { raw, hash } = createApprovalToken();
          const expiresAt = addDays(new Date(), 14);
          const reviewId = makeId("review");
          await db.insert(websiteReviewRequest).values({
            id: reviewId,
            websiteId,
            userId: site.userId,
            type: "design",
            status: "sent",
            targetId: websiteId,
            message: "Design choices sent for approval",
          });
          await db.insert(websiteApprovalToken).values({
            id: makeId("webtoken"),
            websiteId,
            userId: site.userId,
            tokenHash: hash,
            actionType: "design_approval",
            targetId: websiteId,
            expiresAt,
          });
          await db.update(website).set({ status: "design_review_sent", updatedAt: new Date() }).where(eq(website.id, websiteId));
          const approvalUrl = `${new URL(request.url).origin}/website-approval/${encodeURIComponent(raw)}`;
          await sendEmail({
            template: "generic",
            to: project.user?.email ?? "",
            subject: `Choose your CloudMonkey website design`,
            data: {
              firstName: project.user?.name,
              emailTitle: "Your website designs are ready",
              emailIntro: "Please review the design concepts and approve the direction CloudMonkey should build.",
              emailBody: `Project: ${site.businessName || site.domain}\nTemporary domain: ${site.temporaryDomain || site.domain}`,
              primaryCtaText: "Review designs",
              primaryCtaUrl: approvalUrl,
            },
            idempotencyKey: `website:${websiteId}:design-review:${reviewId}`,
          });
          await db.update(websiteReviewRequest).set({
            sentAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(websiteReviewRequest.id, reviewId));
          return json({ ok: true, approvalUrl, expiresAt });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (action === "provision" && request.method === "POST") {
        if (site.status !== "design_selected" && site.status !== "awaiting_provisioning") {
          return json({ error: "Customer design approval is required before provisioning" }, 400);
        }
        try {
          const result = await provisionWebsiteRuntime(site.userId, websiteId);
          return json(result);
        } catch (error: any) {
          await db.update(website).set({ containerStatus: "failed", status: "failed", updatedAt: new Date() }).where(eq(website.id, websiteId));
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (action === "send-staging-email" && request.method === "POST") {
        try {
          const project = await getProject(websiteId);
          if (!project) return json({ error: "Website project not found" }, 404);
          const { raw, hash } = createApprovalToken();
          const expiresAt = addDays(new Date(), 14);
          const reviewId = makeId("review");
          await db.insert(websiteReviewRequest).values({
            id: reviewId,
            websiteId,
            userId: site.userId,
            type: "staging",
            status: "sent",
            targetId: websiteId,
            message: "Staging review sent",
          });
          await db.insert(websiteApprovalToken).values({
            id: makeId("webtoken"),
            websiteId,
            userId: site.userId,
            tokenHash: hash,
            actionType: "staging_review",
            targetId: websiteId,
            expiresAt,
          });
          await db.update(website).set({ status: "staging_review_sent", updatedAt: new Date() }).where(eq(website.id, websiteId));
          const approvalUrl = `${new URL(request.url).origin}/website-approval/${encodeURIComponent(raw)}`;
          await sendEmail({
            template: "generic",
            to: project.user?.email ?? "",
            subject: `Review your CloudMonkey staging site`,
            data: {
              firstName: project.user?.name,
              emailTitle: "Your staging site is ready",
              emailIntro: "Please review the staging site and either approve it or send edit notes.",
              emailBody: `Project: ${site.businessName || site.domain}\nStaging URL: https://${site.primaryDomain || site.temporaryDomain || site.domain}`,
              primaryCtaText: "Review staging",
              primaryCtaUrl: approvalUrl,
            },
            idempotencyKey: `website:${websiteId}:staging-review:${reviewId}`,
          });
          await db.update(websiteReviewRequest).set({
            sentAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(websiteReviewRequest.id, reviewId));
          return json({ ok: true, approvalUrl, expiresAt });
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      if (action === "mark-live" && request.method === "POST") {
        const now = new Date();
        const [updated] = await db.update(website).set({
          status: "active",
          containerStatus: site.containerStatus === "not_provisioned" ? "running" : site.containerStatus,
          updatedAt: now,
        }).where(eq(website.id, websiteId)).returning();
        await recordAudit({
          actorUserId: session.user.id,
          action: "website.marked_live",
          entityType: "website",
          entityId: websiteId,
          message: `Website marked live: ${site.businessName || site.domain}`,
        });
        return json(updated);
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/admin/websites")) {
      const { session, response } = await requireAdmin(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(request, websiteSchema);
          const [created] = await db.insert(website).values({
            id: makeId("site"),
            ...body,
          }).returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "website.created",
            entityType: "website",
            entityId: created.id,
            message: `Website added: ${created.domain}`,
          });
          return json(created, 201);
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.website.findMany({
        with: { user: true },
        orderBy: (website, { desc }) => [desc(website.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/admin/users/") && request.method === "GET") {
      const { response } = await requireAdmin(request);
      if (response) return response;
      const userId = url.pathname.split("/").filter(Boolean)[3];
      const row = await db.query.user.findFirst({ where: eq(user.id, userId) });
      if (!row) return json({ error: "User not found" }, 404);
      const [sessions, accounts, domains, servers, sites, agents, tickets, subs, invoices] = await Promise.all([
        db.query.session.findMany({ where: eq(sessionTable.userId, userId) }),
        db.query.account.findMany({ where: eq(account.userId, userId) }),
        db.query.registeredDomain.findMany({ where: eq(registeredDomain.userId, userId) }),
        db.query.vultrInstance.findMany({ where: eq(vultrInstance.userId, userId) }),
        db.query.website.findMany({ where: eq(website.userId, userId) }),
        db.query.aiAgent.findMany({ where: eq(aiAgent.userId, userId) }),
        db.query.supportTicket.findMany({ where: eq(supportTicket.userId, userId) }),
        db.query.subscription.findMany({ where: eq(subscription.userId, userId) }),
        db.query.invoice.findMany({ where: eq(invoice.userId, userId), orderBy: (invoice, { desc }) => [desc(invoice.createdAt)] }),
      ]);
      return json({ user: row, sessions, accounts, domains, servers, websites: sites, agents, tickets, subscriptions: subs, invoices });
    }

    if (url.pathname.startsWith("/api/admin/users/role") && request.method === "PUT") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      try {
        const body = await parseBody(request, roleUpdateSchema);
        const [updated] = await db.update(user).set({
          role: body.role,
          updatedAt: new Date(),
        }).where(eq(user.id, body.userId)).returning();
        if (!updated) return json({ error: "User not found" }, 404);
        await recordAudit({
          actorUserId: session.user.id,
          action: "user.role.updated",
          entityType: "user",
          entityId: updated.id,
          message: `${updated.email} role changed to ${updated.role}`,
        });
        return json(updated);
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 500);
      }
    }

    if (url.pathname.startsWith("/api/admin/users")) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      const users = await db.query.user.findMany();
      return new Response(JSON.stringify(users), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/admin/assign-domain") && request.method === "POST") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      try {
        const body = await request.json();
        const expiryDate = parseProviderDate(body.expiryDate);
        await db.insert(registeredDomain).values({
          id: body.domainName,
          userId: body.userId,
          status: body.status || "active",
          expiryDate: expiryDate ? new Date(expiryDate) : null,
        }).onConflictDoUpdate({
          target: registeredDomain.id,
          set: {
            userId: body.userId,
            status: body.status || "active",
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            updatedAt: new Date(),
          }
        });
        await recordAudit({
          actorUserId: session.user.id,
          action: "domain.assigned",
          entityType: "registered_domain",
          entityId: body.domainName,
          message: `Domain assigned: ${body.domainName}`,
          metadata: { userId: body.userId },
        });
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: "Failed to assign domain" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/assign-vultr") && request.method === "POST") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!isAdmin(session)) return new Response("Unauthorized", { status: 401 });

      try {
        const body = await request.json();
        await db.insert(vultrInstance).values({
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
        }).onConflictDoUpdate({
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
          }
        });
        await recordAudit({
          actorUserId: session.user.id,
          action: "server.assigned",
          entityType: "vultr_instance",
          entityId: body.id,
          message: `Server assigned: ${body.label || body.id}`,
          metadata: { userId: body.userId },
        });
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: "Failed to assign server" }), { status: 500 });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
