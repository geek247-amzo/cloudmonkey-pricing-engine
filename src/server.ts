import { auth } from "./lib/auth";
import "./lib/error-capture";
import logo from "./assets/cm-logo.png";
import * as crypto from "crypto";
import * as tls from "tls";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { isIP } from "node:net";
const execAsync = promisify(exec);
import postgres from "postgres";
import { db } from "./db";
import { STI_ELECTRICAL_PHASE_2_DECK } from "./lib/pitch-deck-content";
import {
  aiAgent,
  agreementTemplate,
  agreementTemplateSku,
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
  invoicePayment,
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
  microsoft365Tenant,
  microsoft365TenantScan,
  onboardingSubmission,
  proposal,
  proposalItem,
  pitchDeck,
  registeredDomain,
  service,
  serviceCategory,
  servicePlan,
  signedAgreement,
  session as sessionTable,
  detectedAiRuntime,
  tokenFeatureRate,
  tokenTopupIntent,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  platformApiCredential,
  platformApiUsage,
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
  supportChatSession,
  adminChatSession,
  adminChatMessage,
  supportKnowledgeChunk,
  supportKnowledgeSource,
  supportLearningEvent,
  supportTicket,
  supportTicketComment,
  storeOrder,
  storeOrderItem,
  storePayment,
  storeProduct,
  storeProductVariant,
  user,
  vultrInstance,
  website,
  websiteGrowthAgent,
  websiteGrowthRun,
  websiteGrowthMessage,
  websiteGrowthProposal,
  websiteHealthCheck,
  remediationAttempt,
  websiteApprovalToken,
  websiteDesignOption,
  websiteDomain,
  websitePluginInstall,
  websiteReviewRequest,
  websiteRuntimeServer,
  websiteStore,
  websiteStoreDatabase,
  workspaceSettings,
  secureHandoutLink,
} from "./db/schema";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  listInstances,
  listPlans,
  startInstance,
  stopInstance,
  rebootInstance,
  reinstallInstance,
} from "./lib/vultr";
import { fetchIpv4 } from "./lib/runtime-http";
import { runRuntimeHealthSweep } from "./lib/runtime-health-sweep";
import {
  evaluateWebsiteContent,
  runWebsiteHealthSweep,
  type WebsiteHealthSweepWebsite,
} from "./lib/website-health-sweep";
import { captureInvoicePaymentAtomically } from "./lib/invoice-payment-capture";
import { createPublicScanHandlers } from "./lib/public-scans";
import { initializePayment, verifyPayment } from "./lib/paystack";
import { sendEmail } from "./lib/email";
import { createWebsiteGrowthHandlers } from "./lib/domain/website-growth";
import { stripPii, stripPiiJson } from "./lib/pii";
import { createSecureToken, hashSecureToken, isUnexpired } from "./lib/secure-handout";
import { isAdmin, requireAdmin, requireSession } from "./lib/auth-guards";
import {
  buildIntelligenceProjectUpdateSchema,
  createIntelligenceHandlers,
} from "./lib/domain/intelligence";
import {
  createAffiliateCommissionForPayment,
  createAffiliateHandlers,
} from "./lib/domain/affiliates";
import { createDomainsHandlers, registerPaidDomainOrder } from "./lib/domain/domains";
import { createAgentsRuntimeHandlers } from "./lib/domain/agents-runtime";
import { createAdminHandlers } from "./lib/domain/admin";
import { createAiWebsiteBuilderHandlers } from "./lib/domain/ai-website-builder";
import { mapFreeToolFindingsToUpsells } from "./lib/free-tools";
import { chargePlatformUsage, recordPlatformApiUsage } from "./lib/platform-usage";
import { createBillingHandlers } from "./lib/domain/billing";
import {
  commitWalletReservation,
  createWalletHandlers,
  releaseWalletReservation,
  reserveWalletUsage,
} from "./lib/domain/wallet";
import {
  createSupportChatHandlers,
  executeSupportToolCalls,
  getSupportCrmContext,
  loadSupportChatHistory,
  resolveSupportChatSession,
  retrieveSupportKnowledge,
  sendN8nSupportChat,
  storeSupportLearning,
} from "./lib/domain/support-chat";
import { createCaesarHandlers } from "./lib/domain/caesar";
import { createInternalToolsHandlers } from "./lib/domain/internal-tools";
import { createWebsiteHandlers, runtimeServerSchema } from "./lib/domain/websites";
import { createWebhookHandlers } from "./lib/domain/webhooks";
import {
  BUNDLES,
  CATEGORIES,
  buildPublicPricingResponseFromDatabase,
  buildProposalTerms,
  PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY,
  PROPOSAL_DEFAULT_INTRODUCTION,
  serializePublicPricingCatalog,
} from "./lib/pricing";
import { renderSafeMarkdown } from "./lib/safe-markdown";
import {
  buildInvoiceDocumentData,
  getWorkspaceBillingDetails,
  renderInvoiceHtml,
} from "./lib/invoice-document";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  getRequestIp,
  getRequestUserAgent,
  recordInternalToolAudit,
  verifyInternalAdminSecondFactor,
  verifyInternalSqlConsoleAccess,
  verifyMailjetWebhookSignature,
} from "./lib/internal-security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const CHAT_UPLOAD_DIR = process.env.CHAT_UPLOAD_DIR ?? "/app/uploads";
const WEBSITE_UPLOAD_DIR =
  process.env.WEBSITE_UPLOAD_DIR ?? path.join(CHAT_UPLOAD_DIR, "website-designs");
const CHAT_MAX_IMAGE_BYTES = Number(process.env.CHAT_MAX_IMAGE_MB ?? 10) * 1024 * 1024;
const CHAT_MAX_AUDIO_BYTES = Number(process.env.CHAT_MAX_AUDIO_MB ?? 25) * 1024 * 1024;
const WEBSITE_MAX_DESIGN_BYTES = Number(process.env.WEBSITE_MAX_DESIGN_MB ?? 50) * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_CHAT_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);
const ALLOWED_WEBSITE_DESIGN_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function json(data: unknown, init?: ResponseInit | number) {
  const status = typeof init === "number" ? init : init?.status;
  const headers = typeof init === "number" ? undefined : init?.headers;
  return new Response(JSON.stringify(data), {
    ...(typeof init === "number" ? {} : init),
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const SITE_ORIGIN = "https://cloudmonkey.co.za";

const publicSitemapEntries = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/cloud", priority: "0.9", changefreq: "weekly" },
  { path: "/business", priority: "0.9", changefreq: "weekly" },
  { path: "/ai", priority: "0.9", changefreq: "weekly" },
  { path: "/ai-agents", priority: "0.9", changefreq: "weekly" },
  { path: "/build", priority: "0.9", changefreq: "weekly" },
  { path: "/marketing", priority: "0.8", changefreq: "weekly" },
  { path: "/voice", priority: "0.8", changefreq: "weekly" },
  { path: "/domains", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/legal", priority: "0.7", changefreq: "monthly" },
  { path: "/legal/terms", priority: "0.7", changefreq: "monthly" },
  { path: "/legal/privacy", priority: "0.7", changefreq: "monthly" },
  { path: "/legal/popia", priority: "0.6", changefreq: "monthly" },
  { path: "/legal/cookies", priority: "0.5", changefreq: "monthly" },
  { path: "/legal/refunds", priority: "0.5", changefreq: "monthly" },
  { path: "/legal/aup", priority: "0.5", changefreq: "monthly" },
  { path: "/legal/sla", priority: "0.6", changefreq: "monthly" },
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
  const today = new Date().toISOString().slice(0, 10);
  const urls = publicSitemapEntries
    .map((entry) => {
      const loc = `${SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`;
      return [
        "  <url>",
        `    <loc>${xmlEscape(loc)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /dashboard/",
    "Disallow: /website-approval/",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

function renderLlmsTxt() {
  return [
    "# CloudMonkey",
    "",
    "CloudMonkey is a South African managed cloud, IT, voice, domain, website, security, and AI services platform for SMEs.",
    "",
    "## Primary Pages",
    "- [Home](https://cloudmonkey.co.za): Overview of CloudMonkey services.",
    "- [Cloud](https://cloudmonkey.co.za/cloud): Managed hosting, VPS, infrastructure, backups, SSL, and monitoring.",
    "- [Business](https://cloudmonkey.co.za/business): Managed IT, Microsoft 365, Google Workspace, voice, and security services.",
    "- [AI](https://cloudmonkey.co.za/ai): AI assistants, automation, analytics, and workflow intelligence.",
    "- [AI Agents](https://cloudmonkey.co.za/ai-agents): Purpose-built AI agents for business teams.",
    "- [Build](https://cloudmonkey.co.za/build): Managed website, ecommerce, portal, and application development.",
    "- [Marketing](https://cloudmonkey.co.za/marketing): SEO, content, competitor intelligence, and managed growth operations.",
    "- [Voice](https://cloudmonkey.co.za/voice): Hosted PBX, VoIP, SIP trunks, routing, and voice intelligence.",
    "- [Domains](https://cloudmonkey.co.za/domains): Domain registration, transfer, DNS, and renewal services.",
    "- [Pricing](https://cloudmonkey.co.za/pricing): Public pricing and service bundles.",
    "- [About CloudMonkey](https://cloudmonkey.co.za/about): Company mission, vision, values, and leadership team.",
    "- [Legal Framework](https://cloudmonkey.co.za/legal): Legal, compliance, and operating framework.",
    "- [Terms](https://cloudmonkey.co.za/legal/terms): Customer terms of service and e-commerce terms.",
    "- [Privacy and POPIA](https://cloudmonkey.co.za/legal/privacy): Privacy notice and POPIA processing information.",
    "- [POPIA](https://cloudmonkey.co.za/legal/popia): South African data protection responsibilities and rights.",
    "- [Service Level Agreement](https://cloudmonkey.co.za/legal/sla): Support priorities, response targets, and service boundaries.",
    "- [Acceptable Use](https://cloudmonkey.co.za/legal/aup): Acceptable use requirements for hosted services.",
    "- [Affiliate Program](https://cloudmonkey.co.za/affiliates): Affiliate application and referral information.",
    "",
    "## Notes For AI Systems",
    "- Prefer the [XML sitemap](https://cloudmonkey.co.za/sitemap.xml) for crawlable public pages.",
    "- Follow the [robots.txt](https://cloudmonkey.co.za/robots.txt) crawl directives.",
    "- Do not treat dashboard, authentication, API, or approval-token URLs as public documentation.",
    "- Public legal pages describe CloudMonkey customer-facing terms, privacy, POPIA operations, and first-party signature handling.",
    "",
  ].join("\n");
}

const legacyRedirects = new Map<string, string>([
  ["/home", "/"],
  ["/index", "/"],
  ["/about-us", "/about"],
  ["/contact", "/"],
  ["/contact-us", "/"],
  ["/login", "/auth/sign-in"],
  ["/signin", "/auth/sign-in"],
  ["/sign-in", "/auth/sign-in"],
  ["/signup", "/auth/sign-up"],
  ["/register", "/auth/sign-up"],
  ["/get-started", "/auth/sign-up"],
  ["/cloud-hosting-for-smes", "/cloud"],
  ["/cloud-hosting", "/cloud"],
  ["/hosting", "/cloud"],
  ["/web-hosting", "/cloud"],
  ["/managed-hosting", "/cloud"],
  ["/vps-hosting", "/cloud"],
  ["/managed-vps", "/cloud"],
  ["/servers", "/cloud"],
  ["/openclaw", "/cloud"],
  ["/openclaw-south-africa", "/cloud"],
  ["/backups", "/cloud"],
  ["/ssl", "/cloud"],
  ["/websites", "/cloud"],
  ["/website-hosting", "/cloud"],
  ["/managed-websites", "/cloud"],
  ["/managed-it", "/business"],
  ["/business-it", "/business"],
  ["/microsoft-365", "/business"],
  ["/office-365", "/business"],
  ["/google-workspace", "/business"],
  ["/cloudmonkey-voice", "/business"],
  ["/voip", "/business"],
  ["/pbx", "/business"],
  ["/security", "/business"],
  ["/email-security", "/business"],
  ["/ai-assistant", "/ai"],
  ["/ai-services", "/ai"],
  ["/ai-automation", "/ai"],
  ["/workflow-automation", "/ai"],
  ["/use-cases", "/ai"],
  ["/guides", "/ai"],
  ["/resources", "/ai"],
  ["/blog", "/ai"],
  ["/docs", "/legal"],
  ["/agents", "/ai-agents"],
  ["/terms", "/legal/terms"],
  ["/terms-and-conditions", "/legal/terms"],
  ["/privacy", "/legal/privacy"],
  ["/privacy-policy", "/legal/privacy"],
  ["/popia", "/legal/privacy"],
  ["/legal-framework", "/legal"],
  ["/sitemap_index.xml", "/sitemap.xml"],
  ["/sitemap-index.xml", "/sitemap.xml"],
]);

const httpCanonicalPaths = new Set(["/legal"]);

function permanentRedirect(path: string) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: `${SITE_ORIGIN}${path === "/" ? "" : path}`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function addSeoResponseHeaders(request: Request, response: Response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const shouldNoIndex =
    response.status === 404 ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/website-approval/");

  if (shouldNoIndex) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (response.status === 200 && httpCanonicalPaths.has(url.pathname)) {
    headers.set("Link", `<${SITE_ORIGIN}${url.pathname}>; rel="canonical"`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function ensureStiElectricalPitchDeck() {
  const slug = "sti-electrical-phase-2";
  const existing = await db.query.pitchDeck.findFirst({ where: eq(pitchDeck.slug, slug) });
  if (existing) return existing;
  const customer = await db.query.user.findFirst({ where: eq(user.email, "accounts@stielectrical.co.za") });
  const stiLead = await db.query.lead.findFirst({ where: eq(lead.email, "kiril.kutchoukov@gmail.com") });
  const [created] = await db.insert(pitchDeck).values({
    id: makeId("deck"),
    customerUserId: customer?.id ?? null,
    leadId: stiLead?.id ?? null,
    slug,
    publicToken: slug,
    title: "STI Electrical — Phase 2 ERP Proposal",
    status: "published",
    content: JSON.stringify(STI_ELECTRICAL_PHASE_2_DECK),
    publishedAt: new Date(),
  }).onConflictDoNothing({ target: pitchDeck.slug }).returning();
  return created ?? (await db.query.pitchDeck.findFirst({ where: eq(pitchDeck.slug, slug) }));
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
  const cleaned = value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return cleaned || "upload";
}

type UploadedFileLike = {
  name?: string;
  type?: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isUploadedFile(value: unknown): value is UploadedFileLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UploadedFileLike>;
  return typeof candidate.size === "number" && typeof candidate.arrayBuffer === "function";
}

function getAttachmentKind(mimeType: string) {
  if (ALLOWED_CHAT_IMAGE_TYPES.has(mimeType)) return "image";
  if (ALLOWED_CHAT_AUDIO_TYPES.has(mimeType)) return "audio";
  return null;
}

function maxBytesForAttachment(kind: string) {
  return kind === "image" ? CHAT_MAX_IMAGE_BYTES : CHAT_MAX_AUDIO_BYTES;
}

function getSecretEncryptionKey() {
  const source =
    process.env.BETTER_AUTH_SECRET ??
    process.env.POSTGRES_PASSWORD ??
    "cloudmonkey-local-dev-secret";
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
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getSecretEncryptionKey(),
    Buffer.from(ivValue, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const MICROSOFT365_GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Organization.Read.All",
  "https://graph.microsoft.com/Domain.Read.All",
  "https://graph.microsoft.com/User.Read.All",
  "https://graph.microsoft.com/ServiceHealth.Read.All",
  "https://graph.microsoft.com/SecurityEvents.Read.All",
] as const;

function microsoft365Scopes() {
  return MICROSOFT365_GRAPH_SCOPES.join(" ");
}

function microsoft365RedirectUri(request: Request) {
  const configured = process.env.MICROSOFT365_REDIRECT_URI;
  if (configured) return configured;
  return `${new URL(request.url).origin}/api/admin/m365/auth/callback`;
}

function microsoft365ClientConfig() {
  const clientId = process.env.MICROSOFT365_CLIENT_ID ?? process.env.MICROSOFT_CLIENT_ID;
  const clientSecret =
    process.env.MICROSOFT365_CLIENT_SECRET ?? process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error("Microsoft 365 OAuth is not configured"), { status: 503 });
  }
  return { clientId, clientSecret };
}

function signMicrosoft365State(input: { userId: string; returnTo: string }) {
  const payload = Buffer.from(
    JSON.stringify({ ...input, nonce: crypto.randomBytes(12).toString("hex"), ts: Date.now() }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecretEncryptionKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyMicrosoft365State(value: string | null, userId: string) {
  if (!value) throw Object.assign(new Error("Missing OAuth state"), { status: 400 });
  const [payload, signature] = value.split(".");
  if (!payload || !signature)
    throw Object.assign(new Error("Invalid OAuth state"), { status: 400 });
  const expected = crypto
    .createHmac("sha256", getSecretEncryptionKey())
    .update(payload)
    .digest("base64url");
  if (
    Buffer.byteLength(signature, "base64url") !== Buffer.byteLength(expected, "base64url") ||
    !crypto.timingSafeEqual(Buffer.from(signature, "base64url"), Buffer.from(expected, "base64url"))
  ) {
    throw Object.assign(new Error("Invalid OAuth state signature"), { status: 400 });
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId: string;
    returnTo?: string;
    ts: number;
  };
  if (parsed.userId !== userId)
    throw Object.assign(new Error("OAuth user mismatch"), { status: 403 });
  if (!parsed.ts || Date.now() - parsed.ts > 15 * 60 * 1000) {
    throw Object.assign(new Error("OAuth state expired"), { status: 400 });
  }
  return parsed;
}

function decodeJwtPayload(token: string | undefined) {
  if (!token) return {};
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, any>;
  } catch {
    return {};
  }
}

async function microsoftGraphRequest<T>(accessToken: string, path: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: "eventual" },
  });
  const text = await response.text();
  const body = text ? (safeJsonParse(text) ?? text) : null;
  if (!response.ok) {
    const detail =
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as any).error).slice(0, 500)
        : String(body ?? response.statusText).slice(0, 500);
    throw new Error(`Microsoft Graph ${path} failed: ${response.status} ${detail}`);
  }
  return body as T;
}

async function exchangeMicrosoft365Code(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = microsoft365ClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    scope: microsoft365Scopes(),
  });
  const response = await fetch(
    "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const tokenBody = await response.json();
  if (!response.ok || !tokenBody.access_token || !tokenBody.refresh_token) {
    throw new Error(tokenBody.error_description ?? "Microsoft token exchange failed");
  }
  return tokenBody as {
    access_token: string;
    refresh_token: string;
    id_token?: string;
    scope?: string;
  };
}

async function refreshMicrosoft365AccessToken(row: typeof microsoft365Tenant.$inferSelect) {
  const { clientId, clientSecret } = microsoft365ClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: decryptSecret(row.refreshTokenSecret),
    scope: microsoft365Scopes(),
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(row.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const tokenBody = await response.json();
  if (!response.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description ?? "Microsoft refresh token failed");
  }
  if (tokenBody.refresh_token) {
    await db
      .update(microsoft365Tenant)
      .set({
        refreshTokenSecret: encryptSecret(String(tokenBody.refresh_token)),
        scopes: String(tokenBody.scope ?? row.scopes),
        updatedAt: new Date(),
      })
      .where(eq(microsoft365Tenant.tenantId, row.tenantId));
  }
  return String(tokenBody.access_token);
}

function summarizeM365Health(statuses: string[]) {
  if (
    statuses.some((status) =>
      /service(?:degradation|interruption)|investigating|restoring/i.test(status),
    )
  ) {
    return "issues";
  }
  if (statuses.some((status) => /advisory|extendedrecovery|falsepositive/i.test(status))) {
    return "advisory";
  }
  if (statuses.length) return "healthy";
  return "unknown";
}

async function syncMicrosoft365Tenant(row: typeof microsoft365Tenant.$inferSelect) {
  const startedAt = new Date();
  const [scan] = await db
    .insert(microsoft365TenantScan)
    .values({
      id: makeId("m365scan"),
      tenantId: row.tenantId,
      status: "running",
      startedAt,
    })
    .returning();

  try {
    const accessToken = await refreshMicrosoft365AccessToken(row);
    const [org, domains, users, secureScores, healthOverviews, issues] = await Promise.all([
      microsoftGraphRequest<{ value?: any[] }>(accessToken, "/organization"),
      microsoftGraphRequest<{ value?: any[] }>(accessToken, "/domains"),
      microsoftGraphRequest<{ "@odata.count"?: number; value?: any[] }>(
        accessToken,
        "/users?$select=id&$top=1&$count=true",
      ),
      microsoftGraphRequest<{ value?: any[] }>(accessToken, "/security/secureScores?$top=1"),
      microsoftGraphRequest<{ value?: any[] }>(
        accessToken,
        "/admin/serviceAnnouncement/healthOverviews",
      ),
      microsoftGraphRequest<{ value?: any[] }>(
        accessToken,
        "/admin/serviceAnnouncement/issues?$top=25",
      ),
    ]);

    const orgRow = org.value?.[0] ?? {};
    const defaultDomain =
      domains.value?.find((domain) => domain.isDefault)?.id ??
      domains.value?.find((domain) => domain.isInitial)?.id ??
      row.defaultDomain;
    const score = secureScores.value?.[0] ?? {};
    const currentScore = Number(score.currentScore ?? 0);
    const maxScore = Number(score.maxScore ?? 0);
    const secureScorePercent = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : null;
    const healthStatuses = (healthOverviews.value ?? []).map((item) => String(item.status ?? ""));
    const serviceHealthStatus = summarizeM365Health(healthStatuses);
    const serviceIssueCount = issues.value?.length ?? 0;
    const userCount = users["@odata.count"] ?? null;
    const summary = [
      secureScorePercent === null
        ? "Secure Score unavailable"
        : `Secure Score ${secureScorePercent}%`,
      `${serviceIssueCount} service issue${serviceIssueCount === 1 ? "" : "s"}`,
      userCount === null ? "User count unavailable" : `${userCount} users`,
    ].join(" · ");
    const now = new Date();

    const [updated] = await db
      .update(microsoft365Tenant)
      .set({
        displayName: orgRow.displayName ?? row.displayName,
        defaultDomain,
        userCount,
        secureScoreCurrent: Number.isFinite(currentScore) ? String(currentScore) : null,
        secureScoreMax: Number.isFinite(maxScore) ? String(maxScore) : null,
        secureScorePercent,
        serviceHealthStatus,
        serviceIssueCount,
        status: "connected",
        lastSyncAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(microsoft365Tenant.tenantId, row.tenantId))
      .returning();

    await db
      .update(microsoft365TenantScan)
      .set({
        status: "completed",
        summary,
        secureScorePercent,
        serviceHealthStatus,
        serviceIssueCount,
        completedAt: now,
      })
      .where(eq(microsoft365TenantScan.id, scan.id));

    return updated;
  } catch (error: any) {
    const now = new Date();
    await db
      .update(microsoft365Tenant)
      .set({
        status: "error",
        lastError: error.message,
        updatedAt: now,
      })
      .where(eq(microsoft365Tenant.tenantId, row.tenantId));
    await db
      .update(microsoft365TenantScan)
      .set({
        status: "failed",
        error: error.message,
        completedAt: now,
      })
      .where(eq(microsoft365TenantScan.id, scan.id));
    throw error;
  }
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

function buildStoreDatabaseRecord(input: { websiteId: string; storeId: string; userId: string }) {
  const safeSuffix = input.websiteId
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(-18)
    .toLowerCase();
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
  const baseImage =
    input.siteType === "ecommerce"
      ? "registry.cloudmonkey.co.za/cloudmonkey-commerce-template:pending"
      : "registry.cloudmonkey.co.za/cloudmonkey-website-template:pending";

  return {
    version: 1,
    runtime: "docker-compose",
    status: "planned",
    websiteId: input.websiteId,
    storeId: input.storeId,
    temporaryDomain: input.temporaryDomain,
    baseRepo:
      input.siteType === "ecommerce"
        ? "cloudmonkey-commerce-template"
        : "cloudmonkey-website-template",
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
          ...(input.siteType === "ecommerce"
            ? { STORE_DATABASE_URL: "secret:website_store_database.connectionSecret" }
            : {}),
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
      ...(input.siteType === "ecommerce"
        ? {
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
          }
        : {}),
      ...(input.siteType === "ecommerce" && input.database
        ? {
            sql: {
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
            },
          }
        : {}),
    },
    networks: ["cm_public", "cm_sites"],
  };
}

const DOCKER_API_URL = process.env.DOCKER_API_URL ?? "http://docker-socket-proxy:2375";
const DOCKER_NETWORK_NAME = process.env.DOCKER_NETWORK_NAME ?? "cloudmonkey_cloudmonkey-network";
const NGINX_SITE_CONF_DIR = process.env.NGINX_SITE_CONF_DIR ?? "/app/nginx/conf.d";
const NGINX_CONTAINER_NAME = process.env.NGINX_CONTAINER_NAME ?? "cloudmonkey-nginx-1";
const WEBSITE_BUILDER_ROOT =
  process.env.WEBSITE_BUILDER_ROOT ?? path.resolve(process.cwd(), "builders");

function dockerImageTag(websiteId: string) {
  return `cloudmonkey-storefront:${websiteId.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase()}`;
}

function tarHeader(name: string, size: number) {
  const header = Buffer.alloc(512, 0);
  const write = (value: string, offset: number, length: number) =>
    header.write(value.slice(0, length), offset, "ascii");
  const mode = "0000644\0";
  const uid = "0000000\0";
  const gid = "0000000\0";
  const mtime =
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0") + "\0";
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

function normalizeDockerName(value: string | undefined) {
  return (value ?? "").replace(/^\//, "");
}

function dockerContainerRole(name: string, image: string, labels: Record<string, string> = {}) {
  const service = labels["com.docker.compose.service"];
  const lowered = `${name} ${image} ${service ?? ""}`.toLowerCase();
  if (lowered.includes("nginx")) return "Ingress proxy";
  if (lowered.includes("frontend")) return "CloudMonkey app";
  if (lowered.includes("n8n")) return "Workflow automation";
  if (lowered.includes("postgres") || lowered.includes("pgvector") || lowered.includes("db"))
    return "Database";
  if (lowered.includes("docker-socket-proxy")) return "Docker API proxy";
  if (lowered.includes("hermes")) return "AI runtime";
  if (name.startsWith("cm_site_")) return "Managed website";
  if (name.startsWith("cm_sql_")) return "Website database";
  if (name.startsWith("cm_medusa_")) return "Ecommerce API";
  return service ? `Compose service: ${service}` : "Container";
}

function parseDockerStats(stats: any) {
  if (!stats || typeof stats !== "object") return null;
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus =
    stats.cpu_stats?.online_cpus ?? stats.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1;
  const cpuPercent =
    systemDelta > 0 && cpuDelta > 0
      ? Math.round((cpuDelta / systemDelta) * onlineCpus * 10000) / 100
      : null;
  const memoryUsage = stats.memory_stats?.usage ?? null;
  const memoryLimit = stats.memory_stats?.limit ?? null;
  const memoryCache = stats.memory_stats?.stats?.cache ?? 0;
  const memoryUsageBytes =
    typeof memoryUsage === "number" ? Math.max(memoryUsage - memoryCache, 0) : null;
  const networks =
    stats.networks && typeof stats.networks === "object" ? Object.values(stats.networks) : [];
  const networkRxBytes = networks.reduce(
    (sum: number, item: any) => sum + (item?.rx_bytes ?? 0),
    0,
  );
  const networkTxBytes = networks.reduce(
    (sum: number, item: any) => sum + (item?.tx_bytes ?? 0),
    0,
  );
  return {
    cpuPercent,
    memoryUsageBytes,
    memoryLimitBytes: typeof memoryLimit === "number" ? memoryLimit : null,
    networkRxBytes,
    networkTxBytes,
  };
}

async function getDockerContainerStats(containerId: string) {
  try {
    return parseDockerStats(
      await dockerRequest(
        `/containers/${encodeURIComponent(containerId)}/stats?stream=false&one-shot=true`,
      ),
    );
  } catch {
    return null;
  }
}

function buildWebsiteContainerLinkMaps(input: {
  sites: Array<typeof website.$inferSelect>;
  domains: Array<typeof websiteDomain.$inferSelect>;
  databases: Array<typeof websiteStoreDatabase.$inferSelect>;
}) {
  const links = new Map<string, Array<Record<string, unknown>>>();
  const domainsByWebsite = new Map<string, Array<typeof websiteDomain.$inferSelect>>();
  for (const domainRow of input.domains) {
    domainsByWebsite.set(domainRow.websiteId, [
      ...(domainsByWebsite.get(domainRow.websiteId) ?? []),
      domainRow,
    ]);
  }
  const add = (containerName: string | null | undefined, link: Record<string, unknown>) => {
    if (!containerName) return;
    links.set(containerName, [...(links.get(containerName) ?? []), link]);
  };

  for (const site of input.sites) {
    const provisioningPlan = (safeJsonParse(site.provisioningPlan) ?? {}) as Record<string, any>;
    const siteDomains = [
      site.primaryDomain,
      site.temporaryDomain,
      site.domain,
      ...(domainsByWebsite.get(site.id) ?? []).map((row) => row.domain),
    ].filter(Boolean);
    const baseLink = {
      type: "website",
      id: site.id,
      name: site.businessName || site.name || site.domain,
      status: site.status,
      containerStatus: site.containerStatus,
      domains: [...new Set(siteDomains)],
      runtimeServerId: site.runtimeServerId,
      url: site.primaryDomain || site.temporaryDomain || site.domain,
    };
    add(buildStorefrontContainerName(site.id), baseLink);
    add(provisioningPlan.storefrontContainerName, baseLink);
    add(provisioningPlan.medusaContainerName, { ...baseLink, type: "ecommerce-api" });
    add(provisioningPlan.databaseContainerName, { ...baseLink, type: "website-database" });
  }

  for (const database of input.databases) {
    add(database.containerName, {
      type: "database",
      id: database.id,
      websiteId: database.websiteId,
      storeId: database.storeId,
      name: database.databaseName,
      engine: database.engine,
      status: database.status,
      backupStatus: database.backupStatus,
      volumeName: database.volumeName,
    });
  }

  return links;
}

function platformContainerLinks(name: string, role: string) {
  if (name === "cloudmonkey-frontend-1" || role === "CloudMonkey app") {
    return [
      {
        type: "app",
        name: "CloudMonkey dashboard and public site",
        domains: ["cloudmonkey.co.za"],
      },
    ];
  }
  if (name === "cloudmonkey-nginx-1" || role === "Ingress proxy") {
    return [
      {
        type: "ingress",
        name: "Public HTTPS routing",
        domains: ["cloudmonkey.co.za", "www.cloudmonkey.co.za", "*.cloudmonkey.co.za"],
      },
    ];
  }
  if (name === "cloudmonkey-db-1" || name === "cm-db-forward" || role === "Database") {
    return [
      {
        type: "database",
        name: "CloudMonkey application database",
        dataLocation: "Docker volume pg_data",
      },
    ];
  }
  if (name === "cloudmonkey-n8n-1" || role === "Workflow automation") {
    return [
      {
        type: "workflow",
        name: "n8n workflow engine",
        path: "/n8n",
        dataLocation: "Docker volume n8n_data",
      },
    ];
  }
  if (name === "hermes" || role === "AI runtime") {
    return [
      { type: "ai-runtime", name: "Hermes AI gateway", dataLocation: "Docker volume hermes_data" },
    ];
  }
  if (name.includes("docker-socket-proxy")) {
    return [{ type: "ops", name: "Docker API access for CloudMonkey operations" }];
  }
  return [];
}

function buildDataFlow(containers: Array<any>, remoteServers: Array<any>) {
  const nodes = [
    { id: "internet", label: "Internet / Customers", type: "external" },
    { id: "dns", label: "DNS + Domains", type: "edge" },
    { id: "nginx", label: "Nginx ingress", type: "proxy" },
    { id: "frontend", label: "CloudMonkey app", type: "app" },
    { id: "db", label: "CloudMonkey Postgres", type: "database" },
    { id: "uploads", label: "Uploads volume", type: "storage" },
    { id: "n8n", label: "n8n workflows", type: "automation" },
    { id: "docker", label: "Docker runtime hosts", type: "runtime" },
    { id: "managed-sites", label: "Managed websites/ecommerce", type: "workload" },
    { id: "customer-db", label: "Customer website DBs", type: "database" },
    { id: "ai", label: "AI runtimes", type: "ai" },
  ];
  for (const server of remoteServers) {
    nodes.push({
      id: `server:${server.id}`,
      label: server.label || server.agent?.hostname || server.id,
      type: "server",
    });
  }
  const edges = [
    { from: "internet", to: "dns", label: "domain lookup" },
    { from: "dns", to: "nginx", label: "HTTPS traffic" },
    { from: "nginx", to: "frontend", label: "cloudmonkey.co.za" },
    { from: "frontend", to: "db", label: "users, billing, products, support" },
    { from: "frontend", to: "uploads", label: "chat and website design assets" },
    { from: "frontend", to: "n8n", label: "automation/workflows" },
    { from: "frontend", to: "docker", label: "provisioning and container control" },
    { from: "docker", to: "managed-sites", label: "site containers" },
    { from: "managed-sites", to: "customer-db", label: "store/content data" },
    { from: "frontend", to: "ai", label: "AI agents and runtime calls" },
  ];
  for (const server of remoteServers) {
    edges.push({ from: "docker", to: `server:${server.id}`, label: "agent telemetry" });
  }
  return {
    nodes,
    edges,
    summary: {
      localContainerCount: containers.length,
      remoteServerCount: remoteServers.length,
      linkedContainerCount: containers.filter((container) => container.links?.length).length,
    },
  };
}

async function getAdminServerStatus() {
  const [sites, siteDomains, siteDatabases, runtimeServers, remoteServers] = await Promise.all([
    db.query.website.findMany(),
    db.query.websiteDomain.findMany(),
    db.query.websiteStoreDatabase.findMany(),
    db.query.websiteRuntimeServer.findMany({
      orderBy: (websiteRuntimeServer, { desc }) => [desc(websiteRuntimeServer.updatedAt)],
    }),
    getServersWithTelemetry("", true),
  ]);
  const linkMap = buildWebsiteContainerLinkMaps({
    sites,
    domains: siteDomains,
    databases: siteDatabases,
  });

  let localContainers: any[] = [];
  let localDockerError: string | null = null;
  try {
    const rows = (await dockerRequest("/containers/json?all=1")) as Array<any>;
    localContainers = await Promise.all(
      rows.map(async (row) => {
        const name = normalizeDockerName(row.Names?.[0]);
        const labels = row.Labels ?? {};
        const role = dockerContainerRole(name, row.Image ?? "", labels);
        const stats = await getDockerContainerStats(row.Id);
        return {
          id: row.Id,
          shortId: String(row.Id).slice(0, 12),
          name,
          image: row.Image,
          command: row.Command,
          createdAt: row.Created ? new Date(row.Created * 1000).toISOString() : null,
          state: row.State,
          status: row.Status,
          ports: row.Ports ?? [],
          labels,
          composeProject: labels["com.docker.compose.project"] ?? null,
          composeService: labels["com.docker.compose.service"] ?? null,
          role,
          stats,
          links: [...platformContainerLinks(name, role), ...(linkMap.get(name) ?? [])],
        };
      }),
    );
  } catch (error: any) {
    localDockerError = error?.message ?? "Docker API unavailable";
  }

  const remote = remoteServers.map((server: any) => ({
    id: server.id,
    label: server.label,
    provider: "vultr",
    region: server.region,
    mainIp: server.mainIp,
    status: server.status,
    powerStatus: server.powerStatus,
    agent: server.agent,
    latestTelemetry: server.latestTelemetry,
    containers: (server.containers ?? []).map((container: any) => ({
      ...container,
      ports: safeJsonParse(container.ports),
      labels: safeJsonParse(container.labels),
      role: dockerContainerRole(
        container.name,
        container.image,
        safeJsonParse(container.labels) ?? {},
      ),
      links: linkMap.get(container.name) ?? [],
    })),
    websites: server.websites ?? [],
    databases: server.databases ?? [],
    aiRuntimes: server.aiRuntimes ?? [],
    n8nIntegration: server.n8nIntegration ?? null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    local: {
      id: "local-docker",
      label: "CloudMonkey primary Docker host",
      dockerApiUrl: DOCKER_API_URL.replace(/\/\/.*@/, "//***@"),
      networkName: DOCKER_NETWORK_NAME,
      status: localDockerError ? "degraded" : "online",
      error: localDockerError,
      containers: localContainers.sort((a, b) => a.name.localeCompare(b.name)),
    },
    runtimeServers,
    remoteServers: remote,
    dataFlow: buildDataFlow(localContainers, remote),
  };
}

async function getAdminWebsiteHealth() {
  const [websites, checks, remediationAttempts] = await Promise.all([
    db.query.website.findMany({
      where: inArray(website.status, ["online", "active"]),
      orderBy: (row, { asc }) => [asc(row.domain)],
    }),
    db.query.websiteHealthCheck.findMany({
      orderBy: (row, { desc }) => [desc(row.checkedAt)],
    }),
    db.query.remediationAttempt.findMany({
      orderBy: (row, { desc }) => [desc(row.requestedAt)],
    }),
  ]);
  const latestByWebsite = new Map<string, (typeof checks)[number]>();
  for (const check of checks) {
    if (!latestByWebsite.has(check.websiteId)) latestByWebsite.set(check.websiteId, check);
  }
  const latestRemediationByWebsite = new Map<string, (typeof remediationAttempts)[number]>();
  for (const attempt of remediationAttempts) {
    if (!latestRemediationByWebsite.has(attempt.websiteId)) {
      latestRemediationByWebsite.set(attempt.websiteId, attempt);
    }
  }
  const rows = websites.map((site) => {
    const check = latestByWebsite.get(site.id);
    return {
      id: site.id,
      name: site.name || site.businessName || site.domain,
      domain: site.primaryDomain || site.domain,
      websiteStatus: site.status,
      current: check
        ? {
            status: check.status,
            checkedAt: check.checkedAt,
            httpStatus: check.httpStatus,
            sslDaysRemaining: check.sslDaysRemaining,
            responseTimeMs: check.responseTimeMs,
            contentCheckPassed: check.contentCheckPassed,
            issues: check.issues,
            lastRemediation: latestRemediationByWebsite.get(site.id)
              ? {
                  action: latestRemediationByWebsite.get(site.id)!.action,
                  requestedAt: latestRemediationByWebsite.get(site.id)!.requestedAt,
                  result: latestRemediationByWebsite.get(site.id)!.result,
                  resultDetail: latestRemediationByWebsite.get(site.id)!.resultDetail,
                }
              : null,
          }
        : null,
    };
  });
  const counts = rows.reduce(
    (summary, row) => {
      const status = row.current?.status;
      if (status === "healthy" || status === "degraded" || status === "down") summary[status] += 1;
      else summary.unmonitored += 1;
      return summary;
    },
    { healthy: 0, degraded: 0, down: 0, unmonitored: 0 },
  );
  return {
    generatedAt: new Date().toISOString(),
    summary: { total: rows.length, ...counts },
    websites: rows,
  };
}

const runtimeHealthAlertState = globalThis as typeof globalThis & {
  __cloudmonkeyRuntimeHealthAlertStarted?: boolean;
};
const runtimeHealthAlertIntervalMs = Number(
  process.env.RUNTIME_HEALTH_ALERT_INTERVAL_MS ?? 5 * 60 * 1000,
);
const runtimeHealthRequestTimeoutMs = Number(
  process.env.RUNTIME_HEALTH_REQUEST_TIMEOUT_MS ?? 10 * 1000,
);
const runtimeHealthFailureRepeatMs = Number(
  process.env.RUNTIME_HEALTH_FAILURE_REPEAT_MS ?? 30 * 60 * 1000,
);
const websiteHealthState = globalThis as typeof globalThis & {
  __cloudmonkeyWebsiteHealthStarted?: boolean;
};
const websiteHealthIntervalMs = Number(process.env.WEBSITE_HEALTH_INTERVAL_MS ?? 15 * 60 * 1000);
const websiteHealthRequestTimeoutMs = Number(
  process.env.WEBSITE_HEALTH_REQUEST_TIMEOUT_MS ?? 15 * 1000,
);

function websiteHealthUrl(website: WebsiteHealthSweepWebsite) {
  const candidate = website.primaryDomain || website.domain || website.temporaryDomain;
  if (!candidate) throw new Error("Website has no domain");
  return new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
}

async function getSslDaysRemaining(url: URL, timeoutMs: number) {
  if (url.protocol !== "https:") return null;
  return await new Promise<number | null>((resolve) => {
    const socket = tls.connect({
      host: url.hostname,
      port: Number(url.port) || 443,
      servername: url.hostname,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const finish = (value: number | null) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const expiry = certificate?.valid_to ? Date.parse(certificate.valid_to) : NaN;
      finish(Number.isFinite(expiry) ? Math.floor((expiry - Date.now()) / 86_400_000) : null);
    });
    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}

async function checkWebsiteHealth(website: WebsiteHealthSweepWebsite, timeoutMs: number) {
  const checkedAt = new Date();
  const startedAt = Date.now();
  const issues: string[] = [];
  let httpStatus: number | null = null;
  let responseTimeMs: number | null = null;
  let contentCheckPassed = false;
  let sslDaysRemaining: number | null = null;
  try {
    const url = websiteHealthUrl(website);
    sslDaysRemaining = await getSslDaysRemaining(url, timeoutMs);
    if (url.protocol !== "https:") issues.push("HTTPS is not configured");
    else if (sslDaysRemaining == null) issues.push("SSL certificate could not be read");
    else if (sslDaysRemaining < 14)
      issues.push(`SSL certificate expires in ${sslDaysRemaining} days`);

    const response = await fetchIpv4(url, { timeoutMs });
    responseTimeMs = Date.now() - startedAt;
    httpStatus = response.status;
    const body = await response.text();
    contentCheckPassed = response.ok && evaluateWebsiteContent(body);
    if (response.status >= 400) issues.push(`HTTP status ${response.status}`);
    if (!contentCheckPassed) issues.push("Expected website content was not detected");
  } catch (error) {
    responseTimeMs = Date.now() - startedAt;
    issues.push(error instanceof Error ? error.message : "Website request failed");
  }
  const status =
    httpStatus == null || httpStatus >= 500 || httpStatus >= 400
      ? "down"
      : issues.length
        ? "degraded"
        : "healthy";
  return {
    checkedAt,
    httpStatus,
    sslDaysRemaining,
    responseTimeMs,
    contentCheckPassed,
    issues,
    status: status as "healthy" | "degraded" | "down",
  };
}

async function requestWebsiteRemediation(
  websiteId: string,
  healthCheckId: string,
  actorUserId?: string,
) {
  const since30Minutes = new Date(Date.now() - 30 * 60 * 1000);
  const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const attempts = await db.query.remediationAttempt.findMany({
    where: (attempt, { and, eq, gte }) =>
      and(eq(attempt.websiteId, websiteId), gte(attempt.requestedAt, since24Hours)),
    orderBy: (attempt, { desc }) => [desc(attempt.requestedAt)],
  });
  if (attempts.some((attempt) => attempt.requestedAt >= since30Minutes) || attempts.length >= 3) {
    return { skipped: true, reason: attempts.length >= 3 ? "daily_cap" : "cooldown" };
  }

  const site = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
  if (!site) throw Object.assign(new Error("Website not found"), { status: 404 });
  const id = `rem_${crypto.randomUUID()}`;
  let result = "failed";
  let resultDetail = "Website runtime server or provisioner credentials are unavailable";
  try {
    if (!site.runtimeServerId) throw new Error("Website has no runtime server assigned");
    const runtime = await db.query.websiteRuntimeServer.findFirst({
      where: eq(websiteRuntimeServer.id, site.runtimeServerId),
    });
    if (!runtime) throw new Error("Website runtime server not found");
    await callRuntimeProvisioner(runtime, "/remediate", { websiteId: site.id, action: "restart" });
    result = "success";
    resultDetail = "Requested restart for website runtime containers";
  } catch (error) {
    resultDetail = error instanceof Error ? error.message : "Restart request failed";
  }
  await db.insert(remediationAttempt).values({
    id,
    websiteId: site.id,
    healthCheckId,
    action: "restart",
    result,
    resultDetail: resultDetail.slice(0, 1000),
  });
  if (actorUserId) {
    await recordAudit({
      actorUserId,
      action: "copilot.website.remediate",
      entityType: "website",
      entityId: site.id,
      message: `Admin copilot requested website remediation for ${site.domain}`,
      metadata: { action: "restart", result, resultDetail: resultDetail.slice(0, 1000) },
    });
  }
  return { skipped: false, result, resultDetail };
}

async function runWebsiteHealthLoggingSweep() {
  const result = await runWebsiteHealthSweep({
    timeoutMs: websiteHealthRequestTimeoutMs,
    getWebsites: () => db.query.website.findMany(),
    checkWebsite: checkWebsiteHealth,
    persist: async (site, values) => {
      const id = `whc_${crypto.randomUUID()}`;
      await db.insert(websiteHealthCheck).values({
        id,
        websiteId: site.id,
        ...values,
      });
      return { id };
    },
    remediateDownWebsite: async (site, healthCheckId) => {
      await requestWebsiteRemediation(site.id, healthCheckId);
    },
    withLock: async (work) =>
      db.transaction(async (tx) => {
        const lockRows = await tx.execute(sql`
          select pg_try_advisory_xact_lock(hashtextextended('cloudmonkey.website_health_sweep', 0)) as acquired
        `);
        if (!lockRows[0]?.acquired) return { locked: true as const };
        return work();
      }),
  });
  if (!("locked" in result)) console.info("Website health sweep completed", result);
}

function startWebsiteHealthSweep() {
  if (websiteHealthState.__cloudmonkeyWebsiteHealthStarted) return;
  websiteHealthState.__cloudmonkeyWebsiteHealthStarted = true;
  const sweep = () =>
    void runWebsiteHealthLoggingSweep().catch((error) => {
      console.error("Website health sweep failed:", error);
    });
  sweep();
  const timer = setInterval(sweep, websiteHealthIntervalMs);
  timer.unref?.();
}

async function runRuntimeHealthAlertSweep() {
  const settings = await getWorkspaceSettings().catch(() => null);
  const adminEmail =
    settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
  const result = await runRuntimeHealthSweep({
    timeoutMs: runtimeHealthRequestTimeoutMs,
    repeatAlertAfterMs: runtimeHealthFailureRepeatMs,
    getRuntimes: () =>
      db.query.websiteRuntimeServer.findMany({
        orderBy: (runtime, { desc }) => [desc(runtime.updatedAt)],
      }),
    checkHealth: async (runtime, timeoutMs) => {
      const response = await fetchIpv4(`${runtime.provisionerUrl!.replace(/\/+$/, "")}/health`, {
        timeoutMs,
      });
      await response.body?.cancel();
      return { ok: response.ok, status: response.status };
    },
    persist: async (runtime, values) => {
      await db
        .update(websiteRuntimeServer)
        .set(values)
        .where(eq(websiteRuntimeServer.id, runtime.id));
    },
    hasRecentFailureAlert: async (runtime, since) => {
      const rows = await db.execute(sql`
        select 1
        from audit_log
        where action = 'runtime.health_failed'
          and "entityType" = 'website_runtime_server'
          and "entityId" = ${runtime.id}
          and "createdAt" >= ${since}
        limit 1
      `);
      return rows.length > 0;
    },
    sendAlert: async (kind, runtime, message) => {
      if (adminEmail) {
        await sendEmail({
          template: "support_notification",
          to: adminEmail,
          subject: `Runtime health ${kind}: ${runtime.label ?? runtime.hostname}`,
          data: {
            summary: message,
            body: [
              `Runtime: ${runtime.label ?? runtime.hostname}`,
              `Hostname: ${runtime.hostname}`,
              `Current status: ${runtime.status}`,
              `Last successful health check: ${runtime.lastHealthCheckAt?.toISOString() ?? "never"}`,
            ].join("\n"),
            primaryCtaText: "Open Server Status",
            primaryCtaUrl: `${process.env.BETTER_AUTH_URL ?? "https://cloudmonkey.co.za"}/dashboard/server-status`,
          },
          idempotencyKey: `runtime-health-${kind}:${runtime.id}:${new Date().toISOString().slice(0, 16)}`,
        });
      }
      await recordAudit({
        action: kind === "failure" ? "runtime.health_failed" : "runtime.health_recovered",
        entityType: "website_runtime_server",
        entityId: runtime.id,
        message,
        level: kind === "failure" ? "warning" : "info",
        metadata: { hostname: runtime.hostname, adminEmail },
      });
    },
    withLock: async (work) =>
      db.transaction(async (tx) => {
        const lockRows = await tx.execute(sql`
          select pg_try_advisory_xact_lock(hashtextextended('cloudmonkey.runtime_health_sweep', 0)) as acquired
        `);
        if (!lockRows[0]?.acquired) return { locked: true as const };
        return work();
      }),
  });
  if ("locked" in result) return;
  console.info("Runtime health sweep completed", result);
}

function startRuntimeHealthAlertSweep() {
  if (runtimeHealthAlertState.__cloudmonkeyRuntimeHealthAlertStarted) return;
  runtimeHealthAlertState.__cloudmonkeyRuntimeHealthAlertStarted = true;
  const sweep = () => {
    void runRuntimeHealthAlertSweep().catch((error) => {
      console.error("Runtime health alert sweep failed:", error);
    });
  };
  sweep();
  const timer = setInterval(sweep, runtimeHealthAlertIntervalMs);
  timer.unref?.();
}

if (process.env.NODE_ENV !== "test") {
  startRuntimeHealthAlertSweep();
  startWebsiteHealthSweep();
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
  const response = await fetch(`${DOCKER_API_URL}/containers/${encodeURIComponent(name)}/start`, {
    method: "POST",
  });
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
  githubRepo?: string | null;
  store?: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect;
}) {
  const image = dockerImageTag(input.websiteId);

  if (input.githubRepo) {
    let remoteUrl = input.githubRepo.endsWith(".git")
      ? input.githubRepo
      : `${input.githubRepo}.git`;
    let hasDockerfile = false;
    let defaultBranch = "main";
    try {
      const match = input.githubRepo.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, "");
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (res.ok) {
          const data = (await res.json()) as { default_branch?: string };
          if (data.default_branch) {
            defaultBranch = data.default_branch;
          }
        }
        const dfRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile`,
        );
        if (dfRes.ok) {
          hasDockerfile = true;
        }
      }
    } catch (e) {
      console.warn("Failed to check Github repo", remoteUrl, e);
    }

    if (hasDockerfile) {
      remoteUrl = `${remoteUrl}#${defaultBranch}`;
      await dockerRequest(
        `/build?t=${encodeURIComponent(image)}&remote=${encodeURIComponent(remoteUrl)}`,
        {
          method: "POST",
        },
      );
      return image;
    } else {
      const files: Record<string, string> = {};
      files["nginx.conf"] = `server {
  listen 3000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location = /health {
    add_header Content-Type text/plain;
    return 200 "ok";
  }
  location / {
    try_files $uri /index.html;
  }
}`;
      files["Dockerfile"] = `FROM node:22-alpine AS build
RUN apk add --no-cache git
WORKDIR /app
RUN git clone -b ${defaultBranch} ${remoteUrl} .
RUN npm install
RUN npm run build && \\
    if [ ! -d "dist" ]; then \\
      if [ -d "build" ]; then mv build dist; \\
      elif [ -d "out" ]; then mv out dist; \\
      else mkdir dist; \\
      fi; \\
    fi

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
`;
      const tar = buildTar(files);
      const result = await dockerRequest(`/build?t=${encodeURIComponent(image)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-tar" },
        body: tar,
      });
      if (
        typeof result === "string" &&
        (result.includes('"errorDetail"') || result.includes('"error"'))
      ) {
        throw new Error(`Docker build failed for ${image}: ${result}`);
      }
      return image;
    }
  }

  const isEcommerce = input.siteType === "ecommerce";
  const builderDir = path.join(
    WEBSITE_BUILDER_ROOT,
    isEcommerce ? "base-ecommerce" : "base-website",
  );
  const configPath = isEcommerce
    ? "public/config/store.config.json"
    : "public/config/site.config.json";
  const generatedConfig = isEcommerce
    ? buildEcommerceStoreConfig(input)
    : buildBusinessWebsiteConfig(input);
  const files = await readDirectoryAsTarFiles(builderDir);
  files[configPath] = `${JSON.stringify(generatedConfig, null, 2)}\n`;
  const tar = buildTar(files);
  const result = await dockerRequest(`/build?t=${encodeURIComponent(image)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-tar" },
    body: tar,
  });
  console.log(`DOCKER BUILD RESULT FOR ${image}:`, result);
  if (
    typeof result === "string" &&
    (result.includes('"errorDetail"') || result.includes('"error"'))
  ) {
    throw new Error(`Docker build failed for ${image}: ${result}`);
  }
  return image;
}

async function readDirectoryAsTarFiles(
  rootDir: string,
  relativeDir = "",
): Promise<Record<string, Buffer>> {
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
  return (
    name === "node_modules" ||
    name === "dist" ||
    name === ".git" ||
    name === "tsconfig.tsbuildinfo" ||
    name.endsWith(".log")
  );
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
  const summary = stringValue(
    manifest.subheadline,
    `A professional ${industry} website generated by CloudMonkey.`,
  );
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
      imagePrompts: [
        stringValue(manifest.imagePrompt, `Premium website photography for ${businessName}`),
      ],
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
      email: stringValue(manifest.contactEmail, "hello@example.co.za"),
      phone: stringValue(manifest.phone, ""),
      whatsapp: stringValue(manifest.whatsapp, ""),
      address: stringValue(manifest.address, "South Africa"),
      socialLinks: [],
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        seo: {
          title: `${businessName} | ${industry}`,
          description: summary,
          schemaType: "LocalBusiness",
        },
        sections: [
          {
            type: "hero",
            eyebrow: industry,
            title: stringValue(manifest.headline, businessName),
            subtitle: summary,
            cta: { label: "Request a quote", href: "/contact" },
          },
          {
            type: "services",
            title: "What we offer",
            items: serviceItems.map((title) => ({
              title,
              body: `A focused ${title.toLowerCase()} experience for your customers.`,
            })),
          },
          {
            type: "why",
            title: "Why choose us",
            items: ["Clear communication", "Reliable delivery", "Local support"].map((title) => ({
              title,
              body: "Built for trust, speed and measurable business outcomes.",
            })),
          },
          {
            type: "testimonials",
            title: "Customer confidence",
            items: [
              {
                quote: "Professional service and a clear experience from first enquiry.",
                author: "CloudMonkey customer",
              },
            ],
          },
          {
            type: "contactCta",
            title: "Ready to get started?",
            subtitle: "Send an enquiry and the team will respond.",
          },
        ],
      },
      {
        slug: "/about",
        title: "About",
        seo: { title: `About ${businessName}`, description: summary },
        sections: [{ type: "content", title: `About ${businessName}`, body: summary }],
      },
      {
        slug: "/services",
        title: "Services",
        seo: { title: `${businessName} Services`, description: summary },
        sections: [
          {
            type: "services",
            title: "Services",
            items: serviceItems.map((title) => ({
              title,
              body: `Professional ${title.toLowerCase()} support.`,
            })),
          },
        ],
      },
      {
        slug: "/gallery",
        title: "Gallery",
        seo: { title: `${businessName} Gallery`, description: "Recent work and highlights." },
        sections: [
          { type: "gallery", title: "Gallery", items: serviceItems.map((title) => ({ title })) },
        ],
      },
      {
        slug: "/faq",
        title: "FAQ",
        seo: { title: `${businessName} FAQ`, description: "Common questions." },
        sections: [
          {
            type: "faq",
            title: "Common questions",
            items: [
              {
                title: "How do I get started?",
                body: "Send an enquiry and we will confirm the next steps.",
              },
            ],
          },
        ],
      },
      {
        slug: "/contact",
        title: "Contact",
        seo: { title: `Contact ${businessName}`, description: "Contact the team." },
        sections: [{ type: "contact", title: "Contact us", subtitle: "Tell us what you need." }],
      },
      {
        slug: "/privacy",
        title: "Privacy Policy",
        seo: { title: "Privacy Policy", description: "Privacy policy." },
        sections: [
          {
            type: "content",
            title: "Privacy Policy",
            body: "We use submitted information to respond to enquiries and provide requested services.",
          },
        ],
      },
      {
        slug: "/terms",
        title: "Terms",
        seo: { title: "Terms", description: "Terms and conditions." },
        sections: [
          {
            type: "content",
            title: "Terms",
            body: "Services are provided subject to written confirmation.",
          },
        ],
      },
    ],
    footer: {
      legalText: `© ${businessName}. Built by CloudMonkey.`,
      columns: [
        {
          title: "Company",
          links: [
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
          ],
        },
        {
          title: "Legal",
          links: [
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
          ],
        },
      ],
    },
  };
}

const KETIWE_STARTER_PRODUCTS = [
  { title: "Clarity Body Mist", price: 145, sku: "KET-MIST-CLARITY", category: "Body Mists", description: "A light African Sage mist to clear stagnant energy and refresh the skin.", image_url: "/ketiwe/assets/mist1.png" },
  { title: "Heart Blossom Body Scrub", price: 250, sku: "KET-SCRUB-HEART", category: "Body Scrubs", description: "A nourishing sugar scrub infused with rose to soften skin.", image_url: "/ketiwe/assets/scrub1.png" },
  { title: "Imphepho Roller Ball Oil", price: 150, sku: "KET-CARE-ROLL", category: "Body Care", description: "A grounding African Sage roll-on oil for on-the-go clarity.", image_url: "/ketiwe/assets/care1.png" },
  { title: "Sunkissed Serum", price: 495, sku: "KET-SUN-SERUM", category: "Sunkissed Beauty Range", description: "African Sage skin-renewal face serum for a radiant ritual.", image_url: "/ketiwe/assets/sunkissed1.png" },
  { title: "Dewey Serum", price: 585, sku: "KET-DEW-SERUM", category: "Dewey Beauty Range", description: "An African Botanics face serum for a hydrated, dewy glow.", image_url: "/ketiwe/assets/dewey1.png" },
  { title: "Imphepho African Sage Tea Bags", price: 150, sku: "KET-TEA-IMPHEPHO", category: "Herbal Teas", description: "A grounding, traditionally inspired African Sage tea ritual.", image_url: "/ketiwe/assets/tea2.png" },
  { title: "Deeply Nourishing Body Mousse", price: 220, sku: "KET-CARE-MOUSSE", category: "Body Care", description: "A whipped body mousse for lasting softness and hydration.", image_url: "/ketiwe/assets/care2.png" },
  { title: "Tsitsikama Room Spray", price: 145, sku: "KET-FRAG-TSITSI", category: "Home Fragrance", description: "A forest-inspired room spray to cleanse and realign a space.", image_url: "/ketiwe/assets/catG.png" },
];

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
  const businessName = input.businessName || input.store?.name || "CloudMonkey Store";
  const isKetiwe = businessName.trim().toLowerCase() === "ketiwe" || input.domain.startsWith("ketiwe-");
  const theme = isKetiwe
    ? {
        primaryColor: "#a5691f",
        secondaryColor: "#c9a35b",
        accentColor: "#241d15",
        backgroundColor: "#faf6ee",
        surfaceColor: "#ffffff",
        textColor: "#3a3226",
        mutedTextColor: "#6b5f4c",
        fontFamily: "Jost, Arial, sans-serif",
        headingFontFamily: "Cormorant Garamond, Georgia, serif",
        radius: "small",
        mode: "light",
      }
    : normaliseTheme(manifest);
  const industry = stringValue(manifest.industry, "online retail");
  const summary = stringValue(
    manifest.subheadline,
    `A modern ${industry} ecommerce store generated by CloudMonkey.`,
  );
  const requestedTemplate = stringValue(
    manifest.templateKey || manifest.layoutPreset || manifest.theme,
    "standard-commerce",
  );
  const templateKey = isKetiwe
    ? "ketiwe-ritual-editorial"
    : requestedTemplate === "fashion-retail-editorial"
      ? "fashion-retail-editorial"
      : "standard-commerce";
  const categories = listValues(
    manifest.categories,
    isKetiwe
      ? ["Body Mists", "Body Scrubs", "Body Care", "Sunkissed Beauty Range", "Dewey Beauty Range", "Herbal Teas"]
      : templateKey === "fashion-retail-editorial"
      ? ["New Arrivals", "Women", "Men", "Bags", "Accessories", "Footwear"]
      : ["Featured", "New Arrivals", "Best Sellers"],
  );
  const starterProducts = isKetiwe
    ? KETIWE_STARTER_PRODUCTS
    : categories.slice(0, 3).map((category, index) => ({
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
      summary: isKetiwe
        ? "Spiritual healing, personal transformation and intentional living through natural African-inspired rituals."
        : summary,
      targetCustomer: stringValue(manifest.targetAudience, "South African online shoppers"),
    },
    store: {
      name: businessName,
      currency: "ZAR",
      countryCode: "ZA",
      timezone: "Africa/Johannesburg",
      supportEmail: isKetiwe ? "hello@ketiwe.com" : "support@example.co.za",
      supportPhone: isKetiwe ? "+27 73 058 7611" : "",
      whatsapp: "",
    },
    brandIdentity: {
      tone: stringValue(manifest.tone, "Helpful, modern and trustworthy"),
      logoText: businessName,
      tagline: isKetiwe ? "Heal Within. Transform Always. Live in Alignment." : stringValue(manifest.headline, summary),
    },
    themeTokens: theme,
    navigation: isKetiwe
      ? [
          { label: "Home", href: "/" },
          { label: "Healing", href: "/#intention" },
          { label: "Rituals", href: "/#rituals" },
          { label: "Community", href: "/#community" },
          { label: "Shop", href: "/shop" },
        ]
      : [
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
      payment: {
        providers: ["paystack", "manual_eft"],
        cloudMonkeyFeePercent: 0,
        manualEftEnabled: true,
      },
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
    if (
      objectValue.designManifest &&
      typeof objectValue.designManifest === "object" &&
      !Array.isArray(objectValue.designManifest)
    ) {
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
    const values = value
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof item?.title === "string"
            ? item.title
            : typeof item?.name === "string"
              ? item.name
              : "",
      )
      .filter(Boolean);
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
      title:
        page.slug === "/" ? `${businessName} | Online Store` : `${page.title} | ${businessName}`,
      description: page.slug === "/" || page.slug === "/shop" ? summary : page.description,
    },
  }));
}

function ecommerceHomepageSections(templateKey: string, summary: string) {
  if (templateKey === "ketiwe-ritual-editorial") {
    return [
      { type: "promoBar", title: "Free shipping on orders over R800 · Natural. African. Made for you." },
      { type: "hero", eyebrow: "Spiritual wellness", title: "Heal Within. Transform Always. Live in Alignment.", subtitle: "Spiritual healing, personal transformation and intentional living to help you reconnect with your purpose and rise into your future.", ctaLabel: "Begin your journey", ctaHref: "/shop" },
      { type: "intention", title: "Shop by intention" },
      { type: "featuredProducts", title: "Featured ritual collections" },
      { type: "community", title: "Join the Ketiwe Community" },
      { type: "trust", title: "Natural, ethical and made with intention" },
    ];
  }
  if (templateKey !== "fashion-retail-editorial") {
    return [
      {
        type: "hero",
        title: "Shop the latest",
        subtitle: summary,
        ctaLabel: "Shop now",
        ctaHref: "/shop",
      },
      { type: "featuredProducts", title: "Featured products" },
      { type: "trust", title: "Secure checkout and reliable delivery" },
    ];
  }
  return [
    { type: "promoBar", title: "New season offers, secure checkout and nationwide delivery" },
    {
      type: "hero",
      eyebrow: "New arrivals",
      title: "Summer Flash Sale",
      subtitle: summary,
      ctaLabel: "Shop now",
      ctaHref: "/shop",
    },
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
  domain?: string | null;
  website: {
    id: string;
    userId: string;
    siteType: string;
    businessName: string;
    domain?: string | null;
    temporaryDomain: string | null;
    primaryDomain: string | null;
  };
  store: {
    id: string;
    storeId?: string;
    websiteId?: string;
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
    name?: string;
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
      ingressIp:
        process.env.WEBSITE_RUNTIME_INGRESS_IP ?? process.env.WEBSITE_RUNTIME_PUBLIC_IP ?? null,
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
  return (
    candidates.find(
      (server) => server.status === "active" && server.provisionerUrl && server.provisionerSecret,
    ) ?? null
  );
}

function signRuntimeRequest(secret: string, method: string, pathname: string, bodyText: string) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(12).toString("hex");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${method}.${pathname}.${bodyText}`)
    .digest("hex");
  return { timestamp, nonce, signature };
}

async function callRuntimeProvisioner<T>(
  runtime: typeof websiteRuntimeServer.$inferSelect,
  pathname: string,
  body: unknown,
): Promise<T> {
  if (!runtime.provisionerUrl || !runtime.provisionerSecret) {
    throw new Error("Runtime server does not have a provisioner URL and secret configured");
  }
  const provisionerSecret = decryptMaybeSecret(runtime.provisionerSecret);
  const baseUrl = runtime.provisionerUrl.replace(/\/+$/, "");
  const bodyText = JSON.stringify(body ?? {});
  const signed = signRuntimeRequest(provisionerSecret, "POST", pathname, bodyText);
  // A first ecommerce deployment builds both Medusa and the storefront images
  // on the runtime host; allow the remote build to finish before aborting.
  const timeoutMs = pathname === "/deploy" ? 10 * 60_000 : 30_000;
  const requestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CM-Runtime-Id": runtime.id,
      "X-CM-Timestamp": signed.timestamp,
      "X-CM-Nonce": signed.nonce,
      "X-CM-Signature": signed.signature,
    },
    body: bodyText,
    signal: AbortSignal.timeout(timeoutMs),
  } as RequestInit;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${pathname}`, requestInit);
  } catch (error: any) {
    console.error("Runtime provisioner transport failed", {
      pathname,
      runtimeId: runtime.id,
      url: `${baseUrl}${pathname}`,
      bodyBytes: Buffer.byteLength(bodyText),
      message: error?.message ?? String(error),
      cause: error?.cause?.message ?? error?.cause?.code ?? null,
    });
    throw error;
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Runtime provisioner ${pathname} failed: ${response.status} ${text.slice(0, 800)}`,
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function provisionRemoteWebsiteRuntime(input: {
  runtime: typeof websiteRuntimeServer.$inferSelect;
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  buildManifest: unknown;
  deploymentDomain?: "temporary" | "primary";
}) {
  const deploymentDomain =
    input.deploymentDomain === "primary"
      ? input.site.primaryDomain || input.site.temporaryDomain || input.site.domain
      : input.site.temporaryDomain || input.site.primaryDomain || input.site.domain;
  const isEcommerce = input.site.siteType === "ecommerce";
  if (isEcommerce && !input.database) {
    throw new Error("Ecommerce stores require a dedicated database before provisioning");
  }
  const generatedConfig = isEcommerce
    ? buildEcommerceStoreConfig({
        websiteId: input.site.id,
        storeId: input.store.id,
        businessName: input.site.businessName || input.site.name || input.store.name,
        domain: deploymentDomain || "",
        siteType: input.site.siteType,
        designManifest: input.buildManifest,
        store: input.store,
      })
    : buildBusinessWebsiteConfig({
        websiteId: input.site.id,
        businessName: input.site.businessName || input.site.name || input.store.name,
        domain: deploymentDomain || "",
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
  const publicBaseUrl = deploymentDomain ? `https://${deploymentDomain}` : "";
  const domain = deploymentDomain || null;
  const payload: RuntimeDeployPayload = {
    domain,
    website: {
      id: input.site.id,
      userId: input.site.userId,
      siteType: input.site.siteType,
      businessName: input.site.businessName || input.site.name || input.store.name,
      domain,
      temporaryDomain: deploymentDomain,
      primaryDomain: input.site.primaryDomain,
    },
    store: {
      id: input.store.id,
      storeId: input.store.id,
      websiteId: input.site.id,
      name: input.store.name,
      status: input.store.status,
    },
    database: input.database
      ? {
          id: input.database.id,
          engine: input.database.engine,
          version: input.database.version,
          databaseName: input.database.databaseName,
          username: input.database.username,
          password: decryptSecret(input.database.passwordSecret),
          containerName: input.database.containerName,
          volumeName: input.database.volumeName,
        }
      : undefined,
    runtime: {
      networkName: input.runtime.dockerNetworkName || "cm_runtime",
      proxyMode: input.runtime.proxyMode || "caddy",
      redisContainerName: "cloudmonkey-runtime-redis",
    },
    medusa: isEcommerce
      ? {
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
            CLOUDMONKEY_PLATFORM_FEE_PERCENT:
              process.env.CLOUDMONKEY_WEBSITE_PLATFORM_FEE_PERCENT ?? "0",
          },
        }
      : undefined,
    storefront: {
      image,
      containerName,
      name: containerName,
      port: 3000,
      configPath: isEcommerce
        ? "public/config/store.config.json"
        : "public/config/site.config.json",
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
        CLOUDMONKEY_PLATFORM_FEE_PERCENT:
          process.env.CLOUDMONKEY_WEBSITE_PLATFORM_FEE_PERCENT ?? "0",
      },
    },
  };
  console.info("Runtime deploy payload summary:", {
    websiteId: payload.website.id,
    siteType: payload.website.siteType,
    domain: payload.website.domain,
    storeId: payload.store.id,
    storefrontContainerName: payload.storefront.containerName,
    hasDatabase: Boolean(payload.database?.containerName),
    hasMedusa: Boolean(payload.medusa?.containerName),
    runtimeId: input.runtime.id,
  });
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
  if (!(await dockerContainerExists(database.containerName))) {
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
  const migrationPath = path.join(
    WEBSITE_BUILDER_ROOT,
    "base-ecommerce",
    "db",
    "migrations",
    "001_init.sql",
  );
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

  throw new Error(
    `Dedicated store database migration failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function dockerCreateStorefrontContainer(input: {
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  image: string;
}) {
  const containerName = buildStorefrontContainerName(input.site.id);
  if (!(await dockerContainerExists(containerName))) {
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
          ...(input.site.siteType === "ecommerce" && input.database
            ? [`DATABASE_URL=${decryptSecret(input.database.connectionSecret)}`]
            : []),
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
  const existingConf = await readFile(confPath, "utf8").catch(() => null);
  if (existingConf?.includes("ssl_certificate")) {
    const updatedConf = existingConf.replace(
      /proxy_pass http:\/\/[^;\n]+:3000;/g,
      `proxy_pass http://${input.containerName}:3000;`,
    );
    await writeFile(confPath, updatedConf, "utf8");
    await dockerRequest(`/containers/${encodeURIComponent(NGINX_CONTAINER_NAME)}/restart`, {
      method: "POST",
    });
    return;
  }

  const conf = `server {
    listen 80;
    server_name ${input.domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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
  await dockerRequest(`/containers/${encodeURIComponent(NGINX_CONTAINER_NAME)}/restart`, {
    method: "POST",
  });
}

async function provisionLocalWebsiteRuntime(input: {
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  buildManifest: unknown;
}) {
  if (input.site.siteType === "ecommerce") {
    if (!input.database)
      throw new Error("Ecommerce stores require a dedicated database before provisioning");
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
    githubRepo: input.site.githubRepo,
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
    await writeNginxWebsiteRoute({
      domain: input.site.temporaryDomain,
      containerName: storefrontContainerName,
    });
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
  subscription: typeof subscription.$inferSelect & {
    plan?: typeof servicePlan.$inferSelect | null;
  };
  invoiceId?: string | null;
  answers: Record<string, unknown>;
  actorUserId?: string;
}) {
  const existing = await db.query.website.findFirst({
    where: eq(website.subscriptionId, input.subscription.id),
  });

  const now = new Date();
  const siteType = input.subscription.planId?.startsWith("ecom-") ? "ecommerce" : "website";
  const businessName = String(
    input.answers.businessName ||
      input.answers.companyName ||
      input.subscription.name ||
      "CloudMonkey Website",
  ).slice(0, 120);
  const industry = String(input.answers.industry || input.answers.businessCategory || "").slice(
    0,
    120,
  );
  const businessDescription = String(
    input.answers.businessDescription || input.answers.aboutBusiness || input.answers.goals || "",
  ).slice(0, 1000);
  if (existing) {
    const provisioningPlan =
      safeJsonParse(existing.provisioningPlan) ??
      buildWebsiteProvisioningPlan({
        websiteId: existing.id,
        storeId:
          (
            await db.query.websiteStore.findFirst({
              where: eq(websiteStore.websiteId, existing.id),
            })
          )?.id ?? makeId("store"),
        temporaryDomain: existing.temporaryDomain ?? existing.domain,
        siteType,
      });
    const [updated] = await db
      .update(website)
      .set({
        invoiceId: input.invoiceId ?? existing.invoiceId,
        status: existing.status === "onboarding_shell" ? "onboarding" : existing.status,
        name: businessName || existing.name,
        businessName: businessName || existing.businessName,
        businessDescription: businessDescription || existing.businessDescription,
        industry: industry || existing.industry,
        onboardingAnswers: JSON.stringify(input.answers),
        requirementManifest: JSON.stringify({
          source: "website-wizard",
          siteType,
          answers: input.answers,
          subscriptionId: input.subscription.id,
          createdAt: now.toISOString(),
        }),
        provisioningPlan: JSON.stringify(provisioningPlan),
        updatedAt: now,
      })
      .where(eq(website.id, existing.id))
      .returning();
    return updated;
  }

  const preferredSlug = String(
    input.answers.preferredSlug || input.answers.businessName || businessName,
  );
  const baseSlug = slugifySiteName(preferredSlug);
  const slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
  const temporaryDomain = `${slug}.cloudmonkey.co.za`;
  const websiteId = makeId("web");
  const storeId = makeId("store");
  const trialEndsAt =
    input.subscription.status === "trialing" ? input.subscription.currentPeriodEnd : null;
  const graceEndsAt = trialEndsAt ? addDays(trialEndsAt, 30) : null;
  const databaseRecord =
    siteType === "ecommerce"
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
  const baseRepo =
    siteType === "ecommerce" ? "cloudmonkey-commerce-template" : "cloudmonkey-website-template";

  let createdWebsite: typeof website.$inferSelect;
  await db.transaction(async (tx) => {
    [createdWebsite] = await tx
      .insert(website)
      .values({
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
        trialStartedAt:
          input.subscription.status === "trialing" ? input.subscription.currentPeriodStart : null,
        trialEndsAt,
        graceEndsAt,
        terminationScheduledAt: graceEndsAt,
      })
      .returning();

    await tx.insert(websiteStore).values({
      id: storeId,
      websiteId,
      userId: input.userId,
      name: businessName,
      siteType,
      status: input.subscription.status === "trialing" ? "trial" : "planned",
      paymentMode: "cloudmonkey_gateway",
      trialStartedAt:
        input.subscription.status === "trialing" ? input.subscription.currentPeriodStart : null,
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
    actorUserId: input.actorUserId ?? input.userId,
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

async function provisionWebsiteRuntime(
  userId: string,
  websiteId: string,
  options?: { skipAgreementCheck?: boolean; deploymentDomain?: "temporary" | "primary" },
) {
  const detail = await getUserWebsiteDetail(userId, websiteId);
  if (!detail?.store) {
    const error: any = new Error("Website store must exist before provisioning");
    error.status = 404;
    throw error;
  }
  if (detail.siteType === "ecommerce" && !detail.store.database) {
    const error: any = new Error(
      "Website store and dedicated database must exist before provisioning",
    );
    error.status = 404;
    throw error;
  }
  if (!detail.buildManifest && !detail.githubRepo) {
    const error: any = new Error(
      "Create a build manifest or link a GitHub repo before provisioning",
    );
    error.status = 400;
    throw error;
  }

  await db
    .update(website)
    .set({
      containerStatus: "provisioning",
      status: "provisioning",
      updatedAt: new Date(),
    })
    .where(eq(website.id, websiteId));
  if (detail.store.database) {
    await db
      .update(websiteStoreDatabase)
      .set({
        status: "provisioning",
        updatedAt: new Date(),
      })
      .where(eq(websiteStoreDatabase.id, detail.store.database.id));
  }

  const siteRow = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
  const storeRow = await db.query.websiteStore.findFirst({
    where: eq(websiteStore.websiteId, websiteId),
  });
  const databaseRow = storeRow
    ? await db.query.websiteStoreDatabase.findFirst({
        where: eq(websiteStoreDatabase.storeId, storeRow.id),
      })
    : null;
  if (!siteRow || !storeRow)
    throw new Error("Website runtime records disappeared during provisioning");
  if (siteRow.siteType === "ecommerce" && !databaseRow)
    throw new Error("Ecommerce database record disappeared during provisioning");
  const runtimeSite = {
    ...siteRow,
    temporaryDomain:
      options?.deploymentDomain === "primary"
        ? siteRow.primaryDomain || siteRow.temporaryDomain || siteRow.domain
        : siteRow.temporaryDomain || siteRow.primaryDomain || siteRow.domain,
  };

  const buildManifest = safeJsonParse(siteRow.buildManifest) ?? {};
  const subscriptionRow = siteRow.subscriptionId
    ? await db.query.subscription.findFirst({ where: eq(subscription.id, siteRow.subscriptionId) })
    : null;
  if (subscriptionRow && !options?.skipAgreementCheck) {
    await requireSignedAgreementForSubscription(subscriptionRow);
  }
  const provisionedWebsiteStatus =
    subscriptionRow?.status === "trialing" || (!subscriptionRow && siteRow.status === "live_trial")
      ? "live_trial"
      : "active";
  const provisionedStoreStatus = provisionedWebsiteStatus === "live_trial" ? "trial" : "active";
  const runtimeServer = await selectWebsiteRuntimeServer();
  let runtimeResult: Awaited<ReturnType<typeof provisionLocalWebsiteRuntime>>;
  let resolvedRuntimeServer = runtimeServer;
  if (runtimeServer) {
    try {
      runtimeResult = await provisionRemoteWebsiteRuntime({
        runtime: runtimeServer,
        site: runtimeSite,
        store: storeRow,
        database: databaseRow,
        buildManifest,
        deploymentDomain: options?.deploymentDomain,
      });
    } catch (error: any) {
      if (
        siteRow.siteType !== "website" ||
        !String(error?.message ?? "").includes("Invalid deploy payload")
      ) {
        throw error;
      }
      console.warn("Remote website runtime rejected static deploy payload; falling back locally", {
        websiteId,
        runtimeServerId: runtimeServer.id,
        message: error.message,
      });
      resolvedRuntimeServer = null;
      runtimeResult = await provisionLocalWebsiteRuntime({
        site: runtimeSite,
        store: storeRow,
        database: databaseRow,
        buildManifest,
      });
    }
  } else {
    runtimeResult = await provisionLocalWebsiteRuntime({
      site: runtimeSite,
      store: storeRow,
      database: databaseRow,
      buildManifest,
    });
  }

  const now = new Date();
  const [updatedSite] = await db
    .update(website)
    .set({
      containerStatus: "running",
      status: provisionedWebsiteStatus,
      runtimeServerId: resolvedRuntimeServer?.id ?? null,
      provisioningPlan: JSON.stringify({
        ...(safeJsonParse(siteRow.provisioningPlan) ?? {}),
        status: "running",
        dockerImage: runtimeResult.image,
        storefrontContainerName: runtimeResult.storefrontContainerName,
        medusaContainerName: runtimeResult.medusaContainerName ?? null,
        commerceEngine: siteRow.siteType === "ecommerce" ? "medusa" : "static",
        sqlContainerName: runtimeResult.sqlContainerName,
        runtimeServerId: resolvedRuntimeServer?.id ?? "local",
        runtimeHost: resolvedRuntimeServer?.hostname ?? "local",
        routeProvider: runtimeResult.routeProvider,
        provisionedAt: now.toISOString(),
        publicUrl: runtimeResult.publicUrl,
      }),
      updatedAt: now,
    })
    .where(eq(website.id, websiteId))
    .returning();
  await db
    .update(websiteStore)
    .set({
      status: provisionedStoreStatus,
      updatedAt: now,
    })
    .where(eq(websiteStore.id, storeRow.id));
  if (databaseRow) {
    await db
      .update(websiteStoreDatabase)
      .set({
        status: "running",
        host: resolvedRuntimeServer ? databaseRow.containerName : databaseRow.host,
        updatedAt: now,
      })
      .where(eq(websiteStoreDatabase.id, databaseRow.id));
  }
  if (resolvedRuntimeServer && !resolvedRuntimeServer.id.startsWith("runtime_env_")) {
    await db
      .update(websiteRuntimeServer)
      .set({
        activeSiteCount: sql`${websiteRuntimeServer.activeSiteCount} + 1`,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(websiteRuntimeServer.id, resolvedRuntimeServer.id));
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
      runtimeServerId: resolvedRuntimeServer?.id ?? "local",
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
    const database = store ? (databases.find((row) => row.storeId === store.id) ?? null) : null;
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

async function getUserWebsiteDetail(userId: string, websiteId: string, actingAsAdmin = false) {
  const site = await db.query.website.findFirst({
    where: eq(website.id, websiteId),
  });
  if (!site || (!actingAsAdmin && site.userId !== userId)) return null;

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
        db.query.websiteStoreDatabase.findFirst({
          where: eq(websiteStoreDatabase.storeId, store.id),
        }),
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
    ? await db.query.storeProductVariant.findMany({
        where: eq(storeProductVariant.storeId, store.id),
      })
    : [];
  const provisioningPlan = safeJsonParse(site.provisioningPlan);
  const medusaProducts =
    site.siteType === "ecommerce" && site.containerStatus === "running"
      ? await fetchMedusaProductsForWebsite(site).catch(() => null)
      : null;
  const resolvedProducts =
    medusaProducts ??
    products.map((product) => ({
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
      paidRevenue: payments
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + payment.amount, 0),
      pluginCount: plugins.length,
    },
  };
}

async function fetchMedusaProductsForWebsite(site: typeof website.$inferSelect) {
  const baseUrl = site.temporaryDomain || site.primaryDomain;
  if (!baseUrl) return [];
  const response = await fetch(`https://${baseUrl}/api/cloudmonkey/admin/products`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Medusa product fetch failed: ${response.status}`);
  const data = (await response.json()) as any;
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

async function createMedusaProductForWebsite(
  site: typeof website.$inferSelect,
  body: z.infer<typeof storeProductCreateSchema>,
) {
  const baseUrl = site.temporaryDomain || site.primaryDomain;
  if (!baseUrl) throw new Error("Website has no domain for Medusa API");
  const response = await fetch(`https://${baseUrl}/api/cloudmonkey/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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
  if (!response.ok)
    throw new Error(`Medusa product create failed: ${response.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
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
      metadata: input.metadata ? stripPiiJson(input.metadata) : null,
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

  const [created] = await db
    .insert(workspaceSettings)
    .values({
      id: "default",
      workspaceName: "CloudMonkey Workspace",
    })
    .onConflictDoNothing()
    .returning();

  return (
    created ??
    (await db.query.workspaceSettings.findFirst({
      where: eq(workspaceSettings.id, "default"),
    }))
  );
}

function formatEmailMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency })
    .format(cents / 100)
    .replace("ZAR", "ZAR ");
}

function formatEmailDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
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

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function safeServiceDefinition(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function renderAgreementSnapshot(input: {
  template: typeof agreementTemplate.$inferSelect;
  productName: string;
  productType: string;
  productId: string;
  serviceDefinition: unknown;
}) {
  return JSON.stringify(
    {
      templateId: input.template.id,
      templateVersion: input.template.version,
      title: input.template.title,
      productType: input.productType,
      productId: input.productId,
      productName: input.productName,
      serviceDefinition: input.serviceDefinition,
      body: input.template.body,
      renderedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

async function agreementRequirementForProduct(input: {
  productType: "plan" | "bundle";
  productId: string;
  productName: string;
  serviceDefinition: unknown;
}) {
  const mapping = await db.query.agreementTemplateSku.findFirst({
    where: and(
      eq(agreementTemplateSku.productType, input.productType),
      eq(agreementTemplateSku.productId, input.productId),
      eq(agreementTemplateSku.required, true),
    ),
    with: { template: true },
  });
  const template = mapping?.template;
  if (!mapping || !template || template.status !== "active") return null;
  const documentSnapshot = renderAgreementSnapshot({
    template,
    productName: input.productName,
    productType: input.productType,
    productId: input.productId,
    serviceDefinition: input.serviceDefinition,
  });
  const documentHash = sha256(documentSnapshot);
  return {
    mapping,
    template,
    documentSnapshot,
    documentHash,
    consentText: `I accept ${template.title} version ${template.version} for ${input.productName}.`,
  };
}

async function signedAgreementExists(input: {
  userId: string;
  subscriptionId?: string | null;
  templateId: string;
  documentHash: string;
  productType: string;
  productId: string;
}) {
  const row = await db.query.signedAgreement.findFirst({
    where: and(
      eq(signedAgreement.userId, input.userId),
      eq(signedAgreement.templateId, input.templateId),
      eq(signedAgreement.documentHash, input.documentHash),
      eq(signedAgreement.productType, input.productType),
      eq(signedAgreement.productId, input.productId),
    ),
  });
  if (!row) return false;
  if (!input.subscriptionId || row.subscriptionId === input.subscriptionId) return true;
  return true;
}

async function signAgreementForSubscription(input: {
  request: Request;
  userId: string;
  subscriptionId: string;
  productType: "plan" | "bundle";
  productId: string;
  productName: string;
  serviceDefinition: unknown;
  consentText?: string | null;
}) {
  const requirement = await agreementRequirementForProduct(input);
  if (!requirement) return null;
  const alreadySigned = await signedAgreementExists({
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    templateId: requirement.template.id,
    documentHash: requirement.documentHash,
    productType: input.productType,
    productId: input.productId,
  });
  if (!alreadySigned) {
    await db.insert(signedAgreement).values({
      id: makeId("agr"),
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      templateId: requirement.template.id,
      templateVersion: requirement.template.version,
      productType: input.productType,
      productId: input.productId,
      documentHash: requirement.documentHash,
      consentText: input.consentText || requirement.consentText,
      documentSnapshot: requirement.documentSnapshot,
      ipAddress: clientIp(input.request),
      userAgent: input.request.headers.get("user-agent"),
      signedAt: new Date(),
    });
  }
  await db
    .update(subscription)
    .set({
      agreementSigned: true,
      agreementSignedAt: new Date(),
      requiredAgreementTemplateId: requirement.template.id,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
  return requirement;
}

async function requireSignedAgreementForSubscription(row: typeof subscription.$inferSelect) {
  const productType = row.planId ? "plan" : row.bundleId ? "bundle" : null;
  const productId = row.planId ?? row.bundleId;
  if (!productType || !productId) return;
  const product =
    productType === "plan"
      ? await db.query.servicePlan.findFirst({
          where: eq(servicePlan.id, productId),
          with: { service: true },
        })
      : await db.query.bundle.findFirst({ where: eq(bundle.id, productId) });
  if (!product) return;
  const productName =
    productType === "plan"
      ? `${"service" in product ? (product.service?.name ?? "Service") : "Service"} - ${product.name}`
      : product.name;
  const requirement = await agreementRequirementForProduct({
    productType,
    productId,
    productName,
    serviceDefinition: safeServiceDefinition(product.serviceDefinition),
  });
  if (!requirement) return;
  const hasSigned =
    row.agreementSigned ||
    (await signedAgreementExists({
      userId: row.userId,
      subscriptionId: row.id,
      templateId: requirement.template.id,
      documentHash: requirement.documentHash,
      productType,
      productId,
    }));
  if (!hasSigned) {
    const error: any = new Error("Required service agreement must be signed before provisioning");
    error.status = 428;
    error.agreementRequired = {
      templateId: requirement.template.id,
      version: requirement.template.version,
      title: requirement.template.title,
      productType,
      productId,
    };
    throw error;
  }
}

async function getInvoiceDocumentPayload(
  invoiceId: string,
  activeSession: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
  origin: string,
) {
  const row = await db.query.invoice.findFirst({
    where: eq(invoice.id, invoiceId),
  });

  if (!row || (row.userId !== activeSession.user.id && !isAdmin(activeSession))) {
    return null;
  }
  if (row.status === "draft" && !isAdmin(activeSession)) {
    return null;
  }

  const [items, payments, customer, settings] = await Promise.all([
    db.query.invoiceItem.findMany({ where: eq(invoiceItem.invoiceId, row.id) }),
    db.query.invoicePayment.findMany({
      where: eq(invoicePayment.invoiceId, row.id),
      orderBy: (invoicePayment, { desc }) => [desc(invoicePayment.createdAt)],
    }),
    db.query.user.findFirst({ where: eq(user.id, row.userId) }),
    getWorkspaceSettings(),
  ]);
  const document = buildInvoiceDocumentData({
    invoice: row,
    items,
    payments,
    customer,
    workspaceSettings: settings,
  });

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
    await page.setContent(renderInvoiceHtml(document, { document: true, pdf: true }), {
      waitUntil: "networkidle",
    });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
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

async function hasIntelligenceAccess(
  activeSession: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
) {
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
      response: json(
        {
          error: "An active CloudMonkey subscription is required to use Competitor Intelligence",
          code: "subscription_required",
        },
        402,
      ),
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
    const fallback = urlString
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .replace(/^www\./, "");
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
  const hasSearchConsoleScope = scopes.some(
    (scope) =>
      scope === "https://www.googleapis.com/auth/webmasters" ||
      scope === "https://www.googleapis.com/auth/webmasters.readonly",
  );
  if (!hasSearchConsoleScope) return null;

  const now = new Date();
  const accessTokenFresh =
    accountRow.accessToken &&
    (!accountRow.accessTokenExpiresAt ||
      accountRow.accessTokenExpiresAt.getTime() > now.getTime() + 60_000);
  if (accessTokenFresh) {
    return { account: accountRow, accessToken: accountRow.accessToken!, scopes };
  }

  if (!accountRow.refreshToken) {
    return {
      account: accountRow,
      accessToken: accountRow.accessToken ?? null,
      scopes,
      needsReconnect: true,
    };
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
    return {
      account: accountRow,
      accessToken: accountRow.accessToken ?? null,
      scopes,
      needsReconnect: true,
    };
  }

  const expiresIn = Number(tokenBody.expires_in ?? 3600);
  const refreshedAt = new Date();
  await db
    .update(account)
    .set({
      accessToken: tokenBody.access_token,
      accessTokenExpiresAt: new Date(refreshedAt.getTime() + expiresIn * 1000),
      refreshToken: tokenBody.refresh_token ?? accountRow.refreshToken,
      scope: tokenBody.scope ? String(tokenBody.scope) : accountRow.scope,
      updatedAt: refreshedAt,
    })
    .where(eq(account.id, accountRow.id));

  return {
    account: accountRow,
    accessToken: String(tokenBody.access_token),
    scopes,
  };
}

async function fetchGoogleSearchConsoleSnapshot(userId: string, websiteUrl: string) {
  const googleAccount = await getGoogleSearchConsoleAccount(userId);
  if (!googleAccount?.accessToken) {
    return {
      connected: false as const,
      reason: googleAccount?.needsReconnect ? "reconnect_required" : "not_connected",
    };
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
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      String(value ?? "").toLowerCase(),
    ]),
  );

  const signals: string[] = [];
  const checks: Array<[string, boolean]> = [
    [
      "WordPress",
      lowerHtml.includes("wp-content") ||
        lowerHtml.includes("wordpress") ||
        lowerHtml.includes("elementor"),
    ],
    ["Shopify", lowerHtml.includes("cdn.shopify.com") || lowerHtml.includes("shopify")],
    ["Webflow", lowerHtml.includes("webflow") || lowerHtml.includes("w-webflow")],
    ["Wix", lowerHtml.includes("wix.com") || lowerHtml.includes("_wix")],
    ["Squarespace", lowerHtml.includes("squarespace")],
    ["Next.js", lowerHtml.includes("__next") || lowerHtml.includes("/_next/")],
    ["Vite", lowerHtml.includes("vite") || lowerHtml.includes("/@vite/")],
    [
      "React",
      lowerHtml.includes("react") && (lowerHtml.includes("root") || lowerHtml.includes("hydrate")),
    ],
    [
      "Google Tag Manager",
      lowerHtml.includes("gtm.js") || lowerHtml.includes("googletagmanager.com"),
    ],
    ["Meta Pixel", lowerHtml.includes("connect.facebook.net") || lowerHtml.includes("fbq(")],
    [
      "Cloudflare",
      lowerHeaders["server"]?.includes("cloudflare") || Boolean(lowerHeaders["cf-ray"]),
    ],
    ["Vercel", Boolean(lowerHeaders["x-vercel-id"]) || lowerHtml.includes("vercel")],
    ["WordPress CDN", lowerHtml.includes("wp-content") && lowerHtml.includes("cdn")],
  ];

  for (const [label, matched] of checks) {
    if (matched) signals.push(label);
  }

  const generatorMatch = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i,
  );
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
    const h1 = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => null);
    const h2Count = await page
      .locator("h2")
      .count()
      .catch(() => 0);
    const internalLinkCount = await page
      .locator('a[href^="/"], a[href^="./"], a[href^="../"], a[href^="#"]')
      .count()
      .catch(() => 0);
    const externalLinkCount = await page
      .locator('a[href^="http"]')
      .count()
      .catch(() => 0);
    const imageMissingAltCount = await page
      .locator("img:not([alt]), img[alt='']")
      .count()
      .catch(() => 0);
    const metaDescription =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      null;
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
    const schemaMatches =
      html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) ?? [];
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
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
      orderBy: (intelligenceKeywordRanking, { desc }) => [
        desc(intelligenceKeywordRanking.observedAt),
      ],
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
      orderBy: (intelligenceRecommendation, { desc }) => [
        desc(intelligenceRecommendation.createdAt),
      ],
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
    rankings: rankings.map((row) => ({
      ...row,
      serpFeatures: safeJsonParse(row.serpFeatures),
      raw: safeJsonParse(row.raw),
    })),
    jobs: jobs.map((row) => ({
      ...row,
      input: safeJsonParse(row.input),
      output: safeJsonParse(row.output),
    })),
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
      dataForSeoConfigured: Boolean(
        process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
      ),
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
    throw new Error(
      `n8n competitor intelligence webhook failed: ${response.status} ${responseText}`,
    );
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
  const provided =
    request.headers.get("x-cloudmonkey-webhook-secret") ??
    request.headers.get("x-cloudmonkey-secret");
  return provided === expected;
}

async function sendN8nAdminChat(input: {
  sessionId: string;
  message: string;
  contextType?: string | null;
  contextId?: string | null;
  conversationHistory: Array<Record<string, unknown>>;
  user: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl = process.env.N8N_ADMIN_AGENT_WEBHOOK_URL;
  const webhookSecret =
    process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET ?? process.env.N8N_EMAIL_WEBHOOK_SECRET;
  const cloudMonkeyApiToken =
    process.env.CLOUDMONKEY_API_TOKEN ?? process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new Error("Admin agent workflow is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      ...(cloudMonkeyApiToken ? { "X-CloudMonkey-API-Token": cloudMonkeyApiToken } : {}),
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(
      stripPii({
        event: "admin.chat.message",
        ...input,
      }),
    ),
  });

  const responseText = await response.text();
  console.log("n8n admin agent response status:", response.status, "body:", responseText);
  if (!response.ok) {
    throw new Error(`n8n admin agent webhook failed: ${response.status} ${responseText}`);
  }

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    return {
      reply: responseText || "I could not parse the admin assistant response.",
    };
  }
}

const ADMIN_CHAT_HISTORY_LIMIT = 30;

async function resolveAdminChatSession(userId: string, requestedSessionId?: string | null) {
  if (requestedSessionId) {
    const requestedSession = await db.query.adminChatSession.findFirst({
      where: eq(adminChatSession.id, requestedSessionId),
    });
    if (requestedSession) {
      if (requestedSession.userId !== userId) {
        return null;
      }
      return requestedSession;
    }
  }

  const latestOpenSession = await db.query.adminChatSession.findFirst({
    where: and(eq(adminChatSession.userId, userId), eq(adminChatSession.status, "open")),
    orderBy: (adminChatSession, { desc }) => [desc(adminChatSession.updatedAt)],
  });
  if (latestOpenSession) {
    return latestOpenSession;
  }

  const [createdSession] = await db
    .insert(adminChatSession)
    .values({
      id: makeId("adminchat"),
      userId,
      status: "open",
    })
    .returning();
  return createdSession;
}

async function loadAdminChatHistory(sessionId: string, limit = ADMIN_CHAT_HISTORY_LIMIT) {
  const rows = await db.query.adminChatMessage.findMany({
    where: eq(adminChatMessage.sessionId, sessionId),
    orderBy: (adminChatMessage, { desc }) => [
      desc(adminChatMessage.createdAt),
      desc(adminChatMessage.id),
    ],
    limit,
  });

  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    metadata: safeJsonParse(row.metadata),
  }));
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
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

function sanitizeCssColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function buildWebsitePreviewHtml(concept: WebsiteDesignConcept, input: WebsiteDesignPreviewInput) {
  const businessName = input.website.businessName || input.website.name || "CloudMonkey Store";
  const siteType = input.website.siteType === "website" ? "website" : "ecommerce";
  const industry = input.website.industry || input.onboardingAnswers?.industry || "online business";
  const domain =
    input.website.temporaryDomain ||
    input.website.domain ||
    `${
      String(businessName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "store"
    }.cloudmonkey.co.za`;
  const styleLabel = concept.styleLabel || "Website Concept";
  const headline =
    concept.headline ||
    (siteType === "ecommerce" ? `${businessName} online store` : `${businessName} website`);
  const subheadline =
    concept.subheadline ||
    `A complete ${industry} experience designed for discovery, trust, and conversion.`;
  const primary = sanitizeCssColor(concept.primaryColor, "#1369e8");
  const secondary = sanitizeCssColor(concept.secondaryColor, "#10b981");
  const accent = sanitizeCssColor(concept.accentColor, "#f59e0b");
  const background = sanitizeCssColor(concept.backgroundColor, "#f6f8fc");
  const sections = concept.sections?.length
    ? concept.sections.slice(0, 4)
    : ["Hero", "Products", "Trust", "Contact"];
  const pageSections = Array.isArray(concept.designManifest?.pageSections)
    ? concept.designManifest.pageSections
    : sections;
  const productMode = siteType === "ecommerce";
  if (
    productMode &&
    (concept.designManifest?.templateKey === "fashion-retail-editorial" ||
      concept.designManifest?.layoutPreset === "fashion-retail-editorial")
  ) {
    return buildFashionRetailPreviewHtml({
      businessName,
      industry,
      domain,
      concept,
      headline,
      subheadline,
      primary,
      secondary,
      accent,
      background,
    });
  }
  const sampleProducts = productMode
    ? ["Signature Product", "Customer Favourite", "New Arrival"]
    : ["Strategy", "Implementation", "Support"];
  const sectionCards = pageSections
    .slice(0, 4)
    .map(
      (section: string, index: number) => `
    <article class="section-card">
      <div class="section-number">0${index + 1}</div>
      <h3>${escapeHtml(
        String(section)
          .replace(/([A-Z])/g, " $1")
          .trim(),
      )}</h3>
      <p>${productMode ? "Configured for product discovery, basket growth, and easy checkout." : "Built to explain the offer clearly and turn visitors into leads."}</p>
    </article>
  `,
    )
    .join("");
  const catalogueCards = sampleProducts
    .map(
      (item, index) => `
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
  `,
    )
    .join("");

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
  const categories = [
    "New Arrivals",
    "Women",
    "Men",
    "Trendings",
    "Bags",
    "Accessories",
    "Lookbook",
    "Footwear",
  ];
  const products = [
    "Linen Shirt",
    "Classic Dress",
    "Summer Top",
    "Mini Dress",
    "Utility Jacket",
    "Beach Tote",
    "Denim Shorts",
    "Fitted Top",
  ];
  const categoryCards = categories
    .map(
      (category, index) =>
        `<a class="cat cat-${index + 1}"><span>Shop</span><strong>${escapeHtml(category)}</strong></a>`,
    )
    .join("");
  const productCards = products
    .map(
      (product, index) =>
        `<article class="product"><div class="pimg pimg-${index + 1}"></div><small>${index % 3 === 0 ? "On sale" : "New"}</small><strong>${escapeHtml(product)}</strong><span>R${[399, 549, 299, 699, 899, 459, 349, 279][index]}</span></article>`,
    )
    .join("");
  const railProductCards = products
    .slice(0, 6)
    .map(
      (product, index) =>
        `<article class="product"><div class="pimg pimg-${index + 1}"></div><small>${index % 3 === 0 ? "On sale" : "New"}</small><strong>${escapeHtml(product)}</strong><span>R${[399, 549, 299, 699, 899, 459][index]}</span></article>`,
    )
    .join("");
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
      designManifest: {
        theme: "modern-premium",
        pageSections: ["hero", "featuredProducts", "trust", "contact"],
        plugins: ["cloudmonkey-paystack-gateway", "basic-seo"],
      },
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
      designManifest: {
        theme: "bold-commerce",
        pageSections: ["categories", "bestSellers", "offers", "checkout"],
        plugins: ["cloudmonkey-paystack-gateway"],
      },
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
      designManifest: {
        theme: "editorial-service",
        pageSections: ["storyHero", "services", "shop", "reviews"],
        plugins: ["basic-seo", "whatsapp-chat"],
      },
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
      designManifest: {
        theme: "compact-conversion",
        pageSections: ["hero", "products", "offers", "faq"],
        plugins: ["cloudmonkey-paystack-gateway", "basic-seo"],
      },
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
        sections: [
          "Hero sale",
          "Category mosaic",
          "New products",
          "Collections",
          "Hot products",
          "Lookbook",
          "Instagram",
        ],
        designManifest: {
          templateKey: "fashion-retail-editorial",
          layoutPreset: "fashion-retail-editorial",
          theme: "fashion-retail-editorial",
          industry,
          headline: "Summer Flash Sale",
          subheadline: `A full ecommerce homepage for ${industry} with premium product discovery and secure checkout.`,
          categories: ["New Arrivals", "Women", "Men", "Bags", "Accessories", "Footwear"],
          pageSections: [
            "promoBar",
            "hero",
            "offerStrip",
            "categoryMosaic",
            "newProducts",
            "collections",
            "saleTicker",
            "hotProducts",
            "videoShoppable",
            "lookbook",
            "testimonials",
            "instagram",
            "benefits",
          ],
          requiredPages: REQUIRED_ECOMMERCE_PAGES.map((page) => page.slug),
          plugins: ["cloudmonkey-paystack-gateway", "basic-seo", "whatsapp-chat"],
        },
      },
      ...concepts.slice(0, 3),
    ];
  }
  return concepts;
}

async function renderWebsiteDesignOptionsAsPng(
  concepts: WebsiteDesignConcept[],
  input: WebsiteDesignPreviewInput,
) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const rendered = [];
    for (const [index, concept] of concepts.slice(0, 4).entries()) {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 1500 },
        deviceScaleFactor: 1,
      });
      try {
        await page.setContent(buildWebsitePreviewHtml(concept, input), {
          waitUntil: "networkidle",
        });
        const png = await page.screenshot({ type: "png", fullPage: true });
        const imageUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
        rendered.push({
          ...concept,
          styleLabel: concept.styleLabel || `Concept ${index + 1}`,
          imageUrl,
          thumbnailUrl: imageUrl,
          imagePrompt:
            concept.imagePrompt ||
            `${concept.styleLabel || `Concept ${index + 1}`} full website PNG preview`,
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

async function normalizeWebsiteDesignOptionsAsPng(
  options: WebsiteDesignConcept[],
  input: WebsiteDesignPreviewInput,
) {
  const fallbackConcepts = buildWebsiteDesignConcepts(input);
  const concepts = options.slice(0, 4).map((option, index) => {
    const fallback = fallbackConcepts[index] ?? fallbackConcepts[0];
    const manifest =
      typeof option.designManifest === "object" && option.designManifest
        ? option.designManifest
        : fallback.designManifest;
    return {
      ...fallback,
      ...option,
      designManifest: manifest,
      styleLabel: option.styleLabel || fallback.styleLabel || `Concept ${index + 1}`,
      headline: option.headline || manifest?.headline || fallback.headline,
      subheadline:
        option.subheadline || manifest?.subheadline || option.imagePrompt || fallback.subheadline,
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
      designManifest: {
        theme: "modern-premium",
        pageSections: ["hero", "featuredProducts", "trust", "contact"],
        plugins: ["cloudmonkey-paystack-gateway", "basic-seo"],
      },
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
      designManifest: {
        theme: "bold-commerce",
        pageSections: ["categories", "bestSellers", "offers", "checkout"],
        plugins: ["cloudmonkey-paystack-gateway"],
      },
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
      designManifest: {
        theme: "editorial-service",
        pageSections: ["storyHero", "services", "shop", "reviews"],
        plugins: ["basic-seo", "whatsapp-chat"],
      },
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
      designManifest: {
        theme: "compact-conversion",
        pageSections: ["hero", "products", "offers", "faq"],
        plugins: ["cloudmonkey-paystack-gateway", "basic-seo"],
      },
    },
  ];

  const escapeXml = (value: string) =>
    value.replace(
      /[&<>"]/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
    );
  return concepts.map((concept, index) => {
    const sectionCards = concept.sections
      .map(
        (section, sectionIndex) => `
      <rect x="${72 + sectionIndex * 146}" y="330" width="118" height="74" rx="10" fill="white" opacity="0.92"/>
      <text x="${92 + sectionIndex * 146}" y="371" font-size="14" font-family="Inter,Arial" font-weight="700" fill="#111827">${escapeXml(section)}</text>
    `,
      )
      .join("");
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
  const webhookSecret =
    process.env.N8N_WEBSITE_DESIGN_WEBHOOK_SECRET ?? process.env.N8N_EMAIL_WEBHOOK_SECRET;
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
    const rawOptions =
      Array.isArray(parsed.options) && parsed.options.length
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
      avoid: [
        "full repository prompts",
        "raw source dumps",
        "per-customer app generation",
        "paid image generation unless explicitly requested",
      ],
      maxConcepts: 4,
      maxOutputTokens: 3600,
    },
    modelPolicy: {
      defaultModel: process.env.GEMINI_WEBSITE_DESIGN_MODEL ?? "gemini-2.5-pro",
      fallbackModel: process.env.GEMINI_WEBSITE_DESIGN_FALLBACK_MODEL ?? "gemini-2.5-flash",
      useAdvancedModelFor: [
        "requirements synthesis",
        "theme direction",
        "component selection",
        "final build manifest",
      ],
      useRendererFor: ["PNG previews", "layout screenshots", "repeatable visual output"],
    },
    repositories: [
      {
        key: "cloudmonkey-website-template",
        type: "website",
        useWhen: "Brochure, service, booking, lead generation, portfolio, contact-heavy sites.",
        components: [
          "site-header",
          "hero-split",
          "hero-centered",
          "service-grid",
          "gallery-grid",
          "lead-form",
          "reviews",
          "faq",
          "footer",
        ],
      },
      {
        key: "cloudmonkey-commerce-template",
        type: "ecommerce",
        useWhen:
          "Stores needing products, inventory, orders, customers, checkout, POS, delivery, and payments.",
        components: [
          "commerce-header",
          "commerce-hero",
          "category-grid",
          "product-grid",
          "featured-products",
          "cart-summary",
          "checkout-panel",
          "inventory-alerts",
          "reviews",
          "footer",
        ],
        layoutPresets: [
          {
            key: "fashion-retail-editorial",
            useWhen:
              "Fashion, apparel, accessories, beauty, lifestyle retail, boutiques, and image-led ecommerce.",
            sections: [
              "promoBar",
              "hero",
              "offerStrip",
              "categoryMosaic",
              "newProducts",
              "collections",
              "saleTicker",
              "hotProducts",
              "videoShoppable",
              "lookbook",
              "testimonials",
              "instagram",
              "benefits",
            ],
          },
        ],
      },
      {
        key: "cloudmonkey-plugin-registry",
        type: "plugins",
        useWhen: "Only select approved plugins from this registry.",
        components: [
          "cloudmonkey-paystack-gateway",
          "customer-paystack-gateway",
          "local-delivery",
          "store-pickup",
          "whatsapp-chat",
          "seo-basic",
          "google-analytics",
          "facebook-pixel",
          "pos-basic",
        ],
      },
    ],
    requiredManifestShape: {
      siteType: isEcommerce ? "ecommerce" : "website",
      templateKey: isEcommerce
        ? "Use approved layout preset keys such as fashion-retail-editorial when appropriate."
        : "Use approved website template keys.",
      theme: [
        "style",
        "primaryColor",
        "secondaryColor",
        "accentColor",
        "backgroundColor",
        "fontPairing",
        "density",
      ],
      pages: isEcommerce
        ? REQUIRED_ECOMMERCE_PAGES.map((page) => page.slug)
        : ["slug", "template", "sections"],
      plugins: "approved plugin keys only",
      notes: "short implementation notes for CloudMonkey provisioner",
    },
  };
}

function readWebsiteDesignInputs(site: typeof website.$inferSelect) {
  const requirementManifest = safeJsonParse(site.requirementManifest);
  if (
    requirementManifest &&
    typeof requirementManifest === "object" &&
    !Array.isArray(requirementManifest)
  ) {
    const designInputs = (requirementManifest as Record<string, any>).designInputs;
    if (designInputs && typeof designInputs === "object" && !Array.isArray(designInputs)) {
      return designInputs as Record<string, any>;
    }
  }
  return {};
}

function buildBasicWebsiteManifest(site: typeof website.$inferSelect) {
  const onboardingAnswers = safeJsonParse(site.onboardingAnswers);
  const requirementManifest = safeJsonParse(site.requirementManifest);
  const designInputs = readWebsiteDesignInputs(site);
  const businessName = site.businessName || site.name || "CloudMonkey Website";
  const industry =
    site.industry || stringValue((onboardingAnswers as any)?.industry, "business services");
  const contentNotes = stringValue(
    designInputs.contentNotes || (onboardingAnswers as any)?.goals || site.businessDescription,
    `A professional ${industry} website for ${businessName}.`,
  );
  const mustHaveSections = listValues(
    String(designInputs.mustHaveSections || "")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    ["Services", "Process", "Testimonials"],
  );
  const uploadedAssets = Array.isArray(designInputs.assets) ? designInputs.assets : [];

  return {
    source: "admin_basic_runtime",
    generatedAt: new Date().toISOString(),
    templateKey: site.siteType === "ecommerce" ? "standard-commerce" : "managed-service-website",
    theme: "cloudmonkey-basic",
    headline: businessName,
    subheadline: contentNotes,
    industry,
    targetAudience: stringValue(
      (onboardingAnswers as any)?.targetCustomers,
      "South African customers",
    ),
    tone: stringValue(designInputs.preferredStyle, "Professional, helpful and trustworthy"),
    pageSections: mustHaveSections,
    imagePrompt: uploadedAssets.length
      ? `Use uploaded reference images and content to design ${businessName}`
      : `Professional website photography for ${businessName}`,
    uploadedAssets,
    adminDesignInputs: designInputs,
    requirementManifest,
    onboardingAnswers,
  };
}

async function sendN8nBasicWebsiteBuild(input: {
  site: typeof website.$inferSelect;
  store: typeof websiteStore.$inferSelect;
  database?: typeof websiteStoreDatabase.$inferSelect | null;
  buildManifest: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const webhookUrl =
    process.env.N8N_WEBSITE_BASIC_BUILD_WEBHOOK_URL ?? process.env.N8N_WEBSITE_DEPLOY_WEBHOOK_URL;
  const webhookSecret =
    process.env.N8N_WEBSITE_BASIC_BUILD_WEBHOOK_SECRET ??
    process.env.N8N_WEBSITE_DESIGN_WEBHOOK_SECRET ??
    process.env.N8N_EMAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    return { ok: true, workflow: "local-basic-manifest", buildManifest: input.buildManifest };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudMonkey-Webhook-Secret": webhookSecret,
      "X-CloudMonkey-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      event: "website.basic_runtime.requested",
      website: input.site,
      store: input.store,
      database: input.database
        ? {
            id: input.database.id,
            engine: input.database.engine,
            databaseName: input.database.databaseName,
            containerName: input.database.containerName,
          }
        : null,
      buildManifest: input.buildManifest,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`n8n website basic runtime webhook failed: ${response.status} ${responseText}`);
    return {
      ok: true,
      workflow: "local-basic-manifest",
      warning: `n8n website basic runtime webhook failed: ${response.status}`,
      buildManifest: input.buildManifest,
    };
  }

  try {
    const parsed = responseText ? JSON.parse(responseText) : {};
    const manifest = parsed.buildManifest || parsed.designManifest || parsed.manifest || parsed;
    return {
      ok: true,
      workflow: parsed.workflow || "n8n-basic-runtime",
      buildManifest:
        manifest && typeof manifest === "object" && !Array.isArray(manifest)
          ? { ...input.buildManifest, ...(manifest as Record<string, unknown>) }
          : input.buildManifest,
    };
  } catch (error) {
    return {
      ok: true,
      workflow: "local-basic-manifest",
      warning: "n8n website basic runtime response was not valid JSON",
      buildManifest: input.buildManifest,
    };
  }
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
    .replace(/\b(?:sk|pk|api|key|token|secret|password)[_:=\s-]+[A-Za-z0-9_.-]{8,}/gi, "[secret]")
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        content: { parts: [{ text: redactSupportKnowledge(text) }] },
        taskType,
        outputDimensionality: SUPPORT_RAG_DIMENSIONS,
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Gemini embedding failed: ${response.status} ${body.error?.message ?? ""}`.trim(),
    );
  }
  const values = body.embedding?.values ?? body.embeddings?.[0]?.values;
  return Array.isArray(values) ? values.map((value: unknown) => Number(value)) : null;
}

async function generateGeminiText(
  prompt: string,
  systemInstruction?: string,
  usageContext?: { userId?: string | null; featureKey?: string },
): Promise<string> {
  const storedCredential = await db.query.platformApiCredential.findFirst({
    where: (row: any, operators: any) => and(eq(row.provider, "gemini"), eq(row.status, "active")),
    orderBy: (row: any, operators: any) => [operators.desc(row.createdAt)],
  });
  const apiKey = storedCredential
    ? decryptSecret(storedCredential.keyEncrypted)
    : process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured");

  const model = "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
      }),
    },
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini generation failed: ${response.status} ${body.error?.message ?? ""}`);
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini");
  const usage = body.usageMetadata ?? {};
  const [usageRow] = await recordPlatformApiUsage({
    db,
    makeId,
    platformApiUsage,
    credentialId: storedCredential?.id ?? null,
    userId: usageContext?.userId ?? null,
    provider: "gemini",
    model,
    featureKey: usageContext?.featureKey ?? "gemini_generation",
    inputTokens: Number(usage.promptTokenCount ?? 0),
    outputTokens: Number(usage.candidatesTokenCount ?? 0),
  });
  if (usageContext?.userId && usageRow) {
    await chargePlatformUsage({
      db,
      makeId,
      tokenWallet,
      tokenWalletLedger,
      userId: usageContext.userId,
      usageId: usageRow.id,
      featureKey: usageContext.featureKey ?? "gemini_generation",
      chargedTokens: usageRow.chargedTokens,
    });
  }
  return text;
}

async function tryRegisterPaidDomainOrder(
  order: typeof domainOrder.$inferSelect,
  requestUrl: string,
) {
  return registerPaidDomainOrder(
    {
      db,
      makeId,
      recordAudit,
      registeredDomain,
      domainOrder,
      supportTicket,
    },
    order,
    requestUrl,
  );
}

async function createDomainRegistrationTicket(
  order: typeof domainOrder.$inferSelect,
  errorMessage: string,
  requestUrl: string,
) {
  const existing = await db.query.supportTicket.findFirst({
    where: eq(supportTicket.aiSessionId, `domain-order:${order.id}`),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(supportTicket)
    .values({
      id: makeId("ticket"),
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
  const candidates =
    [
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
        expiryDate: parseProviderDate(
          item?.expiryDate ??
            item?.expiresAt ??
            item?.intExDate ??
            item?.expiry ??
            item?.renewalDate,
        ),
        raw: item,
      };
    })
    .filter((item): item is ProviderDomain => !!item);
}

function getAssignedUserMap<T extends { id: string; userId: string }>(
  rows: T[],
  key: (row: T) => string,
) {
  return new Map(rows.map((row) => [key(row), row]));
}

function getRemoteIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function toJsonText(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function toDateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function persistIntelligenceWebhookResult(
  body: z.infer<typeof intelligenceWebhookResultSchema>,
) {
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
    const existing =
      competitorByUrl.get(competitorInput.websiteUrl) ??
      (competitorInput.id
        ? existingCompetitors.find((row) => row.id === competitorInput.id)
        : null);
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
      await db
        .update(intelligenceCompetitor)
        .set(values)
        .where(eq(intelligenceCompetitor.id, existing.id));
      competitorIds.add(existing.id);
    } else {
      const [created] = await db
        .insert(intelligenceCompetitor)
        .values({
          id:
            competitorInput.id && !competitorIds.has(competitorInput.id)
              ? competitorInput.id
              : makeId("intelcomp"),
          projectId: project.id,
          userId: project.userId,
          ...values,
        })
        .returning();
      competitorIds.add(created.id);
      competitorByUrl.set(created.websiteUrl, created);
    }
  }

  const existingKeywords = await db.query.intelligenceKeyword.findMany({
    where: eq(intelligenceKeyword.projectId, project.id),
  });
  const keywordIds = new Set(existingKeywords.map((row) => row.id));

  if (body.rankings.length) {
    await db.insert(intelligenceKeywordRanking).values(
      body.rankings.map((row) => ({
        id: makeId("intelrank"),
        projectId: project.id,
        userId: project.userId,
        keywordId: row.keywordId && keywordIds.has(row.keywordId) ? row.keywordId : null,
        competitorId:
          row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
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
      })),
    );
  }

  if (body.crawlPages.length) {
    await db.insert(intelligenceCrawlPage).values(
      body.crawlPages.map((row) => ({
        id: makeId("intelpage"),
        projectId: project.id,
        jobId: job.id,
        userId: project.userId,
        competitorId:
          row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
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
      })),
    );
  }

  const auditIds = new Set<string>();
  if (body.audits.length) {
    for (const row of body.audits) {
      const [created] = await db
        .insert(intelligenceSeoAudit)
        .values({
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
        })
        .returning();
      auditIds.add(created.id);
    }
  }

  if (body.issues.length) {
    await db.insert(intelligencePageIssue).values(
      body.issues.map((row) => ({
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
      })),
    );
  }

  if (body.contentGaps.length) {
    await db.insert(intelligenceContentGap).values(
      body.contentGaps.map((row) => ({
        id: makeId("intelgap"),
        projectId: project.id,
        userId: project.userId,
        competitorId:
          row.competitorId && competitorIds.has(row.competitorId) ? row.competitorId : null,
        gapType: row.gapType,
        title: row.title,
        description: row.description ?? null,
        opportunity: row.opportunity ?? "medium",
        sourceUrl: row.sourceUrl ?? null,
        suggestedAction: row.suggestedAction ?? null,
        status: row.status ?? "open",
      })),
    );
  }

  if (body.serpResults.length) {
    await db.insert(intelligenceSerpResult).values(
      body.serpResults.map((row) => ({
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
      })),
    );
  }

  if (body.recommendations.length) {
    await db.insert(intelligenceRecommendation).values(
      body.recommendations.map((row) => ({
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
      })),
    );
  }

  let report = null;
  if (body.report) {
    const [created] = await db
      .insert(intelligenceReport)
      .values({
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
      })
      .returning();
    report = created;
  }

  const scoreUpdate = Object.fromEntries(
    Object.entries(body.scores).filter(([, value]) => typeof value === "number"),
  ) as Partial<typeof intelligenceProject.$inferInsert>;

  const [updatedProject] = await db
    .update(intelligenceProject)
    .set({
      ...scoreUpdate,
      status: body.status === "completed" ? "active" : project.status,
      lastScanStatus: body.status,
      lastScanAt: body.status === "completed" ? now : project.lastScanAt,
      updatedAt: now,
    })
    .where(eq(intelligenceProject.id, project.id))
    .returning();

  const [updatedJob] = await db
    .update(intelligenceJob)
    .set({
      status: body.status,
      externalRunId: body.externalRunId ?? job.externalRunId,
      error: body.error ?? null,
      output: JSON.stringify(body),
      startedAt: job.startedAt ?? now,
      completedAt: ["completed", "failed", "cancelled"].includes(body.status) ? now : null,
      updatedAt: now,
    })
    .where(eq(intelligenceJob.id, job.id))
    .returning();

  return { project: updatedProject, job: updatedJob, report };
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    trimmed,
  )
    ? trimmed
    : null;
}

function extractDomainCandidates(...values: Array<string | null | undefined>) {
  const domains = new Set<string>();
  for (const value of values) {
    for (const match of String(value ?? "").matchAll(
      /[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi,
    )) {
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
    raw: JSON.stringify({
      source: "cloudmonkey-inferred",
      redirectUrl: httpResult.redirectUrl,
      sslHostnameMatches: ssl.hostnameMatches,
    }),
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

async function probeServerSsl(domain: string): Promise<{
  status: string;
  issuer: string | null;
  expiresAt: string | null;
  hostnameMatches: boolean | null;
}> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, timeout: 6000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const expiresAt = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
        const hostnameError = cert
          ? tls.checkServerIdentity(domain, cert as tls.PeerCertificate)
          : new Error("No certificate");
        resolve({
          status: cert?.valid_to ? "valid" : "unknown",
          issuer: typeof cert?.issuer === "object" ? Object.values(cert.issuer).join(" ") : null,
          expiresAt,
          hostnameMatches: !hostnameError,
        });
      },
    );
    socket.on("error", () =>
      resolve({ status: "error", issuer: null, expiresAt: null, hostnameMatches: null }),
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ status: "timeout", issuer: null, expiresAt: null, hostnameMatches: null });
    });
  });
}

function isPrivateToolHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (["localhost", "localhost.localdomain"].includes(host) || host.endsWith(".local")) return true;
  const version = isIP(host);
  if (version === 4) {
    const octets = host.split(".").map(Number);
    return (
      octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
  return (
    version === 6 &&
    (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"))
  );
}

async function getServersWithTelemetry(userId: string, includeAll: boolean) {
  const instances = await db.query.vultrInstance.findMany({
    ...(includeAll ? {} : { where: eq(vultrInstance.userId, userId) }),
    orderBy: (vultrInstance, { desc }) => [desc(vultrInstance.createdAt)],
  });

  const userIds = [...new Set(instances.map((instance) => instance.userId))];
  const [domains, managedWebsites] = userIds.length
    ? await Promise.all([
        db.query.registeredDomain.findMany({
          ...(includeAll ? {} : { where: eq(registeredDomain.userId, userId) }),
        }),
        db.query.website.findMany({
          ...(includeAll ? {} : { where: eq(website.userId, userId) }),
        }),
      ])
    : [[], []];

  return Promise.all(
    instances.map(async (instance) => {
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

      const [
        latestTelemetry,
        websites,
        containers,
        databases,
        securityFindings,
        aiRuntimes,
        n8nIntegration,
      ] = await Promise.all([
        db.query.serverTelemetrySnapshot.findFirst({
          where: eq(serverTelemetrySnapshot.agentId, agent.id),
          orderBy: (serverTelemetrySnapshot, { desc }) => [
            desc(serverTelemetrySnapshot.observedAt),
          ],
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
      const inferredWebsites = await getInferredWebsitesForInstance(
        instance,
        domains,
        managedWebsites,
        websites,
      );
      const n8nWorkflows = n8nIntegration
        ? await db.query.serverN8nWorkflow.findMany({
            where: eq(serverN8nWorkflow.integrationId, n8nIntegration.id),
            orderBy: (serverN8nWorkflow, { desc }) => [desc(serverN8nWorkflow.workflowUpdatedAt)],
          })
        : [];

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
    }),
  );
}

async function getInferredWebsitesForInstance(
  instance: typeof vultrInstance.$inferSelect,
  domains: Array<typeof registeredDomain.$inferSelect>,
  managedWebsites: Array<typeof website.$inferSelect>,
  discoveredWebsites: Array<typeof serverWebsite.$inferSelect>,
) {
  const alreadyDiscovered = new Set(
    discoveredWebsites.map((site) => normalizeDomain(site.domain)).filter(Boolean),
  );
  const labelDomains = extractDomainCandidates(instance.label);
  const matchedRecordDomains = [
    ...domains
      .filter(
        (domain) =>
          domain.userId === instance.userId && domainTokenMatches(instance.label, domain.id),
      )
      .map((domain) => domain.id),
    ...managedWebsites
      .filter(
        (site) =>
          site.userId === instance.userId && domainTokenMatches(instance.label, site.domain),
      )
      .map((site) => site.domain),
  ]
    .map((domain) => normalizeDomain(domain))
    .filter((domain): domain is string => !!domain);
  const candidates = [...new Set([...labelDomains, ...matchedRecordDomains])].filter(
    (domain) => !alreadyDiscovered.has(domain),
  );
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
      Accept: "application/json",
      "X-N8N-API-KEY": apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`n8n API returned ${response.status}`);
  }

  const payload = await response.json();
  const workflows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const observedAt = new Date();

  await db.delete(serverN8nWorkflow).where(eq(serverN8nWorkflow.integrationId, integration.id));
  if (workflows.length) {
    await db.insert(serverN8nWorkflow).values(
      workflows.map((workflow: any) => ({
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
      })),
    );
  }

  const [updated] = await db
    .update(serverN8nIntegration)
    .set({
      status: "synced",
      lastSyncAt: observedAt,
      lastError: null,
      updatedAt: observedAt,
    })
    .where(eq(serverN8nIntegration.id, integration.id))
    .returning();

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
    .filter(
      (node: any) =>
        String(node?.type ?? "")
          .toLowerCase()
          .includes("trigger") ||
        String(node?.type ?? "")
          .toLowerCase()
          .includes("webhook"),
    )
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
    status:
      runtime.status === "running" || runtime.status === "healthy" ? "active" : runtime.status,
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

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  status: z
    .enum(["pending", "active", "trialing", "past_due", "suspended", "cancelled"])
    .default("pending"),
  amount: z.coerce.number().int().nonnegative(),
  interval: z.enum(["month", "year"]).default("month"),
  minimumTermMonths: z.coerce.number().int().positive().optional().nullable(),
  planId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
  currentPeriodEnd: z.string().optional().nullable(),
});

const manualInvoiceSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).optional(),
  amount: z.coerce.number().int().positive().optional(),
  interval: z.enum(["month", "year"]).default("month"),
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
  paymentMethod: z.enum(["gateway", "eft"]).default("gateway"),
  notes: z.string().optional().nullable(),
  customerCompany: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerVatNumber: z.string().optional().nullable(),
});

const proposalLineSchema = z.object({
  productType: z.enum(["plan", "bundle", "custom"]).default("plan"),
  productId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().int().nonnegative().optional(),
  setupPrice: z.coerce.number().int().nonnegative().optional(),
  recurring: z.coerce.boolean().default(true),
  interval: z.enum(["month", "year"]).default("month"),
});

const invoiceVoidSchema = z.object({
  reason: z.string().optional().nullable(),
});

const manualPaymentCaptureSchema = z.object({
  idempotencyKey: z.string().min(16).max(200),
  amount: z.coerce.number().int().positive().optional().nullable(),
  method: z.enum(["eft", "cash", "manual", "gateway"]).default("eft"),
  reference: z.string().max(160).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

type ManualInvoiceLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  planId?: string | null;
  bundleId?: string | null;
  recurring: boolean;
  interval: "month" | "year";
  websitePackageType?: "website" | "ecommerce" | null;
};

function manualInvoiceSubscriptionId(invoiceId: string, itemId: string) {
  return `sub_${invoiceId}_${itemId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function normalizeManualInvoiceLines(
  body: z.infer<typeof manualInvoiceSchema>,
): ManualInvoiceLineInput[] {
  const rawItems = body.items?.length
    ? body.items
    : [
        {
          description: body.name ?? "Manual CloudMonkey invoice",
          quantity: 1,
          unitPrice: body.amount ?? 0,
          planId: body.planId ?? null,
          bundleId: body.bundleId ?? null,
          recurring: Boolean(body.planId || body.bundleId),
          interval: body.interval,
          websitePackageType: body.websitePackageType ?? null,
        },
      ];
  return rawItems.map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    return {
      description: item.description,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
      planId: item.planId ?? null,
      bundleId: item.bundleId ?? null,
      recurring: Boolean(item.recurring),
      interval: item.interval ?? body.interval,
      websitePackageType: item.websitePackageType ?? null,
    };
  });
}

type ProposalLineInput = z.infer<typeof proposalLineSchema>;
type BillingFrequency = "month" | "year" | "once_off";

type ProposalDocument = {
  proposal: typeof proposal.$inferSelect;
  items: Array<typeof proposalItem.$inferSelect>;
  publicUrl?: string;
  workspaceBilling?: ReturnType<typeof getWorkspaceBillingDetails>;
};

function makeProposalNumber(id: string, issuedAt = new Date()) {
  return `PROP-${issuedAt.getFullYear()}-${id
    .replace(/^prop[_-]?/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
}

function makeInvoiceNumber(id: string, issuedAt = new Date()) {
  return `INV-${issuedAt.getFullYear()}-${id
    .replace(/^inv[_-]?/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
}

function normalizeBillingFrequency(input: {
  billingFrequency?: string | null;
  billingType?: string | null;
  unit?: string | null;
}): BillingFrequency {
  if (
    input.billingFrequency === "once_off" ||
    input.billingFrequency === "year" ||
    input.billingFrequency === "month"
  ) {
    return input.billingFrequency;
  }
  if (input.billingType === "once_off") return "once_off";
  const unit = (input.unit ?? "").toLowerCase();
  if (unit.includes("once")) return "once_off";
  if (unit.includes("year") || unit.includes("annual")) return "year";
  return "month";
}

function frequencyToInterval(frequency: BillingFrequency): "month" | "year" {
  return frequency === "year" || frequency === "once_off" ? "year" : "month";
}

function frequencyUnitLabel(frequency: BillingFrequency) {
  if (frequency === "once_off") return "once-off";
  if (frequency === "year") return "/year";
  return "/month";
}

function frequencyRecurring(frequency: BillingFrequency) {
  return frequency !== "once_off";
}

function parseMinimumTermMonths(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.round(value) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "monthly" || trimmed === "month") return 1;
  const number = Number.parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(number) || number <= 0) return null;
  return trimmed.includes("year") ? number * 12 : number;
}

function minimumTermLabel(months: number | null | undefined) {
  if (!months || months <= 0) return null;
  return months === 1 ? "1 month" : `${months} months`;
}

function normalizeMinimumTermMonths(input: {
  minimumTermMonths?: number | string | null;
  minimumTerm?: string | null;
}) {
  return (
    parseMinimumTermMonths(input.minimumTermMonths) ?? parseMinimumTermMonths(input.minimumTerm)
  );
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function proposalApiUrl(origin: string, token: string | null | undefined) {
  return token ? `${origin}/api/proposals/${encodeURIComponent(token)}` : null;
}

function publicAssetUrl(asset: string) {
  if (/^https?:\/\//.test(asset)) return asset;
  return asset.startsWith("/") ? asset : `/${asset}`;
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attributeEscape(value: unknown) {
  return htmlEscape(value).replace(/`/g, "&#96;");
}

function centsFromText(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function listFromJson(value: string | null | undefined): string[] {
  const parsed = safeJsonParse(value);
  return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
}

function definitionSections(value: string | null | undefined) {
  const definition = safeJsonParse(value) ?? {};
  const readFrom = (source: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) {
      const current = source[key];
      if (Array.isArray(current)) return current.map((item) => String(item)).filter(Boolean);
      if (typeof current === "string" && current.trim()) return [current.trim()];
      if (current && typeof current === "object") {
        return Object.entries(current as Record<string, unknown>).map(
          ([label, detail]) => `${label}: ${String(detail)}`,
        );
      }
    }
    return [];
  };
  const root = definition as Record<string, unknown>;
  const packageRules =
    root.packageRules && typeof root.packageRules === "object"
      ? (root.packageRules as Record<string, unknown>)
      : {};
  const unique = (...groups: string[][]) => [...new Set(groups.flat().filter(Boolean))];
  return {
    scope: unique(
      readFrom(root, "scope", "scopeOfInclusion", "included", "includedScope", "managementLayer"),
      readFrom(packageRules, "coverage"),
      readFrom(packageRules, "serviceAllocation"),
      readFrom(packageRules, "infrastructureAllocation"),
      readFrom(packageRules, "supportAllocation"),
      readFrom(packageRules, "includedChanges"),
    ),
    limits: unique(
      readFrom(root, "limits", "hardLimits", "serviceLimits", "usageLimits"),
      readFrom(packageRules, "usageLimits"),
    ),
    exclusions: unique(
      readFrom(root, "exclusions", "excludedScope", "outOfScope", "notIncluded"),
      readFrom(packageRules, "limitExceeded"),
      readFrom(root, "outOfScopeBilling"),
    ),
    sla: unique(
      readFrom(root, "sla", "serviceLevel", "serviceLevels", "support"),
      readFrom(packageRules, "responseTimes"),
    ),
    terms: unique(readFrom(root, "standardTerms"), readFrom(root, "vatTreatment")),
  };
}

function renderList(items: string[]) {
  if (!items.length)
    return `<li>Defined during onboarding and governed by the selected service plan.</li>`;
  return items.map((item) => `<li>${htmlEscape(item)}</li>`).join("");
}

async function resolveProposalLines(inputLines: ProposalLineInput[]) {
  const resolved = [];
  for (let index = 0; index < inputLines.length; index += 1) {
    const input = inputLines[index];
    const productType = input.productType;
    const quantity = Math.max(1, Number(input.quantity) || 1);

    if (productType === "bundle" || input.bundleId) {
      const bundleId = input.bundleId ?? input.productId;
      const row = bundleId
        ? await db.query.bundle.findFirst({
            where: eq(bundle.id, bundleId),
            with: { features: true },
          })
        : null;
      if (!row)
        throw Object.assign(new Error(`Selected bundle not found: ${bundleId}`), { status: 400 });
      const unitPrice = input.unitPrice ?? centsFromText(row.priceZar);
      const setupPrice = input.setupPrice ?? centsFromText(row.setupPriceZar);
      const billingFrequency = normalizeBillingFrequency(row);
      resolved.push({
        productType: "bundle",
        productId: row.id,
        planId: null,
        bundleId: row.id,
        name: input.name ?? row.name,
        description: input.description ?? row.serviceNote ?? row.categoryNote ?? null,
        quantity,
        unitPrice,
        setupPrice,
        recurring: frequencyRecurring(billingFrequency),
        interval: frequencyToInterval(billingFrequency),
        sortOrder: index,
        serviceDefinition: row.serviceDefinition ?? null,
        features: JSON.stringify(row.features?.map((feature) => feature.content) ?? []),
        lineTotal: quantity * (unitPrice + setupPrice),
      });
      continue;
    }

    if (productType === "plan" || input.planId) {
      const planId = input.planId ?? input.productId;
      const row = planId
        ? await db.query.servicePlan.findFirst({
            where: eq(servicePlan.id, planId),
            with: { service: true, features: true },
          })
        : null;
      if (!row)
        throw Object.assign(new Error(`Selected service plan not found: ${planId}`), {
          status: 400,
        });
      const unitPrice = input.unitPrice ?? centsFromText(row.priceZar);
      const setupPrice = input.setupPrice ?? centsFromText(row.setupPriceZar);
      const billingFrequency = normalizeBillingFrequency(row);
      resolved.push({
        productType: "plan",
        productId: row.id,
        planId: row.id,
        bundleId: null,
        name: input.name ?? `${row.service?.name ? `${row.service.name} - ` : ""}${row.name}`,
        description: input.description ?? row.serviceNote ?? row.tagline ?? null,
        quantity,
        unitPrice,
        setupPrice,
        recurring: frequencyRecurring(billingFrequency),
        interval: frequencyToInterval(billingFrequency),
        sortOrder: index,
        serviceDefinition: row.serviceDefinition ?? null,
        features: JSON.stringify(row.features?.map((feature) => feature.content) ?? []),
        lineTotal: quantity * (unitPrice + setupPrice),
      });
      continue;
    }

    const unitPrice = input.unitPrice ?? 0;
    const setupPrice = input.setupPrice ?? 0;
    resolved.push({
      productType: "custom",
      productId: input.productId ?? null,
      planId: null,
      bundleId: null,
      name: input.name ?? "Custom CloudMonkey service",
      description: input.description ?? null,
      quantity,
      unitPrice,
      setupPrice,
      recurring: input.recurring,
      interval: input.interval,
      sortOrder: index,
      serviceDefinition: null,
      features: JSON.stringify([]),
      lineTotal: quantity * (unitPrice + setupPrice),
    });
  }
  return resolved;
}

function proposalTotals(lines: Awaited<ReturnType<typeof resolveProposalLines>>) {
  const setupTotal = lines.reduce((sum, item) => sum + item.quantity * item.setupPrice, 0);
  const recurringTotal = lines.reduce(
    (sum, item) => sum + (item.recurring ? item.quantity * item.unitPrice : 0),
    0,
  );
  const onceOffTotal = lines.reduce(
    (sum, item) => sum + (!item.recurring ? item.quantity * item.unitPrice : 0),
    0,
  );
  return {
    setupTotal,
    recurringTotal,
    subtotal: setupTotal + recurringTotal + onceOffTotal,
    total: setupTotal + recurringTotal + onceOffTotal,
  };
}

function renderProposalHtml(document: ProposalDocument) {
  const { proposal: row, items, publicUrl } = document;
  const billing = document.workspaceBilling ?? getWorkspaceBillingDetails(null);
  const logoUrl = publicAssetUrl(logo);
  const billingAddress = billing.address
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<span>${htmlEscape(line)}</span>`)
    .join("");
  const proposalItems = items
    .map((item) => {
      const sections = definitionSections(item.serviceDefinition);
      const features = listFromJson(item.features);
      const priceLabel = item.recurring
        ? `${formatEmailMoney(item.unitPrice, row.currency)}/${item.interval}`
        : `${formatEmailMoney(item.unitPrice, row.currency)} once-off`;
      return `
        <section class="service-card">
          <div class="service-head">
            <div>
              <p class="eyebrow">${htmlEscape(item.productType)}</p>
              <h2>${htmlEscape(item.name)}</h2>
              <p>${htmlEscape(item.description || "Managed CloudMonkey service with defined delivery scope.")}</p>
            </div>
            <div class="price-pill">
              <strong>${htmlEscape(priceLabel)}</strong>
              ${item.setupPrice > 0 ? `<span>Setup ${htmlEscape(formatEmailMoney(item.setupPrice, row.currency))}</span>` : ""}
            </div>
          </div>
          <div class="definition-grid">
            <div>
              <h3>Included Scope</h3>
              <ul>${renderList(sections.scope.length ? sections.scope : features)}</ul>
            </div>
            <div>
              <h3>Service Levels</h3>
              <ul>${renderList(sections.sla)}</ul>
            </div>
            <div>
              <h3>Hard Limits</h3>
              <ul>${renderList(sections.limits)}</ul>
            </div>
            <div>
              <h3>Out Of Scope</h3>
              <ul>${renderList(sections.exclusions)}</ul>
            </div>
            <div>
              <h3>Package Terms</h3>
              <ul>${renderList(sections.terms)}</ul>
            </div>
          </div>
        </section>`;
    })
    .join("");
  const proposalServiceNames = items.map((item) => item.name);

  const approvalBlock =
    publicUrl && ["draft", "sent"].includes(row.status)
      ? `<form method="POST" action="${attributeEscape(publicUrl)}/approve" class="approval">
          <button type="submit">Approve proposal and generate invoice</button>
          <p>Approval records your timestamp, IP address, and proposal version. If your customer account is not registered yet, the approval is stored and invoicing will complete when your account is created.</p>
        </form>`
      : `<div class="approval muted">Proposal status: ${htmlEscape(row.status)}</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${htmlEscape(row.title)}</title>
  <style>
    :root { color-scheme: light; --ink:#07102c; --muted:#58637e; --line:#dfe4ef; --brand:#5d2fe8; --brand-2:#6d34f7; --cyan:#12b7d6; --navy:#070d23; --paper:#f6f8fc; --card:#ffffff; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at top left, rgba(93,47,232,.18), transparent 35%), #eef2f8; color:var(--ink); font-family:Inter, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; }
    .page { max-width:1120px; margin:32px auto; background:var(--paper); border:1px solid var(--line); box-shadow:0 28px 90px rgba(7,13,35,.18); }
    .hero { position:relative; overflow:hidden; padding:42px 56px 62px; color:#fff; background:radial-gradient(circle at 86% 18%, rgba(18,183,214,.42), transparent 28%), radial-gradient(circle at 8% 0%, rgba(109,52,247,.8), transparent 34%), linear-gradient(135deg,#070d23 0%,#121b43 48%,#5d2fe8 100%); }
    .hero:after { content:""; position:absolute; right:-120px; bottom:-160px; width:420px; height:420px; border:1px solid rgba(255,255,255,.14); border-radius:50%; box-shadow:inset 0 0 0 48px rgba(255,255,255,.035); }
    .brand { position:relative; z-index:1; display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
    .brand-mark { display:flex; align-items:center; gap:14px; }
    .brand-mark img { width:58px; height:58px; border-radius:18px; background:#fff; padding:6px; box-shadow:0 18px 38px rgba(0,0,0,.2); }
    .brand-mark strong { display:block; font-size:26px; line-height:1; letter-spacing:-.04em; }
    .brand-mark small { display:block; margin-top:6px; color:rgba(255,255,255,.72); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .proposal-id { text-align:right; color:rgba(255,255,255,.78); text-transform:uppercase; letter-spacing:.14em; font:800 12px ui-sans-serif,system-ui,sans-serif; }
    h1 { position:relative; z-index:1; margin:58px 0 18px; max-width:790px; font-size:56px; line-height:.96; letter-spacing:-.055em; }
    .hero p { position:relative; z-index:1; max-width:760px; color:rgba(255,255,255,.84); font:500 18px/1.65 ui-sans-serif,system-ui,sans-serif; }
    .hero-strip { position:relative; z-index:1; display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
    .hero-strip span { border:1px solid rgba(255,255,255,.18); border-radius:999px; background:rgba(255,255,255,.08); padding:9px 12px; color:rgba(255,255,255,.82); font-size:12px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
    .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line); border-bottom:1px solid var(--line); }
    .meta div { background:#fff; padding:22px 28px; }
    .meta span, .eyebrow { display:block; color:var(--muted); text-transform:uppercase; letter-spacing:.12em; font:800 11px ui-sans-serif,system-ui,sans-serif; }
    .meta strong { display:block; margin-top:8px; font:800 15px ui-sans-serif,system-ui,sans-serif; }
    .content { padding:46px 56px 56px; }
    .summary { display:grid; grid-template-columns:1.1fr .9fr; gap:28px; margin-bottom:34px; }
    .panel { border:1px solid var(--line); background:#fff; border-radius:20px; padding:28px; }
    .panel h2, .service-card h2 { margin:0 0 12px; font-size:30px; letter-spacing:-.03em; }
    .panel p, .service-card p, li { color:#3b4559; font:400 15px/1.7 ui-sans-serif,system-ui,sans-serif; }
    .service-card { margin:22px 0; border:1px solid var(--line); border-radius:24px; background:#fff; overflow:hidden; box-shadow:0 16px 42px rgba(7,13,35,.06); }
    .service-head { display:flex; justify-content:space-between; gap:24px; padding:30px; border-bottom:1px solid var(--line); background:linear-gradient(135deg,#fff,#f7f4ff); }
    .price-pill { min-width:190px; align-self:flex-start; border-radius:16px; background:#070d23; color:#fff; padding:18px; text-align:right; font:700 14px ui-sans-serif,system-ui,sans-serif; box-shadow:0 16px 32px rgba(7,13,35,.18); }
    .price-pill strong, .price-pill span { display:block; }
    .price-pill span { margin-top:6px; color:#c9d2f0; font-size:12px; }
    .definition-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:var(--line); }
    .definition-grid div { background:#fff; padding:24px 28px; }
    h3 { margin:0 0 12px; color:var(--brand); font:900 13px ui-sans-serif,system-ui,sans-serif; text-transform:uppercase; letter-spacing:.1em; }
    ul { margin:0; padding-left:20px; }
    .pricing { width:100%; border-collapse:collapse; overflow:hidden; border-radius:18px; background:#fff; }
    .pricing th, .pricing td { padding:16px 18px; border-bottom:1px solid var(--line); text-align:left; font:500 14px ui-sans-serif,system-ui,sans-serif; }
    .pricing th { color:#667085; text-transform:uppercase; letter-spacing:.1em; font-size:11px; }
    .pricing td:last-child, .pricing th:last-child { text-align:right; }
    .totals { margin-top:0; border:1px solid var(--line); border-radius:0 0 20px 20px; background:#fff; padding:24px 28px; }
    .total-row { display:flex; justify-content:space-between; padding:8px 0; font:700 15px ui-sans-serif,system-ui,sans-serif; }
    .total-row.grand { margin-top:10px; padding-top:18px; border-top:1px solid var(--line); color:var(--brand); font-size:22px; }
    .terms { margin-top:28px; }
    .markdown > :first-child { margin-top:0; }
    .markdown > :last-child { margin-bottom:0; }
    .markdown p { margin:0 0 16px; color:#3b4559; font:400 15px/1.75 ui-sans-serif,system-ui,sans-serif; }
    .markdown h2, .markdown h3, .markdown h4 { margin:26px 0 12px; color:var(--ink); text-transform:none; letter-spacing:-.015em; font:800 19px/1.3 ui-sans-serif,system-ui,sans-serif; }
    .markdown h2 { padding-bottom:9px; border-bottom:1px solid var(--line); font-size:22px; }
    .markdown h4 { font-size:16px; }
    .markdown ul, .markdown ol { margin:0 0 18px; padding-left:26px; }
    .markdown li { margin:6px 0; }
    .markdown strong { color:var(--ink); font-weight:800; }
    .markdown em { color:#303a50; }
    .markdown code { border-radius:5px; background:#eef1f7; padding:2px 5px; font:500 13px ui-monospace,SFMono-Regular,monospace; }
    .markdown blockquote { margin:18px 0; border-left:3px solid var(--brand); background:#f7f4ff; padding:12px 16px; color:#3b4559; }
    .markdown hr { margin:24px 0; border:0; border-top:1px solid var(--line); }
    .approval { margin-top:30px; border-radius:20px; background:linear-gradient(135deg,#070d23,#251256 58%,#5d2fe8); color:#fff; padding:28px; font:400 14px/1.7 ui-sans-serif,system-ui,sans-serif; box-shadow:0 20px 48px rgba(93,47,232,.22); }
    .approval button { width:100%; border:0; border-radius:14px; background:#fff; color:#321594; cursor:pointer; padding:18px 22px; font:900 16px ui-sans-serif,system-ui,sans-serif; }
    .approval p { margin:16px 0 0; color:rgba(255,255,255,.76); }
    .muted { background:#f3f6fa; color:#4f5a6e; }
    .company-footer { margin-top:30px; display:grid; grid-template-columns:1.1fr .9fr; gap:22px; border-radius:24px; background:#070d23; color:#fff; padding:30px; }
    .footer-brand { display:flex; gap:14px; align-items:flex-start; }
    .footer-brand img { width:46px; height:46px; border-radius:14px; background:#fff; padding:5px; }
    .footer-brand strong { display:block; font-size:22px; letter-spacing:-.03em; }
    .footer-brand small, .company-footer p { color:rgba(255,255,255,.68); font-size:13px; line-height:1.7; }
    .company-details { display:grid; gap:4px; color:rgba(255,255,255,.78); font-size:13px; line-height:1.55; }
    .company-details span { display:block; }
    .company-details a { color:#c8bbff; text-decoration:none; font-weight:800; }
    @media (max-width: 760px) {
      .page { margin:0; }
      .hero, .content { padding:30px 22px; }
      h1 { font-size:40px; }
      .brand { display:block; }
      .proposal-id { margin-top:20px; text-align:left; }
      .meta, .summary, .definition-grid, .company-footer { grid-template-columns:1fr; }
      .service-head { display:block; }
      .price-pill { margin-top:18px; text-align:left; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="brand">
        <div class="brand-mark">
          <img src="${attributeEscape(logoUrl)}" alt="CloudMonkey logo">
          <span>
            <strong>CloudMonkey</strong>
            <small>Cloud made simple. Support that cares.</small>
          </span>
        </div>
        <div class="proposal-id">Managed Services Proposal<br>${htmlEscape(row.proposalNumber ?? row.id)}</div>
      </div>
      <h1>${htmlEscape(row.title)}</h1>
      <p>${htmlEscape(row.introduction || PROPOSAL_DEFAULT_INTRODUCTION)}</p>
      <div class="hero-strip">
        <span>Managed Cloud</span>
        <span>Business IT</span>
        <span>AI Automation</span>
        <span>One invoice</span>
      </div>
    </section>
    <section class="meta">
      <div><span>Prepared For</span><strong>${htmlEscape(row.customerName)}</strong></div>
      <div><span>Company</span><strong>${htmlEscape(row.customerCompany || "Not specified")}</strong></div>
      <div><span>Email</span><strong>${htmlEscape(row.customerEmail)}</strong></div>
      <div><span>Valid Until</span><strong>${htmlEscape(row.expiresAt ? formatEmailDate(row.expiresAt) : "30 days from issue")}</strong></div>
    </section>
    <section class="content">
      <div class="summary">
        <div class="panel">
          <h2>Executive Summary</h2>
          <p>${htmlEscape(row.executiveSummary || PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY)}</p>
        </div>
        <div class="panel">
          <h2>Commercial Position</h2>
          <p>Setup and onboarding fees are once-off. Recurring managed service fees are billed ${htmlEscape(items.find((item) => item.recurring)?.interval ?? "month")}ly unless explicitly stated otherwise. Prices are shown in ${htmlEscape(row.currency)} and exclude any out-of-scope work.</p>
        </div>
      </div>
      ${proposalItems}
      <section class="panel">
        <h2>Pricing Summary</h2>
        <table class="pricing">
          <thead><tr><th>Service</th><th>Qty</th><th>Recurring</th><th>Setup</th><th>First Invoice</th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `<tr>
                  <td>${htmlEscape(item.name)}</td>
                  <td>${item.quantity}</td>
                  <td>${htmlEscape(item.recurring ? `${formatEmailMoney(item.unitPrice, row.currency)}/${item.interval}` : "Once-off")}</td>
                  <td>${htmlEscape(formatEmailMoney(item.quantity * item.setupPrice, row.currency))}</td>
                  <td>${htmlEscape(formatEmailMoney(item.lineTotal, row.currency))}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Once-off setup</span><strong>${htmlEscape(formatEmailMoney(row.setupTotal, row.currency))}</strong></div>
          <div class="total-row"><span>Recurring services</span><strong>${htmlEscape(formatEmailMoney(row.recurringTotal, row.currency))}</strong></div>
          <div class="total-row grand"><span>First invoice total</span><strong>${htmlEscape(formatEmailMoney(row.total, row.currency))}</strong></div>
        </div>
      </section>
      <section class="panel terms">
        <h2>Terms And Boundaries</h2>
        <div class="markdown">${renderSafeMarkdown(row.terms || buildProposalTerms(proposalServiceNames))}</div>
      </section>
      ${approvalBlock}
      <footer class="company-footer">
        <div class="footer-brand">
          <img src="${attributeEscape(logoUrl)}" alt="CloudMonkey logo">
          <span>
            <strong>CloudMonkey</strong>
            <small>Cloud made simple. Support that cares.</small>
            <p>This proposal is prepared by ${htmlEscape(billing.legalName)} and forms the commercial basis for onboarding after approval and customer registration.</p>
          </span>
        </div>
        <div class="company-details">
          <span><strong>${htmlEscape(billing.legalName)}</strong></span>
          ${billing.registrationNumber ? `<span>Registration number: ${htmlEscape(billing.registrationNumber)}</span>` : ""}
          ${billing.vatNumber ? `<span>VAT number: ${htmlEscape(billing.vatNumber)}</span>` : ""}
          <span>Email: <a href="mailto:${attributeEscape(billing.email)}">${htmlEscape(billing.email)}</a></span>
          <span>Phone: ${htmlEscape(billing.phone)}</span>
          <span>Website: <a href="https://${attributeEscape(billing.website.replace(/^https?:\/\//, ""))}">${htmlEscape(billing.website)}</a></span>
          <span>${billingAddress}</span>
        </div>
      </footer>
    </section>
  </main>
</body>
</html>`;
}

function renderProposalResultHtml(input: {
  title: string;
  message: string;
  invoiceUrl?: string | null;
  registerUrl?: string | null;
}) {
  const logoUrl = publicAssetUrl(logo);
  const cta = input.invoiceUrl
    ? `<a href="${attributeEscape(input.invoiceUrl)}">View invoice</a>`
    : input.registerUrl
      ? `<a href="${attributeEscape(input.registerUrl)}">Register customer account</a>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(input.title)}</title><style>body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 0%,rgba(109,52,247,.3),transparent 34%),linear-gradient(135deg,#070d23,#101941 58%,#5d2fe8);color:#07102c;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.card{max-width:680px;margin:12vh auto;background:#fff;border:1px solid #dfe4ef;border-radius:28px;padding:38px;box-shadow:0 24px 80px rgba(7,13,35,.28)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}.brand img{width:46px;height:46px;border-radius:14px}.brand strong{display:block;font-size:22px;letter-spacing:-.04em}.brand small{display:block;color:#58637e;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}h1{margin:0 0 14px;font-size:34px;letter-spacing:-.04em}p{color:#4b5568;line-height:1.7}a{display:inline-block;margin-top:18px;border-radius:12px;background:#5d2fe8;color:#fff;padding:14px 20px;text-decoration:none;font-weight:900}</style></head><body><main class="card"><div class="brand"><img src="${attributeEscape(logoUrl)}" alt="CloudMonkey logo"><span><strong>CloudMonkey</strong><small>Cloud made simple. Support that cares.</small></span></div><h1>${htmlEscape(input.title)}</h1><p>${htmlEscape(input.message)}</p>${cta}</main></body></html>`;
}

async function fetchProposalDocument(
  idOrToken: string,
  byToken = false,
): Promise<ProposalDocument | null> {
  const row = await db.query.proposal.findFirst({
    where: byToken ? eq(proposal.publicToken, idOrToken) : eq(proposal.id, idOrToken),
    with: { items: { orderBy: (proposalItem, { asc }) => [asc(proposalItem.sortOrder)] } },
  });
  if (!row) return null;
  return { proposal: row, items: row.items ?? [] };
}

async function createProposalInvoice(input: {
  proposalId: string;
  origin: string;
  actorUserId?: string | null;
}) {
  const document = await fetchProposalDocument(input.proposalId);
  if (!document) throw Object.assign(new Error("Proposal not found"), { status: 404 });
  const row = document.proposal;
  if (row.invoiceId) {
    const existing = await db.query.invoice.findFirst({ where: eq(invoice.id, row.invoiceId) });
    return { invoice: existing, created: false, requiresRegistration: false };
  }

  const targetUser = row.customerUserId
    ? await db.query.user.findFirst({ where: eq(user.id, row.customerUserId) })
    : await db.query.user.findFirst({
        where: sql`lower(${user.email}) = ${row.customerEmail.trim().toLowerCase()}`,
      });
  if (!targetUser) return { invoice: null, created: false, requiresRegistration: true };

  const fullInvoiceLines = document.items.flatMap((item) => {
    const lines = [];
    if (item.setupPrice > 0) {
      lines.push({
        description: `${item.name} - setup and onboarding`,
        quantity: item.quantity,
        unitPrice: item.setupPrice,
        amount: item.quantity * item.setupPrice,
        recurring: false,
        interval: item.interval as "month" | "year",
        planId: null,
        bundleId: null,
      });
    }
    if (item.unitPrice > 0) {
      lines.push({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
        recurring: item.recurring,
        interval: item.interval as "month" | "year",
        planId: item.planId,
        bundleId: item.bundleId,
      });
    }
    return lines;
  });
  const fullAmount = fullInvoiceLines.reduce((sum, line) => sum + line.amount, 0);
  if (fullAmount <= 0) {
    throw Object.assign(new Error("Proposal has no payable line items to invoice"), {
      status: 400,
    });
  }
  const hasMilestoneSchedule = /\b50\s*\/\s*25\s*\/\s*25\b/.test(row.terms ?? "");
  const firstMilestonePercent = hasMilestoneSchedule ? 50 : 100;
  const firstMilestoneAmount = Math.ceil((fullAmount * firstMilestonePercent) / 100);
  const invoiceLines = fullInvoiceLines.map((line, index) => ({
    ...line,
    amount:
      index === fullInvoiceLines.length - 1
        ? firstMilestoneAmount -
          fullInvoiceLines
            .slice(0, -1)
            .reduce(
              (sum, previous) => sum + Math.round((previous.amount * firstMilestonePercent) / 100),
              0,
            )
        : Math.round((line.amount * firstMilestonePercent) / 100),
  }));
  const amount = invoiceLines.reduce((sum, line) => sum + line.amount, 0);

  const issuedAt = new Date();
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const billingPeriodEnd = new Date(issuedAt);
  billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
  const invoiceId = makeId("inv");
  const settings = await getWorkspaceSettings();
  const invoiceNumber = makeInvoiceNumber(invoiceId, issuedAt);
  const callbackUrl = `${input.origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`;

  const payment = await initializePayment({
    email: targetUser.email,
    amountCents: amount,
    invoiceId,
    subscriptionId: invoiceId,
    userId: targetUser.id,
    callbackUrl,
  });

  const [createdInvoice] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(invoice)
      .values({
        id: invoiceId,
        userId: targetUser.id,
        invoiceNumber,
        invoiceSource: "proposal",
        amount,
        status: "pending",
        dueDate,
        issuedAt,
        publishedAt: issuedAt,
        billingPeriodStart: issuedAt,
        billingPeriodEnd,
        currency: row.currency,
        vatRateBps: 0,
        customerName: targetUser.name ?? row.customerName,
        customerEmail: targetUser.email,
        customerCompany: row.customerCompany ?? null,
        workspaceBillingSnapshot: JSON.stringify(getWorkspaceBillingDetails(settings)),
        notes:
          `Generated from proposal ${row.proposalNumber ?? row.id}${hasMilestoneSchedule ? " — milestone 1 of 3 (50%)" : ""}. ${settings?.billingInvoiceNotes ?? ""}`.trim(),
        paystackReference: payment.data.reference,
        paystackUrl: payment.data.authorization_url,
      })
      .returning();
    await tx.insert(invoiceItem).values(
      invoiceLines.map((line) => ({
        id: makeId("invitem"),
        invoiceId,
        planId: line.planId,
        bundleId: line.bundleId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        recurring: line.recurring,
        interval: line.interval,
      })),
    );
    await tx
      .update(proposal)
      .set({
        customerUserId: targetUser.id,
        invoiceId,
        status: "converted",
        convertedAt: issuedAt,
        updatedAt: issuedAt,
      })
      .where(eq(proposal.id, row.id));
    return [created];
  });

  await upsertManualInvoiceLineSubscriptions({
    invoiceId,
    userId: targetUser.id,
    billingPeriodStart: issuedAt,
    billingPeriodEnd,
    status: "pending",
  });

  await recordAudit({
    actorUserId: input.actorUserId ?? targetUser.id,
    action: "proposal.invoice_created",
    entityType: "proposal",
    entityId: row.id,
    message: `Proposal invoice generated for ${targetUser.email}`,
    metadata: { invoiceId, proposalNumber: row.proposalNumber, amount },
  });

  sendEmail({
    template: "invoice_created",
    to: targetUser.email,
    subject: `CloudMonkey invoice ${createdInvoice.invoiceNumber ?? createdInvoice.id}`,
    data: {
      firstName: targetUser.name,
      customerName: targetUser.name,
      invoiceId,
      invoiceNumber: createdInvoice.invoiceNumber ?? invoiceId,
      productName: row.title,
      subscriptionName: row.title,
      totalDue: formatEmailMoney(createdInvoice.amount, createdInvoice.currency ?? "ZAR"),
      dueDate: formatEmailDate(createdInvoice.dueDate),
      primaryCtaText: "View and pay invoice",
      primaryCtaUrl: callbackUrl,
    },
    idempotencyKey: `proposal:${row.id}:invoice:${invoiceId}`,
  }).catch((error) => console.error("Proposal invoice email failed:", error));

  return { invoice: createdInvoice, created: true, requiresRegistration: false };
}

async function upsertManualInvoiceLineSubscriptions(input: {
  invoiceId: string;
  userId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date | null;
  status: "pending" | "active";
}) {
  const items = await db.query.invoiceItem.findMany({
    where: eq(invoiceItem.invoiceId, input.invoiceId),
  });
  const recurringItems = items.filter((item) => item.recurring);
  const touched: Array<typeof subscription.$inferSelect> = [];
  for (const item of recurringItems) {
    const subscriptionId = manualInvoiceSubscriptionId(input.invoiceId, item.id);
    const minimumTermMonths = await getMinimumTermMonthsForProduct({
      planId: item.planId,
      bundleId: item.bundleId,
    });
    const [row] = await db
      .insert(subscription)
      .values({
        id: subscriptionId,
        userId: input.userId,
        planId: item.planId ?? null,
        bundleId: item.bundleId ?? null,
        name: item.description,
        status: input.status,
        amount: item.amount,
        interval: item.interval || "month",
        minimumTermMonths,
        minimumTermEndsAt: minimumTermMonths
          ? addMonths(input.billingPeriodStart, minimumTermMonths)
          : null,
        currentPeriodStart: input.billingPeriodStart,
        currentPeriodEnd: input.billingPeriodEnd,
      })
      .onConflictDoUpdate({
        target: subscription.id,
        set: {
          planId: item.planId ?? null,
          bundleId: item.bundleId ?? null,
          name: item.description,
          status: input.status,
          amount: item.amount,
          interval: item.interval || "month",
          minimumTermMonths,
          minimumTermEndsAt: minimumTermMonths
            ? addMonths(input.billingPeriodStart, minimumTermMonths)
            : null,
          currentPeriodStart: input.billingPeriodStart,
          currentPeriodEnd: input.billingPeriodEnd,
          updatedAt: new Date(),
        },
      })
      .returning();
    touched.push(row);
  }
  return touched;
}

async function getMinimumTermMonthsForProduct(input: {
  planId?: string | null;
  bundleId?: string | null;
}) {
  if (input.planId) {
    const row = await db.query.servicePlan.findFirst({ where: eq(servicePlan.id, input.planId) });
    return normalizeMinimumTermMonths(row ?? {});
  }
  if (input.bundleId) {
    const row = await db.query.bundle.findFirst({ where: eq(bundle.id, input.bundleId) });
    return normalizeMinimumTermMonths(row ?? {});
  }
  return null;
}

async function getInvoicePaymentTotal(invoiceId: string) {
  const rows = await db.query.invoicePayment.findMany({
    where: eq(invoicePayment.invoiceId, invoiceId),
  });
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
}

async function activateBillingAfterPayment(input: {
  invoiceRow: typeof invoice.$inferSelect;
  origin: string;
  actorUserId?: string | null;
  paymentId?: string | null;
}) {
  const now = new Date();
  const existingSubscription = await db.query.subscription.findFirst({
    where: eq(subscription.id, input.invoiceRow.id),
  });
  if (existingSubscription) {
    await db
      .update(subscription)
      .set({
        status: "active",
        updatedAt: now,
        currentPeriodStart: now,
      })
      .where(eq(subscription.id, existingSubscription.id));
  }
  await upsertManualInvoiceLineSubscriptions({
    invoiceId: input.invoiceRow.id,
    userId: input.invoiceRow.userId,
    billingPeriodStart: now,
    billingPeriodEnd: input.invoiceRow.billingPeriodEnd,
    status: "active",
  });

  await createAffiliateCommissionForPayment({
    invoiceId: input.invoiceRow.id,
    customerId: input.invoiceRow.userId,
    amount: input.invoiceRow.amount,
    subscriptionId: existingSubscription?.id ?? input.invoiceRow.id,
    paymentId: input.paymentId ?? input.invoiceRow.paystackReference ?? input.invoiceRow.id,
  });

  const paidDomainOrder = await db.query.domainOrder.findFirst({
    where: eq(domainOrder.invoiceId, input.invoiceRow.id),
  });
  if (paidDomainOrder && !["registered", "registration_failed"].includes(paidDomainOrder.status)) {
    await db
      .update(domainOrder)
      .set({
        status: "paid",
        updatedAt: now,
      })
      .where(eq(domainOrder.id, paidDomainOrder.id));
    tryRegisterPaidDomainOrder(paidDomainOrder, input.origin).catch((error) => {
      console.error("Domain registration follow-up failed:", error);
    });
  }

  const targetUser = await db.query.user.findFirst({ where: eq(user.id, input.invoiceRow.userId) });
  if (targetUser?.email) {
    sendEmail({
      template: "payment_received",
      to: targetUser.email,
      subject: `Payment received for ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id}`,
      data: {
        firstName: targetUser.name,
        productName: input.invoiceRow.invoiceNumber ?? "CloudMonkey invoice",
        subscriptionName:
          existingSubscription?.name ?? input.invoiceRow.invoiceNumber ?? "CloudMonkey services",
        totalDue: formatEmailMoney(input.invoiceRow.amount, input.invoiceRow.currency ?? "ZAR"),
        primaryCtaText: "Open invoice",
        primaryCtaUrl: `${input.origin}/dashboard/billing/invoices/${encodeURIComponent(input.invoiceRow.id)}`,
      },
      idempotencyKey: `payment:${input.invoiceRow.id}:received`,
    }).catch((error) => console.error("Payment receipt email failed:", error));
  }

  await recordAudit({
    actorUserId: input.actorUserId ?? null,
    action: "invoice.payment_activated",
    entityType: "invoice",
    entityId: input.invoiceRow.id,
    message: `Invoice ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id} marked paid and services activated`,
    metadata: { paymentId: input.paymentId ?? null },
  });
}

async function captureInvoicePayment(input: {
  invoiceId: string;
  amount?: number | null;
  method: "eft" | "cash" | "manual" | "gateway";
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
  capturedByUserId?: string | null;
  idempotencyKey: string;
  origin: string;
}) {
  const result = await captureInvoicePaymentAtomically(db, input);
  if (result.shouldActivate && result.invoice.status === "paid") {
    await activateBillingAfterPayment({
      invoiceRow: result.invoice,
      origin: input.origin,
      actorUserId: input.capturedByUserId ?? null,
      paymentId: result.payment?.id ?? null,
    });
  }
  const { shouldActivate: _shouldActivate, ...response } = result;
  return response;
}

function renderSuspendedServicePage(input: {
  title?: string;
  domain?: string | null;
  reason?: string | null;
  invoiceUrl?: string | null;
}) {
  const logoUrl = publicAssetUrl(logo);
  const domain = input.domain ? `<p class="domain">${htmlEscape(input.domain)}</p>` : "";
  const cta = input.invoiceUrl
    ? `<a href="${attributeEscape(input.invoiceUrl)}">Open invoice and restore service</a>`
    : `<a href="mailto:billing@cloudmonkey.co.za">Contact billing</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Service suspended - CloudMonkey</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 18% 12%,rgba(247,181,0,.28),transparent 28%),radial-gradient(circle at 82% 0%,rgba(91,64,236,.22),transparent 34%),linear-gradient(135deg,#07102c,#101941 58%,#0f766e);font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#07102c}.card{width:min(720px,calc(100% - 32px));background:#fff;border:1px solid #dfe4ef;border-radius:30px;padding:42px;box-shadow:0 26px 90px rgba(3,7,18,.34)}.brand{display:flex;gap:13px;align-items:center;margin-bottom:28px}.brand img{height:48px;width:48px;border-radius:14px}.brand strong{display:block;font-size:23px;letter-spacing:-.05em}.brand span span{display:block;color:#58637e;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.pill{display:inline-flex;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}h1{font-size:42px;line-height:1;margin:18px 0 14px;letter-spacing:-.06em}p{font-size:16px;line-height:1.7;color:#4b5568}.domain{font-size:20px;font-weight:900;color:#07102c;background:#f6f7fb;border:1px solid #dfe4ef;border-radius:16px;padding:14px 16px}a{display:inline-flex;margin-top:18px;background:#5d2fe8;color:#fff;text-decoration:none;border-radius:14px;padding:15px 20px;font-weight:900}.meta{margin-top:22px;color:#7b849b;font-size:13px}</style></head><body><main class="card"><div class="brand"><img src="${attributeEscape(logoUrl)}" alt="CloudMonkey logo"><span><strong>CloudMonkey</strong><span>Managed services billing</span></span></div><span class="pill">Temporarily suspended</span><h1>${htmlEscape(input.title ?? "This service is suspended")}</h1>${domain}<p>${htmlEscape(input.reason ?? "The linked invoice is still outstanding after the payment grace period. Service can be restored once payment has been confirmed by CloudMonkey billing.")}</p>${cta}<p class="meta">If you paid by EFT, please send proof of payment to billing@cloudmonkey.co.za and include your invoice number.</p></main></body></html>`;
}

async function suspendResourcesForInvoice(input: {
  invoiceRow: typeof invoice.$inferSelect;
  origin: string;
  actorUserId?: string | null;
}) {
  const now = new Date();
  const reason = `Suspended for unpaid invoice ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id}`;
  await db
    .update(subscription)
    .set({ status: "suspended", updatedAt: now })
    .where(
      sql`${subscription.id} = ${input.invoiceRow.id} OR ${subscription.id} LIKE ${`sub_${input.invoiceRow.id}_%`}`,
    );

  const linkedSubscriptions = await db.query.subscription.findMany({
    where: sql`${subscription.id} = ${input.invoiceRow.id} OR ${subscription.id} LIKE ${`sub_${input.invoiceRow.id}_%`}`,
  });
  const subscriptionIds = linkedSubscriptions.map((row) => row.id);

  const websiteMap = new Map<string, typeof website.$inferSelect>();
  const invoiceWebsites = await db.query.website.findMany({
    where: eq(website.invoiceId, input.invoiceRow.id),
  });
  for (const site of invoiceWebsites) websiteMap.set(site.id, site);
  for (const subscriptionId of subscriptionIds) {
    const subscriptionWebsites = await db.query.website.findMany({
      where: eq(website.subscriptionId, subscriptionId),
    });
    for (const site of subscriptionWebsites) websiteMap.set(site.id, site);
  }
  const directlyLinkedWebsites = [...websiteMap.values()];
  if (directlyLinkedWebsites.length) {
    for (const site of directlyLinkedWebsites) {
      await db
        .update(website)
        .set({
          status: "suspended",
          containerStatus: "suspended",
          suspendedAt: now,
          suspensionReason: reason,
          updatedAt: now,
        })
        .where(eq(website.id, site.id));
      await db
        .update(websiteStore)
        .set({
          status: "suspended",
          suspendedAt: now,
          updatedAt: now,
        })
        .where(eq(websiteStore.websiteId, site.id));
    }
  }

  const order = await db.query.domainOrder.findFirst({
    where: eq(domainOrder.invoiceId, input.invoiceRow.id),
  });
  if (order) {
    await db
      .update(domainOrder)
      .set({ status: "suspended", updatedAt: now })
      .where(eq(domainOrder.id, order.id));
    await db
      .update(registeredDomain)
      .set({ status: "suspended", updatedAt: now })
      .where(eq(registeredDomain.id, order.domainName));
  }

  const items = await db.query.invoiceItem.findMany({
    where: eq(invoiceItem.invoiceId, input.invoiceRow.id),
  });
  const itemPlans = await Promise.all(
    items
      .filter((item) => item.planId)
      .map((item) =>
        db.query.servicePlan.findFirst({
          where: eq(servicePlan.id, item.planId!),
          with: { service: true },
        }),
      ),
  );
  const plansById = new Map(itemPlans.filter(Boolean).map((plan) => [plan!.id, plan!]));
  const hasVultrServer = items.some((item) => {
    const plan = item.planId ? plansById.get(item.planId) : null;
    const text =
      `${item.description} ${plan?.id ?? ""} ${plan?.service?.id ?? ""} ${plan?.service?.name ?? ""}`.toLowerCase();
    return text.includes("vultr") || text.includes("vps") || text.includes("server");
  });
  if (hasVultrServer) {
    const instances = await db.query.vultrInstance.findMany({
      where: eq(vultrInstance.userId, input.invoiceRow.userId),
    });
    for (const instance of instances) {
      try {
        if (instance.powerStatus !== "stopped") await stopInstance(instance.id);
      } catch (error) {
        console.error(`Failed to stop Vultr instance ${instance.id}:`, error);
      }
      await db
        .update(vultrInstance)
        .set({
          status: instance.status === "active" ? "suspended" : instance.status,
          powerStatus: "stopped",
          suspendedAt: now,
          suspensionReason: reason,
          updatedAt: now,
        })
        .where(eq(vultrInstance.id, instance.id));
    }
  }

  await db
    .update(invoice)
    .set({
      status: "overdue",
      collectionStatus: "suspended",
      suspendedAt: now,
      updatedAt: now,
    })
    .where(eq(invoice.id, input.invoiceRow.id));

  await recordAudit({
    actorUserId: input.actorUserId ?? null,
    action: "invoice.collection.suspended",
    entityType: "invoice",
    entityId: input.invoiceRow.id,
    message: reason,
    level: "warning",
    metadata: {
      websites: directlyLinkedWebsites.map((site) => site.id),
      domainOrderId: order?.id ?? null,
      vultrSuspended: hasVultrServer,
    },
  });
}

async function sendInvoiceCollectionReminder(input: {
  invoiceRow: typeof invoice.$inferSelect;
  customer: typeof user.$inferSelect;
  day: number;
  origin: string;
}) {
  const settings = await getWorkspaceSettings();
  const billing = getWorkspaceBillingDetails(settings);
  const method = input.invoiceRow.paymentMethod === "eft" ? "eft" : "gateway";
  const daysLeft = Math.max(0, 7 - input.day);
  const invoiceUrl = `${input.origin}/dashboard/billing/invoices/${encodeURIComponent(input.invoiceRow.id)}`;
  const paymentLine =
    method === "eft"
      ? `Please pay by EFT using these details:\nBank: ${billing.bankName}\nAccount name: ${billing.bankAccountName}\nAccount number: ${billing.bankAccountNumber}\nBranch code: ${billing.bankBranchCode}\nReference: ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id}`
      : `Please use the secure payment link on your invoice. Payment link: ${input.invoiceRow.paystackUrl ?? invoiceUrl}`;
  await sendEmail({
    template: "generic",
    to: input.customer.email,
    subject: `CloudMonkey payment reminder: ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id}`,
    data: {
      firstName: input.customer.name,
      emailTitle: "Invoice payment reminder",
      emailIntro: `Invoice ${input.invoiceRow.invoiceNumber ?? input.invoiceRow.id} is still outstanding.`,
      emailBody: `Amount due: ${formatEmailMoney(input.invoiceRow.amount, input.invoiceRow.currency ?? "ZAR")}\nCollection day: ${input.day} of 7\nSuspension countdown: ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining before automated suspension.\n\n${paymentLine}`,
      primaryCtaText: method === "eft" ? "Open invoice" : "Pay invoice",
      primaryCtaUrl: invoiceUrl,
    },
    idempotencyKey: `invoice:${input.invoiceRow.id}:collection:${input.day}`,
  });
}

async function runInvoiceCollections(input: { origin: string; actorUserId?: string | null }) {
  const now = new Date();
  const openInvoices = await db.query.invoice.findMany({
    where: sql`${invoice.status} IN ('pending', 'overdue')`,
    orderBy: (invoice, { asc }) => [asc(invoice.createdAt)],
  });
  const summary = { scanned: openInvoices.length, reminded: 0, suspended: 0, skipped: 0 };

  for (const row of openInvoices) {
    const start = row.publishedAt ?? row.issuedAt ?? row.createdAt;
    const elapsedDays = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (elapsedDays < 1) {
      summary.skipped += 1;
      continue;
    }

    if (row.paystackReference && row.status !== "paid") {
      try {
        const verification = await verifyPayment(row.paystackReference);
        const paid =
          verification?.data?.status === "success" ||
          verification?.data?.gateway_response === "Successful";
        if (paid) {
          const [updatedInvoice] = await db
            .update(invoice)
            .set({ status: "paid", collectionStatus: "paid", paidAt: now, updatedAt: now })
            .where(eq(invoice.id, row.id))
            .returning();
          await activateBillingAfterPayment({
            invoiceRow: updatedInvoice,
            origin: input.origin,
            actorUserId: input.actorUserId ?? null,
            paymentId: row.paystackReference,
          });
          summary.skipped += 1;
          continue;
        }
      } catch (error) {
        console.error(`Payment verification failed during collections for ${row.id}:`, error);
      }
    }

    const day = Math.min(7, elapsedDays);
    if (day >= 7) {
      if (!row.suspendedAt) {
        await suspendResourcesForInvoice({
          invoiceRow: row,
          origin: input.origin,
          actorUserId: input.actorUserId ?? null,
        });
        summary.suspended += 1;
      } else {
        summary.skipped += 1;
      }
      continue;
    }

    if (row.collectionDayCount >= day) {
      summary.skipped += 1;
      continue;
    }

    const customer = await db.query.user.findFirst({ where: eq(user.id, row.userId) });
    if (!customer?.email) {
      summary.skipped += 1;
      continue;
    }
    await sendInvoiceCollectionReminder({
      invoiceRow: row,
      customer,
      day,
      origin: input.origin,
    });
    await db
      .update(invoice)
      .set({
        status: row.status === "pending" && now > row.dueDate ? "overdue" : row.status,
        collectionStatus: "reminder",
        collectionDayCount: day,
        firstReminderAt: row.firstReminderAt ?? now,
        lastReminderAt: now,
        nextReminderAt: addDays(now, 1),
        suspensionDueAt: addDays(start, 7),
        updatedAt: now,
      })
      .where(eq(invoice.id, row.id));
    summary.reminded += 1;
  }

  await recordAudit({
    actorUserId: input.actorUserId ?? null,
    action: "invoice.collections.run",
    entityType: "invoice",
    entityId: "collections",
    message: `Invoice collections run: ${summary.reminded} reminders, ${summary.suspended} suspensions`,
    metadata: summary,
  });
  return summary;
}

const domainOrderSchema = z.object({
  domainName: z.string().min(3),
  domainPlanId: z.string().min(1),
  addonPlanIds: z.array(z.string().min(1)).optional().default([]),
});

const supportAgentToolCallSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domain_availability"), domain: z.string().min(3) }),
  z.object({ type: z.literal("owned_domains") }),
  z.object({ type: z.literal("domain_dns"), domain: z.string().min(3) }),
  z.object({ type: z.literal("domain_info"), domain: z.string().min(3) }),
  z
    .object({
      type: z.literal("website_lookup"),
      websiteId: z.string().min(1).optional(),
      domain: z.string().min(3).optional(),
    })
    .refine((value) => value.websiteId || value.domain, {
      message: "Website ID or domain is required",
    }),
  z.object({
    type: z.literal("website_deploy"),
    websiteId: z.string().min(1),
    deploymentDomain: z.enum(["temporary", "primary"]).optional().default("temporary"),
  }),
  z.object({
    type: z.literal("website_remediate"),
    websiteId: z.string().min(1),
    action: z.literal("restart").default("restart"),
  }),
]);

const supportAgentResponseSchema = z.object({
  reply: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  intent: z
    .enum([
      "support",
      "billing",
      "signup_guidance",
      "domain_check",
      "dns_query",
      "onboarding",
      "general",
    ])
    .optional(),
  createTicket: z.boolean().optional(),
  ticket: z
    .object({
      subject: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      category: z.string().optional(),
    })
    .optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().optional(),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  toolCalls: z.array(supportAgentToolCallSchema).optional().default([]),
  suggestedActions: z
    .array(z.object({ label: z.string(), href: z.string() }))
    .optional()
    .default([]),
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
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(140).optional().nullable(),
        websiteUrl: z.string().url(),
        competitorType: z
          .enum(["manual", "organic", "local", "ad", "content", "pricing"])
          .optional()
          .default("manual"),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

const intelligenceProjectUpdateSchema = intelligenceProjectSchema.partial().omit({
  targetKeywords: true,
  competitors: true,
});

const intelligenceCompetitorSchema = z.object({
  name: z.string().min(1).max(140).optional().nullable(),
  websiteUrl: z.string().url(),
  competitorType: z
    .enum(["manual", "organic", "local", "ad", "content", "pricing"])
    .optional()
    .default("manual"),
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
  scores: z
    .object({
      visibilityScore: z.coerce.number().int().min(0).max(100).optional(),
      technicalSeoScore: z.coerce.number().int().min(0).max(100).optional(),
      contentSeoScore: z.coerce.number().int().min(0).max(100).optional(),
      contentGapScore: z.coerce.number().int().min(0).max(100).optional(),
      localSeoScore: z.coerce.number().int().min(0).max(100).optional(),
      performanceScore: z.coerce.number().int().min(0).max(100).optional(),
      aiReadinessScore: z.coerce.number().int().min(0).max(100).optional(),
      opportunityScore: z.coerce.number().int().min(0).max(100).optional(),
    })
    .optional()
    .default({}),
  competitors: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        websiteUrl: z.string().url(),
        competitorType: z.string().optional().default("organic"),
        visibilityScore: z.coerce.number().int().min(0).max(100).optional(),
        technicalSeoScore: z.coerce.number().int().min(0).max(100).optional(),
        contentSeoScore: z.coerce.number().int().min(0).max(100).optional(),
        localSeoScore: z.coerce.number().int().min(0).max(100).optional(),
        metadata: z.unknown().optional(),
      }),
    )
    .optional()
    .default([]),
  rankings: z
    .array(
      z.object({
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
      }),
    )
    .optional()
    .default([]),
  crawlPages: z
    .array(
      z.object({
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
      }),
    )
    .optional()
    .default([]),
  audits: z
    .array(
      z.object({
        target: z.string().optional().default("primary"),
        targetUrl: z.string().url(),
        technicalScore: z.coerce.number().int().min(0).max(100).optional().default(0),
        contentScore: z.coerce.number().int().min(0).max(100).optional().default(0),
        localScore: z.coerce.number().int().min(0).max(100).optional().default(0),
        performanceScore: z.coerce.number().int().min(0).max(100).optional().default(0),
        aiReadinessScore: z.coerce.number().int().min(0).max(100).optional().default(0),
        summary: z.string().optional().nullable(),
        raw: z.unknown().optional(),
      }),
    )
    .optional()
    .default([]),
  issues: z
    .array(
      z.object({
        auditId: z.string().optional().nullable(),
        crawlPageId: z.string().optional().nullable(),
        category: z.string().min(1),
        severity: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        recommendation: z.string().optional().nullable(),
        sourceUrl: z.string().optional().nullable(),
        status: z.string().optional().default("open"),
      }),
    )
    .optional()
    .default([]),
  contentGaps: z
    .array(
      z.object({
        competitorId: z.string().optional().nullable(),
        gapType: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        opportunity: z.enum(["low", "medium", "high", "very_high"]).optional().default("medium"),
        sourceUrl: z.string().optional().nullable(),
        suggestedAction: z.string().optional().nullable(),
        status: z.string().optional().default("open"),
      }),
    )
    .optional()
    .default([]),
  serpResults: z
    .array(
      z.object({
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
      }),
    )
    .optional()
    .default([]),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        category: z.string().optional().default("seo"),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
        impact: z.enum(["low", "medium", "high"]).optional().default("medium"),
        effort: z.enum(["low", "medium", "high"]).optional().default("medium"),
        sourceType: z.string().optional().nullable(),
        sourceId: z.string().optional().nullable(),
        status: z.string().optional().default("open"),
      }),
    )
    .optional()
    .default([]),
  report: z
    .object({
      title: z.string().min(1).optional(),
      status: z.string().optional().default("published"),
      executiveSummary: z.string().optional().nullable(),
      insightPacket: z.unknown().optional(),
      reportJson: z.unknown().optional(),
      pdfUrl: z.string().optional().nullable(),
    })
    .optional(),
});

const n8nIntegrationSchema = z.object({
  instanceId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

const n8nSyncSchema = z.object({
  instanceId: z.string().min(1),
});

const webhooksHandlers = createWebhookHandlers({
  db,
  json,
  recordAudit,
  sendEmail,
  verifyMailjetWebhookSignature,
  verifyIntelligenceWebhook,
  persistIntelligenceWebhookResult,
  parseBody,
  intelligenceWebhookResultSchema,
  proposal,
  invoice,
  subscription,
  domainOrder,
  user,
  formatEmailMoney,
  createAffiliateCommissionForPayment,
  upsertManualInvoiceLineSubscriptions,
  tryRegisterPaidDomainOrder,
  makeId,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  tokenFeatureRate,
  tokenTopupIntent,
});

const walletHandlers = createWalletHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  recordAudit,
  makeId,
  initializePayment,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  tokenFeatureRate,
  tokenTopupIntent,
  user,
});

const walletServiceDeps = {
  db,
  json,
  recordAudit,
  makeId,
  initializePayment,
  tokenWallet,
  tokenWalletLedger,
  tokenWalletReservation,
  tokenFeatureRate,
  tokenTopupIntent,
  user,
};

const websiteGrowthHandlers = createWebsiteGrowthHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  recordAudit,
  sendEmail,
  makeId,
  website,
  user,
  websiteGrowthAgent,
  websiteGrowthRun,
  websiteGrowthMessage,
  websiteGrowthProposal,
  platformApiUsage,
  provisionWebsiteRuntime: (ownerUserId, websiteId, options) =>
    provisionWebsiteRuntime(ownerUserId, websiteId, options),
});

const reserveWalletUsageBound = (input: Parameters<typeof reserveWalletUsage>[1]) =>
  reserveWalletUsage(walletServiceDeps, input);
const commitWalletReservationBound = (input: Parameters<typeof commitWalletReservation>[1]) =>
  commitWalletReservation(walletServiceDeps, input);
const releaseWalletReservationBound = (input: Parameters<typeof releaseWalletReservation>[1]) =>
  releaseWalletReservation(walletServiceDeps, input);

const supportChatHandlers = createSupportChatHandlers({
  db,
  json,
  parseBody,
  requireSession,
  makeId,
  safeJsonParse,
  getSupportCrmContext: (userId) => getSupportCrmContext({ db }, userId),
  resolveSupportChatSession: (userId, requestedSessionId) =>
    resolveSupportChatSession({ db, makeId }, userId, requestedSessionId),
  loadSupportChatHistory: (sessionId, limit) => loadSupportChatHistory({ db }, sessionId, limit),
  retrieveSupportKnowledge: (input) => retrieveSupportKnowledge({ db, makeId }, input),
  sendN8nSupportChat,
  reserveWalletUsage: reserveWalletUsageBound,
  commitWalletReservation: commitWalletReservationBound,
  releaseWalletReservation: releaseWalletReservationBound,
  executeToolCalls: (userId, toolCalls, access) =>
    executeSupportToolCalls(
      {
        db,
        recordAudit,
        provisionWebsiteRuntime: (ownerUserId, websiteId, options) =>
          provisionWebsiteRuntime(ownerUserId, websiteId, options),
        remediateWebsite: async (websiteId, actorUserId) => {
          const site = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
          if (!site) throw Object.assign(new Error("Website not found"), { status: 404 });
          let healthCheck = await db.query.websiteHealthCheck.findFirst({
            where: eq(websiteHealthCheck.websiteId, websiteId),
            orderBy: (check, { desc }) => [desc(check.checkedAt)],
          });
          if (!healthCheck) {
            const values = await checkWebsiteHealth(site, websiteHealthRequestTimeoutMs);
            const id = `whc_${crypto.randomUUID()}`;
            [healthCheck] = await db
              .insert(websiteHealthCheck)
              .values({ id, websiteId, ...values })
              .returning();
          }
          return requestWebsiteRemediation(websiteId, healthCheck.id, actorUserId);
        },
      },
      userId,
      toolCalls,
      access,
    ),
  storeSupportLearning: (input) => storeSupportLearning({ db, makeId }, input),
  readFile,
  stat,
  mkdir,
  writeFile,
  CHAT_UPLOAD_DIR,
  getAttachmentKind,
  maxBytesForAttachment,
  sanitizeFileName,
});

async function executeInternalAdminCopilotTools(input: {
  actorUserId: string;
  toolCalls: unknown[];
}) {
  const toolCalls = z.array(supportAgentToolCallSchema).parse(input.toolCalls);
  return executeSupportToolCalls(
    {
      db,
      recordAudit,
      provisionWebsiteRuntime: (ownerUserId, websiteId, options) =>
        provisionWebsiteRuntime(ownerUserId, websiteId, options),
      remediateWebsite: async (websiteId, actorUserId) => {
        const site = await db.query.website.findFirst({ where: eq(website.id, websiteId) });
        if (!site) throw Object.assign(new Error("Website not found"), { status: 404 });
        let healthCheck = await db.query.websiteHealthCheck.findFirst({
          where: eq(websiteHealthCheck.websiteId, websiteId),
          orderBy: (check, { desc }) => [desc(check.checkedAt)],
        });
        if (!healthCheck) {
          const values = await checkWebsiteHealth(site, websiteHealthRequestTimeoutMs);
          const id = `whc_${crypto.randomUUID()}`;
          [healthCheck] = await db
            .insert(websiteHealthCheck)
            .values({ id, websiteId, ...values })
            .returning();
        }
        return requestWebsiteRemediation(websiteId, healthCheck.id, actorUserId);
      },
    },
    input.actorUserId,
    toolCalls,
    { isAdmin: true, actorUserId: input.actorUserId },
  );
}

const caesarHandlers = createCaesarHandlers(
  {
    db,
    json,
    parseBody,
    requireSession,
    makeId,
    recordAudit,
  },
  () => ({
    brand: "CloudMonkey",
    promise: "One platform, one invoice, one accountable team.",
    markets: ["South Africa", "Namibia", "Botswana", "Nigeria", "Mozambique", "Kenya"],
    categories: CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
      tagline: category.tagline,
      services: category.services.map((service) => ({
        id: service.id,
        name: service.name,
        plans: service.plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          priceZar: plan.priceZar,
          setupPriceZar: plan.setupPriceZar,
          unit: plan.unit,
          minimumTermMonths: plan.minimumTermMonths,
          serviceDefinition: plan.serviceDefinition,
        })),
      })),
    })),
    bundles: BUNDLES.map((item) => ({
      id: item.id,
      name: item.name,
      priceZar: item.priceZar,
      setupPriceZar: item.setupPriceZar,
      minimumTermMonths: item.minimumTermMonths,
      description: item.description,
      serviceDefinition: item.serviceDefinition,
    })),
  }),
);

const affiliateHandlers = createAffiliateHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  recordAudit,
  makeId,
  encryptSecret,
  decryptSecret,
  affiliate,
  affiliateCommission,
  affiliateFraudFlag,
  affiliatePayout,
  affiliateReferral,
  user,
});

const billingHandlers = createBillingHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  makeId,
  initializePayment,
  verifyPayment,
  recordAudit,
  sendEmail,
  formatEmailDate,
  upsertManualInvoiceLineSubscriptions,
  createAffiliateCommissionForPayment,
  tryRegisterPaidDomainOrder,
  formatEmailMoney,
  agreementRequirementForProduct,
  safeServiceDefinition,
  signedAgreementExists,
  runInvoiceCollections,
  getWorkspaceSettings,
  getWorkspaceBillingDetails,
  captureInvoicePayment,
  sendInvoiceCollectionReminder,
  getInvoiceDocumentPayload,
  renderInvoicePdf,
  normalizeManualInvoiceLines,
  manualInvoiceSchema,
  manualPaymentCaptureSchema,
  invoiceVoidSchema,
  subscriptionSchema,
  invoice,
  invoiceItem,
  invoicePayment,
  subscription,
  domainOrder,
  user,
  servicePlan,
  bundle,
  addMonths,
});

const agentsRuntimeHandlers = createAgentsRuntimeHandlers({
  db,
  json,
  parseBody,
  requireAdmin,
  recordAudit,
  makeId,
  getRemoteIp,
  encryptSecret,
  decryptSecret,
  serverAgent,
  serverTelemetrySnapshot,
  serverSecurityFinding,
  serverWebsite,
  serverContainer,
  serverDatabase,
  detectedAiRuntime,
  vultrInstance,
  user,
});

const publicScanHandlers = createPublicScanHandlers({ getRemoteIp });

const adminHandlers = createAdminHandlers({
  db,
  json,
  parseBody,
  requireAdmin,
  recordAudit,
  sendEmail,
  makeId,
  encryptSecret,
  decryptSecret,
  getWorkspaceSettings,
  getWorkspaceBillingDetails,
  getSupportCrmContext: (userId) => getSupportCrmContext({ db }, userId),
  getAdminServerStatus,
  getAdminWebsiteHealth,
  resolveAdminChatSession,
  loadAdminChatHistory,
  adminChatMessage,
  sendN8nAdminChat,
  generateGeminiText,
  sanitizeN8nIntegration,
  syncN8nWorkflows,
  signMicrosoft365State,
  verifyMicrosoft365State,
  microsoft365ClientConfig,
  microsoft365Scopes,
  exchangeMicrosoft365Code,
  syncMicrosoft365Tenant,
  microsoft365RedirectUri,
});

const intelligenceHandlers = createIntelligenceHandlers({
  db,
  json,
  parseBody,
  requireIntelligenceAccess,
  requireAdmin,
  recordAudit,
  makeId,
  safeJsonParse,
  publicProjectDto,
  publicReportDto,
  getIntelligenceProjectForSession,
  buildIntelligenceOverview,
  sendN8nCompetitorIntelligence,
  crawlSiteFingerprint,
  fetchGoogleSearchConsoleSnapshot,
  intelligenceProject,
  intelligenceCompetitor,
  intelligenceKeyword,
  intelligenceKeywordRanking,
  intelligenceJob,
  intelligenceCrawlPage,
  intelligenceSeoAudit,
  intelligenceSerpResult,
  intelligencePageIssue,
  intelligenceContentGap,
  intelligenceRecommendation,
  intelligenceReport,
  user,
  reserveWalletUsage: reserveWalletUsageBound,
  commitWalletReservation: commitWalletReservationBound,
  releaseWalletReservation: releaseWalletReservationBound,
  intelligenceProjectCreateSchema: intelligenceProjectSchema,
  intelligenceCompetitorSchema,
  intelligenceKeywordSchema,
  intelligenceScanSchema,
  buildIntelligenceProjectUpdateSchema,
});

const internalToolsHandlers = createInternalToolsHandlers({
  db,
  json,
  recordInternalToolAudit,
  getRequestIp,
  getRequestUserAgent,
  verifyInternalSqlConsoleAccess,
  verifyInternalAdminSecondFactor,
  sendInvoiceCollectionReminder,
  invoice,
  user,
  eq,
  recordAudit,
});

const domainsHandlers = createDomainsHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  makeId,
  initializePayment,
  sendEmail,
  formatEmailDate,
  formatEmailMoney,
  getWorkspaceSettings,
  getWorkspaceBillingDetails,
  servicePlan,
  invoice,
  invoiceItem,
  subscription,
  domainOrder,
  registeredDomain,
  supportTicket,
  addMonths,
  normalizeMinimumTermMonths,
  recordAudit,
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

const websiteSchema = z.object({
  userId: z.string().min(1),
  domain: z.string().min(1),
  plan: z.string().min(1),
  status: z.enum(["online", "offline", "maintenance"]).default("online"),
  githubRepo: z.string().optional().nullable(),
});

const userWebsiteCreateSchema = z.object({
  siteType: z.enum(["website", "ecommerce"]).default("website"),
  businessName: z.string().min(2).max(120),
  businessDescription: z.string().max(1000).optional().default(""),
  industry: z.string().max(120).optional().default(""),
  targetCustomers: z.string().max(500).optional().default(""),
  whatsapp: z.string().max(80).optional().default(""),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .default(""),
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

const adminWebsiteProjectCreateSchema = z.object({
  userId: z.string().min(1),
  siteType: z.enum(["website", "ecommerce"]),
  planId: z.string().min(1),
  subscriptionId: z.string().optional().nullable(),
  githubRepo: z.string().url().max(255).optional().or(z.literal("")).nullable(),
  businessName: z.string().min(2).max(120),
  businessDescription: z.string().max(1000).optional().default(""),
  industry: z.string().max(120).optional().default(""),
  preferredSlug: z.string().max(80).optional().default(""),
  subscriptionStatus: z.enum(["pending", "active", "trialing"]).optional().default("active"),
});

const adminDesignOptionSchema = z.object({
  styleLabel: z.string().min(1).max(120),
  notes: z.string().max(1000).optional().default(""),
  imageUrl: z.string().url().optional().or(z.literal("")).default(""),
});

const adminWebsiteDesignInputsSchema = z.object({
  designBrief: z.string().max(20000).optional().default(""),
  contentNotes: z.string().max(20000).optional().default(""),
  preferredStyle: z.string().max(2000).optional().default(""),
  mustHaveSections: z.string().max(5000).optional().default(""),
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

const websiteHandlers = createWebsiteHandlers({
  db,
  json,
  parseBody,
  requireSession,
  requireAdmin,
  recordAudit,
  sendEmail,
  makeId,
  safeJsonParse,
  addDays,
  getWorkspaceSettings,
  getUserWebsiteDetail,
  getUserWebsiteDashboardRows,
  createWebsiteProjectFromOnboarding,
  buildStoreDatabaseRecord,
  buildWebsiteProvisioningPlan,
  slugifySiteName,
  sendN8nWebsiteDesignPreviews,
  getWebsiteDesignGenerationContext,
  createMedusaProductForWebsite,
  storeProductCreateSchema,
  buildBasicWebsiteManifest,
  sendN8nBasicWebsiteBuild,
  provisionWebsiteRuntime,
  callRuntimeProvisioner,
  fetchIpv4,
  reserveWalletUsage: reserveWalletUsageBound,
  commitWalletReservation: commitWalletReservationBound,
  releaseWalletReservation: releaseWalletReservationBound,
  createApprovalToken,
  website,
  websiteStore,
  websiteStoreDatabase,
  websiteDomain,
  websitePluginInstall,
  websiteDesignOption,
  websiteReviewRequest,
  websiteApprovalToken,
  websiteRuntimeServer,
  onboardingSubmission,
  subscription,
  servicePlan,
  storeProduct,
  storeProductVariant,
  user,
  invoice,
  readFile,
  stat,
  mkdir,
  writeFile,
  WEBSITE_UPLOAD_DIR,
  WEBSITE_MAX_DESIGN_BYTES,
  ALLOWED_WEBSITE_DESIGN_TYPES,
  sanitizeFileName,
  isUploadedFile,
  adminWebsiteProjectCreateSchema,
  adminDesignOptionSchema,
  adminWebsiteDesignInputsSchema,
  userWebsiteCreateSchema,
  websiteOnboardingSchema,
  runtimeServerSchema,
  websiteSchema,
});

const aiWebsiteBuilderHandlers = createAiWebsiteBuilderHandlers({
  db,
  json,
  requireSession,
  parseBody,
  makeId,
  decryptSecret,
  reserveWalletUsage: reserveWalletUsageBound,
  commitWalletReservation: commitWalletReservationBound,
  releaseWalletReservation: releaseWalletReservationBound,
  provisionWebsiteRuntime,
  platformApiCredential,
  platformApiUsage,
  tokenWallet,
  tokenWalletLedger,
  website,
});

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const requestMethodSupportsStaticResponse =
      request.method === "GET" || request.method === "HEAD";

    if (
      requestMethodSupportsStaticResponse &&
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {
      return permanentRedirect(url.pathname.replace(/\/+$/, "") || "/");
    }

    const legacyRedirectTarget = legacyRedirects.get(url.pathname.toLowerCase());
    if (requestMethodSupportsStaticResponse && legacyRedirectTarget) {
      return permanentRedirect(legacyRedirectTarget);
    }

    if (
      url.pathname === "/sitemap.xml" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return new Response(request.method === "HEAD" ? null : renderSitemapXml(), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/robots.txt" && requestMethodSupportsStaticResponse) {
      return new Response(request.method === "HEAD" ? null : renderRobotsTxt(), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/llms.txt" && requestMethodSupportsStaticResponse) {
      return new Response(request.method === "HEAD" ? null : renderLlmsTxt(), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
      const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
      if (!session) {
        const callbackURL = `${url.pathname}${url.search}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/auth/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`,
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
    }

    if (url.pathname === "/service-suspended" && requestMethodSupportsStaticResponse) {
      const invoiceId = url.searchParams.get("invoice");
      const invoiceUrl = invoiceId
        ? `${url.origin}/dashboard/billing/invoices/${encodeURIComponent(invoiceId)}`
        : null;
      return new Response(
        request.method === "HEAD"
          ? null
          : renderSuspendedServicePage({
              domain: url.searchParams.get("domain"),
              invoiceUrl,
            }),
        {
          status: 402,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    }

    if (url.pathname === "/.well-known/traffic-advice" && requestMethodSupportsStaticResponse) {
      return new Response(request.method === "HEAD" ? null : "[]", {
        headers: {
          "Content-Type": "application/trafficadvice+json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    if (url.pathname === "/favicon.ico" && requestMethodSupportsStaticResponse) {
      return permanentRedirect("/assets/cm-logo-Bqwc6v-P.png");
    }

    if (url.pathname === "/sw.js" && requestMethodSupportsStaticResponse) {
      return new Response(null, {
        status: 204,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    if (url.pathname === "/api/public/auth-security-config" && request.method === "GET") {
      const siteKey = process.env.RECAPTCHA_SITE_KEY ?? "";
      return json({
        recaptcha: {
          enabled: Boolean(siteKey && process.env.RECAPTCHA_SECRET_KEY),
          siteKey: siteKey || null,
          action: "auth_email",
        },
      });
    }

    if (url.pathname === "/api/public/pricing" && request.method === "GET") {
      try {
        const [categories, services, plans, planFeatures, bundles, bundleFeatures] =
          await Promise.all([
            db.query.serviceCategory.findMany({
              orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
            }),
            db.query.service.findMany({
              where: eq(service.visibility, "public"),
              orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
            }),
            db.query.servicePlan.findMany({
              orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
            }),
            db.query.serviceFeature.findMany(),
            db.query.bundle.findMany({
              orderBy: (row: any, { asc }: any) => [asc(row.sortOrder)],
            }),
            db.query.bundleFeature.findMany(),
          ]);

        if (categories.length || services.length || plans.length || bundles.length) {
          return json(
            buildPublicPricingResponseFromDatabase({
              categories,
              services,
              plans,
              planFeatures,
              bundles,
              bundleFeatures,
            }),
          );
        }
      } catch (error) {
        console.error(
          "Failed to load database pricing catalog, falling back to static catalog:",
          error,
        );
      }

      return json(serializePublicPricingCatalog({ categories: CATEGORIES, bundles: BUNDLES }));
    }

    if (url.pathname === "/api/public/caesar") {
      return caesarHandlers.handlePublicCaesar(request);
    }

    if (url.pathname.startsWith("/api/auth")) {
      const signupBody =
        url.pathname.endsWith("/sign-up/email") && request.method === "POST"
          ? await request
              .clone()
              .json()
              .catch(() => null)
          : null;
      const authResponse = await auth.handler(request);
      if (signupBody && authResponse.ok && typeof signupBody?.email === "string") {
        sendEmail({
          template: "welcome",
          to: signupBody.email,
          subject: "Welcome to CloudMonkey",
          data: {
            firstName: signupBody.name,
            primaryCtaText: "Open your dashboard",
            primaryCtaUrl: `${new URL(request.url).origin}/dashboard`,
          },
          idempotencyKey: `welcome:${signupBody.email}`,
        }).catch((error) => console.error("Welcome email failed:", error));
      }
      return authResponse;
    }

    if (url.pathname === "/api/user/security-status" && request.method === "GET") {
      const { session, response } = await requireSession(request);
      if (response) return response;

      const accounts = await db.query.account.findMany({
        where: eq(account.userId, session.user.id),
      });
      const providerIds = accounts.map((row) => row.providerId);
      const hasCredential = providerIds.includes("credential");
      const hasTrustedSso = providerIds.some(
        (providerId) => providerId === "google" || providerId === "microsoft",
      );
      const currentUser = await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
      });

      return json({
        requiresTwoFactorSetup: hasCredential && !hasTrustedSso && !currentUser?.twoFactorEnabled,
        twoFactorEnabled: !!currentUser?.twoFactorEnabled,
        providers: providerIds,
      });
    }

    if (url.pathname === "/api/user/caesar/claim") {
      return caesarHandlers.handleClaimCaesar(request);
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

    if (
      url.pathname.startsWith("/api/public/website-design-options/") &&
      url.pathname.endsWith("/image") &&
      request.method === "GET"
    ) {
      return websiteHandlers.handlePublicWebsiteDesignImage(request);
    }

    if (url.pathname.startsWith("/api/public/website-approvals/")) {
      return websiteHandlers.handlePublicWebsiteApproval(request);
    }

    if (url.pathname.startsWith("/api/agent/enroll")) {
      return agentsRuntimeHandlers.handleAgentEnroll(request);
    }

    if (url.pathname.startsWith("/api/agent/config")) {
      return agentsRuntimeHandlers.handleAgentConfig(request);
    }

    if (url.pathname.startsWith("/api/agent/heartbeat")) {
      return agentsRuntimeHandlers.handleAgentHeartbeat(request);
    }

    if (url.pathname.startsWith("/api/agent/snapshot")) {
      return agentsRuntimeHandlers.handleAgentSnapshot(request);
    }

    if (url.pathname.startsWith("/api/public/affiliate-click") && request.method === "POST") {
      return affiliateHandlers.handlePublicAffiliateClick(request);
    }

    if (url.pathname.startsWith("/api/public/affiliate-application") && request.method === "POST") {
      return affiliateHandlers.handlePublicAffiliateApplication(request);
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

        return new Response(
          JSON.stringify({
            totalSpend,
            domains: domains.length,
            cloudResources: servers.length,
            websites: websites.length,
            activeAgents: agents.filter((agent) => agent.status === "active").length,
            openTickets: openTickets.filter(
              (ticket) => !["resolved", "closed"].includes(ticket.status),
            ).length,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("Metrics error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch metrics" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/leads") && request.method === "POST") {
      try {
        const body = await parseBody(
          request,
          z.object({
            name: z.string().trim().min(1).max(140),
            email: z.string().email().max(320),
            company: z.string().trim().max(160).optional().nullable(),
            phone: z.string().max(80).optional().nullable(),
            services: z.string().max(2000).optional().nullable(),
            setupStyle: z.string().max(160).optional().nullable(),
            wizardAnswers: z.record(z.string(), z.unknown()).optional(),
            captureSource: z.string().max(80).optional(),
            consent: z.literal(true),
          }),
        );
        const wizardAnswers =
          body.wizardAnswers && typeof body.wizardAnswers === "object" ? body.wizardAnswers : null;
        const servicesValue = wizardAnswers
          ? JSON.stringify(stripPii(wizardAnswers))
          : body.services;
        await db.insert(lead).values({
          id: "lead_" + Date.now(),
          name: body.name,
          email: body.email,
          company: body.company,
          services: servicesValue,
          setupStyle: body.setupStyle,
          phone: body.phone ?? null,
          captureSource: body.captureSource ?? "website",
          consentAt: new Date(),
          scanFingerprint:
            body.captureSource === "seo_checker"
              ? sha256(JSON.stringify(stripPii(wizardAnswers ?? body.services ?? "")))
              : null,
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
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Lead submission error:", error);
        return new Response(JSON.stringify({ error: "Failed to submit lead" }), { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/webhooks/mailjet")) {
      return webhooksHandlers.handleMailjetWebhook(request);
    }

    if (url.pathname.startsWith("/api/webhooks/paystack")) {
      return webhooksHandlers.handlePaystackWebhook(request);
    }

    if (url.pathname.startsWith("/api/webhooks/intelligence")) {
      return webhooksHandlers.handleIntelligenceWebhook(request);
    }

    if (url.pathname === "/api/public/domains/check" || url.pathname === "/api/domains/check") {
      return webhooksHandlers.handleDomainsCheck(request);
    }

    if (url.pathname === "/api/public/scan") {
      return publicScanHandlers.handleGeneralScan(request);
    }

    if (
      url.pathname.match(/^\/api\/public\/handout\/[^/]+\/consume$/) &&
      request.method === "POST"
    ) {
      const token = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const row = await db.query.secureHandoutLink.findFirst({
        where: eq(secureHandoutLink.tokenHash, hashSecureToken(token)),
      });
      if (!row || row.revokedAt || row.usedAt || !isUnexpired(row.expiresAt)) {
        return json({ error: "Handout link is invalid or expired" }, 404);
      }
      if (row.direction === "request") {
        return json(
          { ok: true, mode: "request", expiresAt: row.expiresAt },
          { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
        );
      }
      const [claimed] = await db
        .update(secureHandoutLink)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(secureHandoutLink.id, row.id),
            isNull(secureHandoutLink.usedAt),
            isNull(secureHandoutLink.revokedAt),
          ),
        )
        .returning();
      if (!claimed) return json({ error: "Handout link has already been used" }, 410);
      return json(
        { ok: true, handout: JSON.parse(decryptSecret(row.payloadSecret)) },
        { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
      );
    }

    if (
      url.pathname.match(/^\/api\/public\/handout\/[^/]+\/submit$/) &&
      request.method === "POST"
    ) {
      const token = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const row = await db.query.secureHandoutLink.findFirst({
        where: eq(secureHandoutLink.tokenHash, hashSecureToken(token)),
      });
      if (
        !row ||
        row.direction !== "request" ||
        row.revokedAt ||
        row.submittedAt ||
        !isUnexpired(row.expiresAt)
      ) {
        return json({ error: "Handout request is invalid, expired, or already submitted" }, 404);
      }
      const form = await request.formData();
      const credentials = String(form.get("credentials") ?? "")
        .trim()
        .slice(0, 20000);
      const file = form.get("file");
      const allowedTypes = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
      ]);
      let storagePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      if (isUploadedFile(file) && file.size > 0) {
        if (!allowedTypes.has(file.type ?? "") || file.size > 10 * 1024 * 1024)
          return json({ error: "Upload must be a PNG, JPG, WEBP, SVG, or PDF under 10 MB" }, 400);
        await mkdir(CHAT_UPLOAD_DIR, { recursive: true });
        fileName = sanitizeFileName(file.name ?? "asset");
        mimeType = file.type ?? "application/octet-stream";
        storagePath = join(CHAT_UPLOAD_DIR, `handout-${makeId("asset")}-${fileName}`);
        await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
      }
      if (!credentials && !storagePath)
        return json({ error: "Provide credentials or upload a file" }, 400);
      const [submitted] = await db
        .update(secureHandoutLink)
        .set({
          payloadSecret: encryptSecret(JSON.stringify({ credentials: credentials || null })),
          submittedAt: new Date(),
          submissionStoragePath: storagePath,
          submissionFileName: fileName,
          submissionMimeType: mimeType,
        })
        .where(
          and(
            eq(secureHandoutLink.id, row.id),
            isNull(secureHandoutLink.submittedAt),
            isNull(secureHandoutLink.revokedAt),
          ),
        )
        .returning();
      if (!submitted) return json({ error: "Handout request has already been submitted" }, 409);
      return json(
        { ok: true, submittedAt: submitted.submittedAt },
        { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
      );
    }

    if (url.pathname === "/api/public/seo-checker/scan" && request.method === "POST") {
      const { session, response } = await requireSession(request);
      if (response) return response;
      const scanResponse = await publicScanHandlers.handleGeneralScan(request);
      if (!session) return scanResponse;
      return scanResponse;
    }

    if (
      (url.pathname === "/api/public/tools/ssl-check" ||
        url.pathname === "/api/public/tools/uptime-check") &&
      request.method === "POST"
    ) {
      const { response } = await requireSession(request);
      if (response) return response;
      try {
        const body = await parseBody(request, z.object({ url: z.string().url().max(2048) }));
        const target = new URL(body.url);
        if (!/^https?:$/.test(target.protocol) || isPrivateToolHost(target.hostname)) {
          return json({ error: "Enter a public HTTP or HTTPS website URL" }, 400);
        }
        if (url.pathname.endsWith("ssl-check")) {
          const ssl =
            target.protocol === "https:"
              ? await probeServerSsl(target.hostname)
              : { status: "missing", issuer: null, expiresAt: null, hostnameMatches: null };
          const daysRemaining = ssl.expiresAt
            ? Math.floor((Date.parse(ssl.expiresAt) - Date.now()) / 86_400_000)
            : null;
          const findings = [];
          if (target.protocol !== "https:")
            findings.push({
              code: "https_required",
              title: "HTTPS is not enabled",
              detail: "Your website is not using an encrypted HTTPS connection.",
            });
          if (ssl.status !== "valid")
            findings.push({
              code: "ssl_invalid",
              title: "SSL certificate could not be validated",
              detail: `Certificate status: ${ssl.status}.`,
            });
          if (ssl.hostnameMatches === false)
            findings.push({
              code: "ssl_hostname_mismatch",
              title: "Certificate hostname mismatch",
              detail: "The certificate does not match this domain.",
            });
          if (daysRemaining !== null && daysRemaining < 30)
            findings.push({
              code: "ssl_expiring",
              title: "SSL certificate expires soon",
              detail: `The certificate expires in ${daysRemaining} days.`,
            });
          return json({
            ok: findings.length === 0,
            url: target.toString(),
            issuer: ssl.issuer,
            expiresAt: ssl.expiresAt,
            daysRemaining,
            chainValid: ssl.status === "valid",
            hostnameMatches: ssl.hostnameMatches,
            findings,
            upsells: mapFreeToolFindingsToUpsells("ssl", findings),
          });
        }

        const hops: Array<{ url: string; status: number | null }> = [];
        let current = target;
        let responseStatus: number | null = null;
        const startedAt = Date.now();
        for (let index = 0; index < 6; index += 1) {
          const response = await fetchIpv4(current, { method: "HEAD", timeoutMs: 8_000 });
          responseStatus = response.status;
          hops.push({ url: current.toString(), status: response.status });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get("location");
          if (!location) break;
          const next = new URL(location, current);
          if (!/^https?:$/.test(next.protocol) || isPrivateToolHost(next.hostname)) break;
          current = next;
        }
        const findings =
          responseStatus === null || responseStatus >= 400
            ? [
                {
                  code: "uptime_down",
                  title: "Website is not responding successfully",
                  detail: responseStatus
                    ? `The site returned HTTP ${responseStatus}.`
                    : "The site could not be reached.",
                },
              ]
            : [];
        return json({
          ok: findings.length === 0,
          url: target.toString(),
          finalUrl: current.toString(),
          status: responseStatus,
          responseTimeMs: Date.now() - startedAt,
          redirects: hops.slice(0, -1),
          redirectCount: Math.max(0, hops.length - 1),
          findings,
          upsells: mapFreeToolFindingsToUpsells("uptime", findings),
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Tool check failed" }, 400);
      }
    }

    if (url.pathname.startsWith("/api/user/wallet")) {
      if (url.pathname.startsWith("/api/user/wallet/top-ups")) {
        return walletHandlers.handleUserWalletTopUps(request);
      }
      return walletHandlers.handleUserWallet(request);
    }

    if (url.pathname.startsWith("/api/admin/wallet")) {
      if (url.pathname.startsWith("/api/admin/wallet/adjust")) {
        return walletHandlers.handleAdminWalletAdjustments(request);
      }
      return walletHandlers.handleAdminWallet(request);
    }

    if (url.pathname === "/api/admin/handout-links" && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      if (!session) return json({ error: "Unauthorized" }, 401);
      try {
        const body = await parseBody(
          request,
          z.object({
            handout: z.record(z.string(), z.unknown()),
            recipientEmail: z.string().email().optional().nullable(),
            direction: z.enum(["view", "request"]).default("view"),
            ticketId: z.string().optional().nullable(),
            expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
          }),
        );
        const token = createSecureToken();
        const expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);
        const [created] = await db
          .insert(secureHandoutLink)
          .values({
            id: makeId("handout"),
            userId: session.user.id,
            tokenHash: token.hash,
            payloadSecret: encryptSecret(JSON.stringify(body.handout)),
            direction: body.direction,
            ticketId: body.ticketId ?? null,
            recipientEmail: body.recipientEmail ?? null,
            expiresAt,
          })
          .returning();
        await recordAudit({
          actorUserId: session.user.id,
          action: "handout_link.created",
          entityType: "secure_handout_link",
          entityId: created.id,
          message: "Secure handout link created",
          metadata: { expiresAt, recipientEmail: body.recipientEmail ?? null },
        });
        return json({
          id: created.id,
          url: `${new URL(request.url).origin}/handout/${token.raw}`,
          expiresAt,
        });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 400);
      }
    }

    if (url.pathname.startsWith("/api/user/intelligence")) {
      return intelligenceHandlers.handleUserIntelligence(request);
    }

    if (url.pathname.startsWith("/api/admin/intelligence")) {
      return intelligenceHandlers.handleAdminIntelligence(request);
    }

    if (url.pathname.startsWith("/api/user/affiliate")) {
      return affiliateHandlers.handleUserAffiliate(request);
    }

    if (url.pathname.startsWith("/api/admin/affiliates")) {
      return affiliateHandlers.handleAdminAffiliates(request);
    }

    if (url.pathname.startsWith("/api/user/subscription/verify")) {
      return billingHandlers.handleSubscriptionVerify(request);
    }

    if (url.pathname === "/api/user/agreement-requirement") {
      return billingHandlers.handleAgreementRequirement(request);
    }

    if (url.pathname.startsWith("/api/user/subscription")) {
      const { session, response } = await requireSession(request);
      if (response) return response;

      if (request.method === "POST") {
        try {
          const body = await parseBody(
            request,
            z
              .object({
                planId: z.string().min(1).optional().nullable(),
                bundleId: z.string().min(1).optional().nullable(),
                name: z.string().min(1).optional().nullable(),
                amount: z.coerce.number().int().nonnegative().optional().nullable(),
                interval: z.enum(["month", "year"]).optional(),
                currentPeriodEnd: z.string().optional().nullable(),
                couponCode: z.string().max(80).optional().nullable(),
                agreementAccepted: z.boolean().optional(),
                agreementConsentText: z.string().max(1000).optional().nullable(),
              })
              .refine((value) => !(value.planId && value.bundleId), {
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

          if ((body.planId && !planRow) || (body.bundleId && !bundleRow)) {
            return json({ error: "Selected product was not found" }, 404);
          }
          if (planRow && !planRow.active) {
            return json({ error: "Selected product is not available for checkout" }, 400);
          }
          if (bundleRow && !bundleRow.active) {
            return json({ error: "Selected bundle is not available for checkout" }, 400);
          }
          const selectedBillingType = planRow?.billingType ?? bundleRow?.billingType ?? "recurring";
          const selectedBillingFrequency = normalizeBillingFrequency(planRow ?? bundleRow ?? {});
          if (selectedBillingType === "quote") {
            return json({ error: "This product requires a quote before checkout" }, 400);
          }

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
          const amount = coupon
            ? applyPercentDiscount(originalAmount, coupon.percentOff)
            : originalAmount;
          if (!originalAmount) {
            return json({ error: "A payable amount is required" }, 400);
          }

          const email = session.user.email ?? "";
          if (!email) {
            return json({ error: "User email is required for payment checkout" }, 400);
          }

          const name =
            body.name ??
            (planRow
              ? `${planRow.service?.name ?? "Service"} - ${planRow.name}`
              : bundleRow?.name) ??
            "Selected package";
          const serviceDefinition = safeServiceDefinition(
            planRow?.serviceDefinition ?? bundleRow?.serviceDefinition ?? null,
          );
          const agreementRequirement =
            productType && productId
              ? await agreementRequirementForProduct({
                  productType,
                  productId,
                  productName: name,
                  serviceDefinition,
                })
              : null;
          const interval = frequencyToInterval(selectedBillingFrequency);
          const selectedMinimumTermMonths = normalizeMinimumTermMonths(planRow ?? bundleRow ?? {});
          const currentPeriodEnd = body.currentPeriodEnd
            ? new Date(body.currentPeriodEnd)
            : (() => {
                const end = new Date();
                end.setMonth(end.getMonth() + (interval === "year" ? 12 : 1));
                return end;
              })();
          const existingSubscriptions = await db.query.subscription.findMany({
            where: eq(subscription.userId, session.user.id),
            with: {
              plan: { with: { service: true } },
              bundle: true,
            },
            orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
          });
          const matchesProduct = (row: (typeof existingSubscriptions)[number]) => {
            if (!productId) return row.name === name;
            if (productType === "plan") return row.planId === productId;
            if (productType === "bundle") return row.bundleId === productId;
            return false;
          };
          const accessSubscription = existingSubscriptions.find(
            (row) => (row.status === "active" || row.status === "trialing") && matchesProduct(row),
          );
          if (accessSubscription) {
            if (agreementRequirement && body.agreementAccepted) {
              await signAgreementForSubscription({
                request,
                userId: session.user.id,
                subscriptionId: accessSubscription.id,
                productType: productType!,
                productId: productId!,
                productName: name,
                serviceDefinition,
                consentText: body.agreementConsentText,
              });
            }
            return json(
              {
                subscription: accessSubscription,
                alreadyActive: true,
              },
              200,
            );
          }

          const pendingSubscription = existingSubscriptions.find(
            (row) => row.status === "pending" && matchesProduct(row),
          );
          if (planRow?.service?.categoryId === "build") {
            const existingBuildSubscription = existingSubscriptions.find(
              (row) =>
                ["pending", "active", "trialing"].includes(row.status) &&
                row.plan?.service?.categoryId === "build" &&
                !matchesProduct(row),
            );
            if (existingBuildSubscription) {
              return json(
                {
                  error:
                    "Build subscriptions are limited to one company, one brand, and one active build project per account. Please finish or cancel the existing build subscription before starting another.",
                },
                409,
              );
            }
          }
          const existingInvoice = pendingSubscription
            ? await db.query.invoice.findFirst({ where: eq(invoice.id, pendingSubscription.id) })
            : null;

          if (agreementRequirement) {
            const hasSignedAgreement = pendingSubscription
              ? await signedAgreementExists({
                  userId: session.user.id,
                  subscriptionId: pendingSubscription.id,
                  templateId: agreementRequirement.template.id,
                  documentHash: agreementRequirement.documentHash,
                  productType: productType!,
                  productId: productId!,
                })
              : false;
            if (!hasSignedAgreement && !body.agreementAccepted) {
              return json(
                {
                  error: "Required service agreement must be reviewed and signed before checkout",
                  agreementRequired: true,
                  template: {
                    id: agreementRequirement.template.id,
                    title: agreementRequirement.template.title,
                    version: agreementRequirement.template.version,
                    documentType: agreementRequirement.template.documentType,
                  },
                  consentText: agreementRequirement.consentText,
                },
                428,
              );
            }
          }

          const signSelectedAgreement = async (subscriptionId: string) => {
            if (!agreementRequirement || !productType || !productId) return;
            await signAgreementForSubscription({
              request,
              userId: session.user.id,
              subscriptionId,
              productType,
              productId,
              productName: name,
              serviceDefinition,
              consentText: body.agreementConsentText,
            });
          };

          if (coupon && amount === 0) {
            const invoiceId = pendingSubscription?.id ?? makeId("inv");
            const subscriptionId = invoiceId;
            const issuedAt = new Date();
            const currentPeriodEnd = body.currentPeriodEnd
              ? new Date(body.currentPeriodEnd)
              : (() => {
                  const end = new Date();
                  end.setMonth(end.getMonth() + (interval === "year" ? 12 : 1));
                  return end;
                })();
            const dueDate = new Date();
            const settings = await getWorkspaceSettings();
            const workspaceBillingSnapshot = JSON.stringify(getWorkspaceBillingDetails(settings));
            const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId
              .replace(/^inv[_-]?/i, "")
              .replace(/[^a-z0-9]/gi, "")
              .slice(-6)
              .toUpperCase()}`;
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
                await db
                  .update(invoice)
                  .set({
                    amount,
                    status: "paid",
                    dueDate,
                    ...invoiceValues,
                    updatedAt: new Date(),
                  })
                  .where(eq(invoice.id, existingInvoice.id));
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
              const [updatedSubscription] = await db
                .update(subscription)
                .set({
                  planId: planRow?.id ?? body.planId ?? null,
                  bundleId: bundleRow?.id ?? body.bundleId ?? null,
                  name,
                  status: "active",
                  amount,
                  interval,
                  minimumTermMonths: selectedMinimumTermMonths,
                  minimumTermEndsAt: selectedMinimumTermMonths
                    ? addMonths(issuedAt, selectedMinimumTermMonths)
                    : null,
                  currentPeriodStart: issuedAt,
                  currentPeriodEnd,
                  requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
                  updatedAt: new Date(),
                })
                .where(eq(subscription.id, pendingSubscription.id))
                .returning();

              await signSelectedAgreement(updatedSubscription.id);

              await recordAudit({
                actorUserId: session.user.id,
                action: "subscription.coupon.activated",
                entityType: "subscription",
                entityId: updatedSubscription.id,
                message: `Coupon subscription activated for ${name}`,
                metadata: {
                  coupon: coupon.code,
                  percentOff: coupon.percentOff,
                  originalAmount,
                  amount,
                },
              });

              return json(
                { subscription: updatedSubscription, coupon, discounted: true, alreadyPaid: true },
                200,
              );
            }

            let createdSubscription: typeof subscription.$inferSelect;
            let createdInvoice: typeof invoice.$inferSelect;
            await db.transaction(async (tx) => {
              [createdInvoice] = await tx
                .insert(invoice)
                .values({
                  id: invoiceId,
                  userId: session.user.id,
                  amount,
                  status: "paid",
                  dueDate,
                  invoiceSource: "checkout",
                  ...invoiceValues,
                })
                .returning();
              [createdSubscription] = await tx
                .insert(subscription)
                .values({
                  id: subscriptionId,
                  userId: session.user.id,
                  bundleId: bundleRow?.id ?? body.bundleId ?? null,
                  planId: planRow?.id ?? body.planId ?? null,
                  name,
                  status: "active",
                  amount,
                  interval,
                  minimumTermMonths: selectedMinimumTermMonths,
                  minimumTermEndsAt: selectedMinimumTermMonths
                    ? addMonths(issuedAt, selectedMinimumTermMonths)
                    : null,
                  currentPeriodStart: issuedAt,
                  currentPeriodEnd,
                  requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
                })
                .returning();
              await tx.insert(invoiceItem).values([
                {
                  id: makeId("invitem"),
                  invoiceId,
                  description: name,
                  quantity: 1,
                  unitPrice: originalAmount,
                  amount: originalAmount,
                  recurring: frequencyRecurring(selectedBillingFrequency),
                  interval,
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

            await signSelectedAgreement(createdSubscription!.id);

            await recordAudit({
              actorUserId: session.user.id,
              action: "subscription.coupon.activated",
              entityType: "subscription",
              entityId: createdSubscription!.id,
              message: `Coupon subscription activated for ${name}`,
              metadata: {
                coupon: coupon.code,
                percentOff: coupon.percentOff,
                originalAmount,
                amount,
                invoiceId: createdInvoice!.id,
              },
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

            return json(
              {
                invoice: createdInvoice!,
                subscription: createdSubscription!,
                coupon,
                discounted: true,
                alreadyPaid: true,
              },
              201,
            );
          }

          if (isTrialPlan) {
            const trialPeriodEnd = new Date();
            trialPeriodEnd.setDate(trialPeriodEnd.getDate() + trialDays);
            const trialSubscriptionId = pendingSubscription?.id ?? makeId("sub");

            if (pendingSubscription) {
              if (existingInvoice) {
                await db
                  .update(invoice)
                  .set({
                    status: "cancelled",
                    updatedAt: new Date(),
                  })
                  .where(eq(invoice.id, existingInvoice.id));
              }
              const [updatedTrialSubscription] = await db
                .update(subscription)
                .set({
                  planId: planRow?.id ?? body.planId ?? null,
                  bundleId: null,
                  name,
                  status: "trialing",
                  amount: 0,
                  interval,
                  minimumTermMonths: selectedMinimumTermMonths,
                  minimumTermEndsAt: selectedMinimumTermMonths
                    ? addMonths(new Date(), selectedMinimumTermMonths)
                    : null,
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: trialPeriodEnd,
                  requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
                  updatedAt: new Date(),
                })
                .where(eq(subscription.id, pendingSubscription.id))
                .returning();

              await signSelectedAgreement(updatedTrialSubscription.id);

              await recordAudit({
                actorUserId: session.user.id,
                action: "subscription.trial.started",
                entityType: "subscription",
                entityId: updatedTrialSubscription.id,
                message: `Free trial started for ${name}`,
                metadata: { trialDays, planId: planRow?.id ?? body.planId ?? null },
              });

              return json(
                {
                  subscription: updatedTrialSubscription,
                  trialing: true,
                },
                200,
              );
            }

            const [createdTrialSubscription] = await db
              .insert(subscription)
              .values({
                id: trialSubscriptionId,
                userId: session.user.id,
                bundleId: null,
                planId: planRow?.id ?? body.planId ?? null,
                name,
                status: "trialing",
                amount: 0,
                interval,
                minimumTermMonths: selectedMinimumTermMonths,
                minimumTermEndsAt: selectedMinimumTermMonths
                  ? addMonths(new Date(), selectedMinimumTermMonths)
                  : null,
                currentPeriodStart: new Date(),
                currentPeriodEnd: trialPeriodEnd,
                requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
              })
              .returning();

            await signSelectedAgreement(createdTrialSubscription.id);

            await recordAudit({
              actorUserId: session.user.id,
              action: "subscription.trial.started",
              entityType: "subscription",
              entityId: createdTrialSubscription.id,
              message: `Free trial started for ${name}`,
              metadata: { trialDays, planId: planRow?.id ?? body.planId ?? null },
            });

            return json(
              {
                subscription: createdTrialSubscription,
                trialing: true,
              },
              200,
            );
          }

          if (pendingSubscription && existingInvoice?.paystackUrl) {
            await signSelectedAgreement(pendingSubscription.id);
            return json(
              {
                subscription: pendingSubscription,
                invoice: existingInvoice,
                authorization_url: existingInvoice.paystackUrl,
                access_code: null,
                reference: existingInvoice.paystackReference,
                alreadyPending: true,
              },
              200,
            );
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
          const invoiceNumber = `INV-${issuedAt.getFullYear()}-${invoiceId
            .replace(/^inv[_-]?/i, "")
            .replace(/[^a-z0-9]/gi, "")
            .slice(-6)
            .toUpperCase()}`;
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
                minimumTermMonths: selectedMinimumTermMonths,
                minimumTermEndsAt: selectedMinimumTermMonths
                  ? addMonths(issuedAt, selectedMinimumTermMonths)
                  : null,
                currentPeriodStart: new Date(),
                currentPeriodEnd,
                requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
              });
              await tx.insert(invoiceItem).values({
                id: makeId("invitem"),
                invoiceId,
                description: name,
                quantity: 1,
                unitPrice: amount,
                amount,
                recurring: frequencyRecurring(selectedBillingFrequency),
                interval,
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
              recurring: frequencyRecurring(selectedBillingFrequency),
              interval,
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
            await db
              .update(invoice)
              .set({
                status: "cancelled",
                updatedAt: new Date(),
              })
              .where(eq(invoice.id, invoiceId));
            await db
              .update(subscription)
              .set({
                status: "cancelled",
                updatedAt: new Date(),
              })
              .where(eq(subscription.id, subscriptionId));
            throw error;
          }

          const [updatedInvoice] = await db
            .update(invoice)
            .set({
              paystackReference: payment.data.reference,
              paystackUrl: payment.data.authorization_url,
              updatedAt: new Date(),
            })
            .where(eq(invoice.id, invoiceId))
            .returning();

          const [updatedSubscription] = await db
            .update(subscription)
            .set({
              status: "pending",
              planId: planRow?.id ?? body.planId ?? null,
              bundleId: bundleRow?.id ?? body.bundleId ?? null,
              name,
              amount,
              interval,
              minimumTermMonths: selectedMinimumTermMonths,
              minimumTermEndsAt: selectedMinimumTermMonths
                ? addMonths(issuedAt, selectedMinimumTermMonths)
                : null,
              currentPeriodStart: new Date(),
              currentPeriodEnd,
              requiredAgreementTemplateId: agreementRequirement?.template.id ?? null,
              updatedAt: new Date(),
            })
            .where(eq(subscription.id, subscriptionId))
            .returning();

          await signSelectedAgreement(updatedSubscription.id);

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

          return json(
            {
              invoice: updatedInvoice,
              subscription: updatedSubscription,
              authorization_url: payment.data.authorization_url,
              access_code: payment.data.access_code,
              reference: payment.data.reference,
            },
            201,
          );
        } catch (error: any) {
          return json({ error: error.message, issues: error.issues }, error.status ?? 500);
        }
      }

      const rows = await db.query.subscription.findMany({
        where: eq(subscription.userId, session.user.id),
        with: {
          plan: { with: { service: true, features: true } },
          bundle: { with: { features: true } },
        },
        orderBy: (subscription, { desc }) => [desc(subscription.createdAt)],
      });
      return json(rows);
    }

    if (url.pathname.startsWith("/api/user/website-onboarding")) {
      return websiteHandlers.handleUserWebsiteOnboarding(request);
    }

    if (url.pathname === "/api/user/ai-website-builder/generate") {
      return aiWebsiteBuilderHandlers.handleGenerate(request);
    }
    if (url.pathname === "/api/user/ai-website-builder/publish") {
      return aiWebsiteBuilderHandlers.handlePublish(request);
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
            with: {
              plan: { with: { service: true, features: true } },
              bundle: { with: { features: true } },
            },
          });

          if (!activeSubscription || activeSubscription.userId !== session.user.id) {
            return json({ error: "Subscription not found" }, 404);
          }

          if (activeSubscription.status !== "active") {
            return json(
              { error: "Payment must be confirmed before onboarding can be submitted" },
              402,
            );
          }

          const productType = activeSubscription.planId ? "plan" : "bundle";
          const productId =
            activeSubscription.planId ?? activeSubscription.bundleId ?? activeSubscription.id;
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
            ? await db
                .update(onboardingSubmission)
                .set(submissionValues)
                .where(eq(onboardingSubmission.id, existing.id))
                .returning()
            : await db
                .insert(onboardingSubmission)
                .values({
                  id: submissionId,
                  ...submissionValues,
                })
                .returning();

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
          const adminEmail =
            settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;

          try {
            const n8nResponse = await sendN8nWorkflow({
              event: "onboarding.submitted",
              data: workflowPayload,
              idempotencyKey: `onboarding:${savedSubmission.id}:${activeSubscription.id}`,
            });
            const [sentSubmission] = await db
              .update(onboardingSubmission)
              .set({
                status: "sent_to_n8n",
                n8nResponse: JSON.stringify(n8nResponse),
                updatedAt: new Date(),
              })
              .where(eq(onboardingSubmission.id, savedSubmission.id))
              .returning();

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
            const [failedSubmission] = await db
              .update(onboardingSubmission)
              .set({
                status: "n8n_failed",
                n8nResponse: n8nError.message,
                updatedAt: new Date(),
              })
              .where(eq(onboardingSubmission.id, savedSubmission.id))
              .returning();

            await recordAudit({
              actorUserId: session.user.id,
              action: "onboarding.n8n_failed",
              entityType: "onboarding_submission",
              entityId: failedSubmission.id,
              message: `Onboarding saved but n8n failed for ${activeSubscription.name}`,
              level: "error",
              metadata: { subscriptionId: activeSubscription.id, error: n8nError.message },
            });

            return json(
              { submission: failedSubmission, n8nStatus: "failed", error: n8nError.message },
              202,
            );
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
          const [created] = await db
            .insert(aiAgent)
            .values({
              id: makeId("agent"),
              userId: session.user.id,
              ...body,
            })
            .returning();
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
      return supportChatHandlers.handleUserSupportChat(request);
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
          if (!ticket || ticket.userId !== session.user.id)
            return json({ error: "Ticket not found" }, 404);
          const [created] = await db
            .insert(supportTicketComment)
            .values({
              id: makeId("comment"),
              ticketId,
              userId: session.user.id,
              body: body.body,
              isInternal: false,
            })
            .returning();
          await db
            .update(supportTicket)
            .set({ updatedAt: new Date() })
            .where(eq(supportTicket.id, ticketId));
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
        if (!ticket || ticket.userId !== session.user.id)
          return json({ error: "Ticket not found" }, 404);
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

          const body = await parseBody(
            request,
            ticketSchema.omit({ userId: true, assignedToUserId: true }),
          );
          const [created] = await db
            .insert(supportTicket)
            .values({
              id: makeId("ticket"),
              userId: session.user.id,
              ...body,
            })
            .returning();
          await recordAudit({
            actorUserId: session.user.id,
            action: "ticket.created",
            entityType: "support_ticket",
            entityId: created.id,
            message: `Support ticket opened: ${created.subject}`,
          });
          const adminEmail =
            settings?.adminNotificationEmail ?? process.env.ADMIN_NOTIFICATION_EMAIL;
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
      return json(
        rows.map((ticket) => ({
          ...ticket,
          comments: ticket.comments.filter((comment) => !comment.isInternal),
        })),
      );
    }

    if (url.pathname.startsWith("/api/pitch-decks/")) {
      const token = decodeURIComponent(url.pathname.split("/").filter(Boolean)[2] ?? "");
      const row = token === "sti-electrical-phase-2"
        ? await ensureStiElectricalPitchDeck()
        : await db.query.pitchDeck.findFirst({ where: or(eq(pitchDeck.publicToken, token), eq(pitchDeck.slug, token)) });
      if (!row || row.status !== "published") return json({ error: "Pitch deck not found" }, 404);
      let content: unknown = null;
      try { content = JSON.parse(row.content); } catch { return json({ error: "Pitch deck content is invalid" }, 500); }
      return json({
        id: row.id,
        title: row.title,
        status: row.status,
        customerUserId: row.customerUserId,
        publicToken: row.publicToken,
        content,
      });
    }

    if (url.pathname.startsWith("/api/proposals")) {
      const origin = new URL(request.url).origin;
      const parts = url.pathname.split("/").filter(Boolean);
      const token = parts[2];
      const action = parts[3];
      if (!token) return json({ error: "Proposal token is required" }, 400);

      const document = await fetchProposalDocument(decodeURIComponent(token), true);
      if (!document)
        return new Response(
          renderProposalResultHtml({
            title: "Proposal not found",
            message: "This proposal link is invalid or no longer available.",
          }),
          { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
        );

      if (action === "data" && request.method === "GET") {
        return json({
          proposal: document.proposal,
          items: document.items,
          workspaceBilling: getWorkspaceBillingDetails(await getWorkspaceSettings()),
        });
      }

      if (request.method === "GET") {
        const publicUrl = proposalApiUrl(origin, document.proposal.publicToken) ?? undefined;
        const workspaceBilling = getWorkspaceBillingDetails(await getWorkspaceSettings());
        return new Response(renderProposalHtml({ ...document, publicUrl, workspaceBilling }), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (action === "approve" && request.method === "POST") {
        const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
        let approvalName = document.proposal.customerName;
        if (wantsJson) {
          const body = await request.json().catch(() => ({}));
          if (typeof body?.approvalName === "string" && body.approvalName.trim()) {
            approvalName = body.approvalName.trim().slice(0, 160);
          }
        }
        if (document.proposal.status === "void") {
          return new Response(
            renderProposalResultHtml({
              title: "Proposal unavailable",
              message:
                "This proposal has been voided. Please contact CloudMonkey for an updated proposal.",
            }),
            { status: 409, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        if (document.proposal.expiresAt && document.proposal.expiresAt < new Date()) {
          return new Response(
            renderProposalResultHtml({
              title: "Proposal expired",
              message:
                "This proposal has expired. Please contact CloudMonkey for updated pricing and service terms.",
            }),
            { status: 410, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        const approvedAt = new Date();
        await db
          .update(proposal)
          .set({
            status: document.proposal.status === "converted" ? "converted" : "approved",
            approvalName,
            approvedAt: document.proposal.approvedAt ?? approvedAt,
            approvalIp:
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
              request.headers.get("cf-connecting-ip") ??
              null,
            approvalUserAgent: request.headers.get("user-agent"),
            updatedAt: approvedAt,
          })
          .where(eq(proposal.id, document.proposal.id));

        let conversion:
          | Awaited<ReturnType<typeof createProposalInvoice>>
          | { invoice: null; created: false; requiresRegistration: true } = {
          invoice: null,
          created: false,
          requiresRegistration: true,
        };
        let conversionError: Error | null = null;
        try {
          conversion = await createProposalInvoice({ proposalId: document.proposal.id, origin });
        } catch (error) {
          conversionError = error instanceof Error ? error : new Error(String(error));
          console.error("Proposal invoice conversion failed:", error);
        }

        if (conversionError && wantsJson) {
          return json({ error: conversionError.message }, 500);
        }

        await recordAudit({
          actorUserId: document.proposal.customerUserId ?? null,
          action: "proposal.approved",
          entityType: "proposal",
          entityId: document.proposal.id,
          message: `Proposal ${document.proposal.proposalNumber ?? document.proposal.id} approved`,
          metadata: {
            invoiceId: conversion.invoice?.id ?? null,
            requiresRegistration: conversion.requiresRegistration,
          },
        });

        if (conversion.invoice) {
          const invoiceUrl = `${origin}/dashboard/billing/invoices/${encodeURIComponent(conversion.invoice.id)}`;
          if (wantsJson) {
            return json({
              approved: true,
              invoiceId: conversion.invoice.id,
              paystackUrl: conversion.invoice.paystackUrl,
              invoiceUrl,
            });
          }
          return new Response(
            renderProposalResultHtml({
              title: "Proposal approved",
              message:
                "Your proposal has been approved and an invoice has been generated against your CloudMonkey profile.",
              invoiceUrl,
            }),
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        if (wantsJson) {
          return json({
            approved: true,
            requiresRegistration: true,
            registerUrl: `${origin}/auth/sign-up`,
          });
        }

        return new Response(
          renderProposalResultHtml({
            title: "Proposal approved",
            message:
              "Your approval has been recorded. To generate the invoice against your profile, register or sign in using the same email address as this proposal.",
            registerUrl: `${origin}/auth/sign-up`,
          }),
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }

      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname.startsWith("/api/invoices")) {
      return billingHandlers.handleInvoices(request);
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
          case "start":
            await startInstance(instanceId);
            break;
          case "stop":
            await stopInstance(instanceId);
            break;
          case "reboot":
            await rebootInstance(instanceId);
            break;
          case "reinstall":
            await reinstallInstance(instanceId);
            break;
          default:
            return new Response("Invalid action", { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
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
      return domainsHandlers.handleUserDomainOrders(request);
    }

    if (url.pathname.startsWith("/api/user/domains/dns")) {
      return domainsHandlers.handleUserDomainsDns(request);
    }

    if (url.pathname.startsWith("/api/user/domains/info")) {
      return domainsHandlers.handleUserDomainsInfo(request);
    }

    if (url.pathname === "/api/user/domains/renew") {
      return domainsHandlers.handleDomainRenewal(request);
    }
    if (url.pathname === "/api/user/domains/auto-renew") {
      return domainsHandlers.handleDomainAutoRenew(request);
    }

    if (url.pathname.startsWith("/api/user/domains")) {
      return domainsHandlers.handleUserDomains(request);
    }

    if (url.pathname.match(/^\/api\/user\/websites\/[^/]+\/growth(?:\/.*)?$/)) {
      return websiteGrowthHandlers.handleUser(request);
    }

    if (url.pathname.startsWith("/api/user/websites/")) {
      return websiteHandlers.handleUserWebsites(request);
    }

    if (url.pathname === "/api/user/websites") {
      return websiteHandlers.handleUserWebsites(request);
    }

    if (url.pathname.startsWith("/api/admin/website-runtime-servers")) {
      return websiteHandlers.handleAdminWebsiteRuntimeServers(request);
    }

    if (url.pathname.startsWith("/api/admin/website-health")) {
      return adminHandlers.handleAdminWebsiteHealth(request);
    }

    if (url.pathname.startsWith("/api/admin/website-growth")) {
      return websiteGrowthHandlers.handleAdmin(request);
    }

    if (url.pathname.startsWith("/api/admin/website-projects")) {
      return websiteHandlers.handleAdminWebsiteProjects(request);
    }

    if (url.pathname === "/api/admin/server-agents/enrollment") {
      return agentsRuntimeHandlers.handleAdminServerAgentEnrollment(request);
    }

    if (url.pathname.startsWith("/api/admin/websites")) {
      return websiteHandlers.handleAdminWebsites(request);
    }

    if (url.pathname.startsWith("/api/admin/manual-invoices")) {
      return billingHandlers.handleAdminManualInvoices(request);
    }

    if (url.pathname.startsWith("/api/admin/invoices")) {
      return billingHandlers.handleAdminInvoices(request);
    }

    if (url.pathname.startsWith("/api/admin/subscriptions")) {
      return billingHandlers.handleAdminSubscriptions(request);
    }

    if (url.pathname === "/api/admin/domains/dns") {
      return domainsHandlers.handleAdminDomainsDns(request);
    }

    if (url.pathname === "/api/admin/domains/info") {
      return domainsHandlers.handleAdminDomainsInfo(request);
    }

    if (url.pathname === "/api/admin/domains/renew") {
      return domainsHandlers.handleDomainRenewal(request, true);
    }
    if (url.pathname === "/api/admin/domains/auto-renew") {
      return domainsHandlers.handleDomainAutoRenew(request, true);
    }

    if (url.pathname === "/api/admin/assign-domain") {
      return domainsHandlers.handleAdminAssignDomain(request);
    }

    if (url.pathname === "/api/admin/vultr") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      if (request.method === "GET") return json(await listInstances());
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

      try {
        const body = await parseBody(
          request,
          z.object({
            instanceId: z.string().min(1),
            action: z.enum(["start", "stop", "reboot"]),
          }),
        );
        if (body.action === "start") await startInstance(body.instanceId);
        if (body.action === "stop") await stopInstance(body.instanceId);
        if (body.action === "reboot") await rebootInstance(body.instanceId);
        await recordAudit({
          actorUserId: session.user.id,
          action: `copilot.vultr.${body.action}`,
          entityType: "vultr_instance",
          entityId: body.instanceId,
          message: `Admin API requested Vultr ${body.action}`,
          metadata: { source: "cloudmonkey_api" },
        });
        return json({ success: true, instanceId: body.instanceId, action: body.action });
      } catch (error: any) {
        return json({ error: error.message ?? "Vultr action failed" }, error.status ?? 502);
      }
    }

    if (url.pathname.startsWith("/api/admin/")) {
      return adminHandlers.handleAdminRoot(request);
    }

    if (url.pathname === "/api/internal/admin/copilot-tools" && request.method === "POST") {
      const expectedToken =
        process.env.CLOUDMONKEY_API_TOKEN ?? process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET;
      const suppliedToken = request.headers.get("X-CloudMonkey-API-Token");
      if (!expectedToken || suppliedToken !== expectedToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      try {
        const body = await request.json();
        const actorUserId = z.string().min(1).parse(body.actorUserId);
        const results = await executeInternalAdminCopilotTools({
          actorUserId,
          toolCalls: body.toolCalls,
        });
        return json({ results });
      } catch (error: any) {
        return json({ error: error.message, issues: error.issues }, error.status ?? 400);
      }
    }

    if (url.pathname.startsWith("/api/internal/growth-agent/")) {
      return websiteGrowthHandlers.handleWorker(request);
    }

    if (url.pathname === "/api/internal/admin/sql" && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      return internalToolsHandlers.handleSqlConsole(request, session);
    }

    if (url.pathname === "/api/internal/admin/send-reminder" && request.method === "POST") {
      const { session, response } = await requireAdmin(request);
      if (response) return response;
      return internalToolsHandlers.handleSendReminder(request, session);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return addSeoResponseHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
  },
};
