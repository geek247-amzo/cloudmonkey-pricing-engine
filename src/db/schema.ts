import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  unique,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  whatsapp: text("whatsapp"),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  role: text("role").notNull().default("customer"), // 'admin' | 'customer'
  twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export const twoFactor = pgTable("twoFactor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  verified: boolean("verified").notNull().default(true),
});

export const microsoft365Tenant = pgTable("microsoft365_tenant", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull().unique(),
  displayName: text("displayName"),
  defaultDomain: text("defaultDomain"),
  connectedAccountEmail: text("connectedAccountEmail"),
  connectedByUserId: text("connectedByUserId").references(() => user.id),
  scopes: text("scopes").notNull(),
  refreshTokenSecret: text("refreshTokenSecret").notNull(),
  status: text("status").notNull().default("connected"),
  userCount: integer("userCount"),
  secureScoreCurrent: text("secureScoreCurrent"),
  secureScoreMax: text("secureScoreMax"),
  secureScorePercent: integer("secureScorePercent"),
  serviceHealthStatus: text("serviceHealthStatus"),
  serviceIssueCount: integer("serviceIssueCount").notNull().default(0),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const microsoft365TenantScan = pgTable("microsoft365_tenant_scan", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId")
    .notNull()
    .references(() => microsoft365Tenant.tenantId),
  status: text("status").notNull().default("running"),
  summary: text("summary"),
  secureScorePercent: integer("secureScorePercent"),
  serviceHealthStatus: text("serviceHealthStatus"),
  serviceIssueCount: integer("serviceIssueCount").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
});

export const serviceCategory = pgTable("service_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  accent: text("accent").notNull(), // 'cloud' | 'business' | 'ai'
  note: text("note"),
  sortOrder: integer("sortOrder").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const service = pgTable("service", {
  id: text("id").primaryKey(),
  categoryId: text("categoryId")
    .notNull()
    .references(() => serviceCategory.id),
  name: text("name").notNull(),
  description: text("description"),
  note: text("note"),
  sortOrder: integer("sortOrder").notNull().default(0),
  active: boolean("active").notNull().default(true),
  visibility: text("visibility").notNull().default("public"),
});

export const servicePlan = pgTable("service_plan", {
  id: text("id").primaryKey(),
  serviceId: text("serviceId")
    .notNull()
    .references(() => service.id),
  name: text("name").notNull(),
  tagline: text("tagline"),
  priceZar: text("priceZar"), // Store as string to handle nulls/custom
  setupPriceZar: text("setupPriceZar"),
  unit: text("unit"),
  billingFrequency: text("billingFrequency").notNull().default("month"),
  minimumTerm: text("minimumTerm"),
  minimumTermMonths: integer("minimumTermMonths"),
  billingType: text("billingType").notNull().default("recurring"),
  priceLabel: text("priceLabel"),
  isBundle: boolean("isBundle").notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(0),
  serviceNote: text("serviceNote"),
  active: boolean("active").notNull().default(true),
  trialDays: integer("trialDays"),
  highlighted: boolean("highlighted").default(false),
  badge: text("badge"),
  serviceDefinition: text("serviceDefinition"),
  agreementTemplateId: text("agreementTemplateId"),
  includedTokenAllowanceTokens: integer("includedTokenAllowanceTokens").notNull().default(0),
  autoTopUpThresholdTokens: integer("autoTopUpThresholdTokens").notNull().default(0),
  autoTopUpAmountTokens: integer("autoTopUpAmountTokens").notNull().default(0),
  projectEligible: boolean("projectEligible").notNull().default(false),
  projectTemplate: text("projectTemplate"),
});

export const serviceFeature = pgTable("service_feature", {
  id: text("id").primaryKey(),
  planId: text("planId")
    .notNull()
    .references(() => servicePlan.id),
  content: text("content").notNull(),
});

export const bundle = pgTable("bundle", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priceZar: text("priceZar").notNull(),
  setupPriceZar: text("setupPriceZar"),
  unit: text("unit"),
  billingFrequency: text("billingFrequency").notNull().default("month"),
  minimumTerm: text("minimumTerm"),
  minimumTermMonths: integer("minimumTermMonths"),
  billingType: text("billingType").notNull().default("recurring"),
  priceLabel: text("priceLabel"),
  isBundle: boolean("isBundle").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  categoryNote: text("categoryNote"),
  serviceNote: text("serviceNote"),
  active: boolean("active").notNull().default(true),
  highlighted: boolean("highlighted").default(false),
  badge: text("badge"),
  serviceDefinition: text("serviceDefinition"),
  agreementTemplateId: text("agreementTemplateId"),
  includedTokenAllowanceTokens: integer("includedTokenAllowanceTokens").notNull().default(0),
  autoTopUpThresholdTokens: integer("autoTopUpThresholdTokens").notNull().default(0),
  autoTopUpAmountTokens: integer("autoTopUpAmountTokens").notNull().default(0),
});

export const bundleFeature = pgTable("bundle_feature", {
  id: text("id").primaryKey(),
  bundleId: text("bundleId")
    .notNull()
    .references(() => bundle.id),
  content: text("content").notNull(),
});

export const invoice = pgTable("invoice", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  invoiceNumber: text("invoiceNumber"),
  invoiceSource: text("invoiceSource").notNull().default("checkout"),
  amount: integer("amount").notNull(), // Amount in cents
  status: text("status").notNull().default("pending"), // pending, paid, overdue, cancelled
  dueDate: timestamp("dueDate").notNull(),
  issuedAt: timestamp("issuedAt"),
  publishedAt: timestamp("publishedAt"),
  emailedAt: timestamp("emailedAt"),
  paidAt: timestamp("paidAt"),
  billingPeriodStart: timestamp("billingPeriodStart"),
  billingPeriodEnd: timestamp("billingPeriodEnd"),
  currency: text("currency").notNull().default("ZAR"),
  vatRateBps: integer("vatRateBps").notNull().default(0),
  customerName: text("customerName"),
  customerEmail: text("customerEmail"),
  customerCompany: text("customerCompany"),
  customerAddress: text("customerAddress"),
  customerVatNumber: text("customerVatNumber"),
  workspaceBillingSnapshot: text("workspaceBillingSnapshot"),
  notes: text("notes"),
  paymentMethod: text("paymentMethod").notNull().default("gateway"), // gateway, eft, manual
  collectionStatus: text("collectionStatus").notNull().default("current"), // current, reminder, suspended, paid
  collectionDayCount: integer("collectionDayCount").notNull().default(0),
  firstReminderAt: timestamp("firstReminderAt"),
  lastReminderAt: timestamp("lastReminderAt"),
  nextReminderAt: timestamp("nextReminderAt"),
  suspensionDueAt: timestamp("suspensionDueAt"),
  suspendedAt: timestamp("suspendedAt"),
  paystackReference: text("paystackReference").unique(),
  paystackUrl: text("paystackUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const invoicePayment = pgTable(
  "invoice_payment",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoiceId")
      .notNull()
      .references(() => invoice.id),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    amount: integer("amount").notNull(),
    method: text("method").notNull().default("eft"), // eft, cash, manual, gateway
    reference: text("reference"),
    notes: text("notes"),
    idempotencyKey: text("idempotencyKey"),
    capturedByUserId: text("capturedByUserId").references(() => user.id),
    paidAt: timestamp("paidAt").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    invoicePaymentIdempotencyUnique: unique("invoice_payment_invoice_idempotency_key_unique").on(
      table.invoiceId,
      table.idempotencyKey,
    ),
  }),
);

export const tokenWallet = pgTable(
  "token_wallet",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    balanceTokens: integer("balanceTokens").notNull().default(0),
    reservedTokens: integer("reservedTokens").notNull().default(0),
    currencyCode: text("currencyCode"),
    unitLabel: text("unitLabel"),
    status: text("status").notNull().default("active"),
    autoTopUpEnabled: boolean("autoTopUpEnabled").notNull().default(false),
    autoTopUpThresholdTokens: integer("autoTopUpThresholdTokens").notNull().default(0),
    autoTopUpAmountTokens: integer("autoTopUpAmountTokens").notNull().default(0),
    lastLowBalanceAt: timestamp("lastLowBalanceAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tokenWalletUserIdUnique: unique("token_wallet_user_id_unique").on(table.userId),
  }),
);

export const tokenWalletLedger = pgTable("token_wallet_ledger", {
  id: text("id").primaryKey(),
  walletId: text("walletId")
    .notNull()
    .references(() => tokenWallet.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  entryType: text("entryType").notNull(),
  direction: text("direction").notNull(),
  amountTokens: integer("amountTokens").notNull(),
  balanceBeforeTokens: integer("balanceBeforeTokens").notNull(),
  balanceAfterTokens: integer("balanceAfterTokens").notNull(),
  reservedBeforeTokens: integer("reservedBeforeTokens").notNull(),
  reservedAfterTokens: integer("reservedAfterTokens").notNull(),
  featureKey: text("featureKey"),
  sourceType: text("sourceType").notNull(),
  sourceId: text("sourceId"),
  idempotencyKey: text("idempotencyKey").notNull().unique(),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tokenWalletReservation = pgTable(
  "token_wallet_reservation",
  {
    id: text("id").primaryKey(),
    walletId: text("walletId")
      .notNull()
      .references(() => tokenWallet.id),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    featureKey: text("featureKey").notNull(),
    requestIdempotencyKey: text("requestIdempotencyKey").notNull(),
    reservedTokens: integer("reservedTokens").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expiresAt").notNull(),
    sourceType: text("sourceType"),
    sourceId: text("sourceId"),
    metadataJson: text("metadataJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tokenWalletReservationRequestUnique: unique(
      "token_wallet_reservation_wallet_request_unique",
    ).on(table.walletId, table.requestIdempotencyKey),
  }),
);

export const tokenFeatureRate = pgTable("token_feature_rate", {
  featureKey: text("featureKey").primaryKey(),
  displayName: text("displayName").notNull(),
  baseTokenCost: integer("baseTokenCost").notNull().default(0),
  multiplierBps: integer("multiplierBps").notNull().default(10000),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const platformApiCredential = pgTable("platform_api_credential", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  keyEncrypted: text("keyEncrypted").notNull(),
  keyLastFour: text("keyLastFour").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  monthlySpendCap: integer("monthlySpendCap"),
});

export const platformApiUsage = pgTable("platform_api_usage", {
  id: text("id").primaryKey(),
  credentialId: text("credentialId").references(() => platformApiCredential.id, {
    onDelete: "set null",
  }),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  growthAgentRunId: text("growthAgentRunId").references(() => websiteGrowthRun.id, {
    onDelete: "set null",
  }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  featureKey: text("featureKey").notNull(),
  inputTokens: integer("inputTokens").notNull().default(0),
  outputTokens: integer("outputTokens").notNull().default(0),
  providerCostMicrousd: integer("providerCostMicrousd").notNull().default(0),
  chargedCostMicrousd: integer("chargedCostMicrousd").notNull().default(0),
  chargedTokens: integer("chargedTokens").notNull().default(0),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tokenTopupIntent = pgTable("token_topup_intent", {
  id: text("id").primaryKey(),
  walletId: text("walletId")
    .notNull()
    .references(() => tokenWallet.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  amountTokens: integer("amountTokens").notNull(),
  status: text("status").notNull().default("pending"),
  paystackReference: text("paystackReference").notNull().unique(),
  paystackUrl: text("paystackUrl"),
  paymentMethod: text("paymentMethod").notNull().default("gateway"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  paidAt: timestamp("paidAt"),
  failedAt: timestamp("failedAt"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const invoiceItem = pgTable("invoice_item", {
  id: text("id").primaryKey(),
  invoiceId: text("invoiceId")
    .notNull()
    .references(() => invoice.id),
  planId: text("planId").references(() => servicePlan.id),
  bundleId: text("bundleId").references(() => bundle.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unitPrice").notNull(), // Amount in cents
  amount: integer("amount").notNull(), // Amount in cents (quantity * unitPrice)
  recurring: boolean("recurring").notNull().default(false),
  interval: text("interval").notNull().default("month"),
  websitePackageType: text("websitePackageType"),
});

export const vultrInstance = pgTable("vultr_instance", {
  id: text("id").primaryKey(), // The Vultr instance UUID
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  os: text("os").notNull(),
  ram: integer("ram").notNull(),
  disk: integer("disk").notNull(),
  mainIp: text("mainIp"),
  region: text("region").notNull(),
  status: text("status").notNull(), // active, pending, etc
  powerStatus: text("powerStatus").notNull(), // running, stopped
  hostingMode: text("hostingMode").notNull().default("private"), // shared, private, managed
  label: text("label"),
  suspendedAt: timestamp("suspendedAt"),
  suspensionReason: text("suspensionReason"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverAgent = pgTable("server_agent", {
  id: text("id").primaryKey(),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  name: text("name"),
  version: text("version"),
  hostname: text("hostname"),
  status: text("status").notNull().default("pending"),
  enrollmentTokenHash: text("enrollmentTokenHash"),
  secretHash: text("secretHash"),
  enrolledAt: timestamp("enrolledAt"),
  lastSeenAt: timestamp("lastSeenAt"),
  lastIp: text("lastIp"),
  config: text("config"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverTelemetrySnapshot = pgTable("server_telemetry_snapshot", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull().default("online"),
  hostname: text("hostname"),
  osName: text("osName"),
  kernel: text("kernel"),
  uptimeSeconds: integer("uptimeSeconds"),
  cpuUsagePercent: integer("cpuUsagePercent"),
  memoryUsedMb: integer("memoryUsedMb"),
  memoryTotalMb: integer("memoryTotalMb"),
  diskUsedGb: integer("diskUsedGb"),
  diskTotalGb: integer("diskTotalGb"),
  securityScore: integer("securityScore"),
  securitySummary: text("securitySummary"),
  raw: text("raw").notNull(),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const serverSecurityFinding = pgTable("server_security_finding", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  code: text("code").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull().default("info"),
  status: text("status").notNull().default("open"),
  detail: text("detail"),
  evidence: text("evidence"),
  observedAt: timestamp("observedAt").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverWebsite = pgTable("server_website", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("unknown"),
  httpStatus: integer("httpStatus"),
  redirectUrl: text("redirectUrl"),
  sslStatus: text("sslStatus"),
  sslIssuer: text("sslIssuer"),
  sslExpiresAt: timestamp("sslExpiresAt"),
  sslHostnameMatches: boolean("sslHostnameMatches"),
  appType: text("appType"),
  source: text("source"),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverContainer = pgTable("server_container", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  containerId: text("containerId").notNull(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  status: text("status").notNull(),
  health: text("health"),
  ports: text("ports"),
  labels: text("labels"),
  isPrivileged: boolean("isPrivileged").notNull().default(false),
  restartCount: integer("restartCount").notNull().default(0),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverDatabase = pgTable("server_database", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  engine: text("engine").notNull(),
  version: text("version"),
  source: text("source").notNull().default("container"),
  containerName: text("containerName"),
  port: integer("port"),
  status: text("status").notNull().default("unknown"),
  isPublic: boolean("isPublic").notNull().default(false),
  hasPersistentVolume: boolean("hasPersistentVolume").notNull().default(false),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const detectedAiRuntime = pgTable("detected_ai_runtime", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => serverAgent.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  runtime: text("runtime").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  version: text("version"),
  status: text("status").notNull().default("unknown"),
  health: text("health"),
  ports: text("ports"),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverN8nIntegration = pgTable("server_n8n_integration", {
  id: text("id").primaryKey(),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  baseUrl: text("baseUrl").notNull(),
  apiKeySecret: text("apiKeySecret").notNull(),
  status: text("status").notNull().default("configured"),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const serverN8nWorkflow = pgTable("server_n8n_workflow", {
  id: text("id").primaryKey(),
  integrationId: text("integrationId")
    .notNull()
    .references(() => serverN8nIntegration.id),
  instanceId: text("instanceId")
    .notNull()
    .references(() => vultrInstance.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  workflowId: text("workflowId").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(false),
  triggerSummary: text("triggerSummary"),
  workflowUpdatedAt: timestamp("workflowUpdatedAt"),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const registeredDomain = pgTable("registered_domain", {
  id: text("id").primaryKey(), // The domain name (e.g. cloudmonkey.co.za)
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull(), // active, expired, pending
  expiryDate: timestamp("expiryDate"),
  autoRenew: boolean("autoRenew").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const domainOrder = pgTable("domain_order", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  domainName: text("domainName").notNull(),
  domainPlanId: text("domainPlanId").references(() => servicePlan.id),
  addonPlanIds: text("addonPlanIds"),
  invoiceId: text("invoiceId").references(() => invoice.id),
  subscriptionId: text("subscriptionId").references(() => subscription.id),
  status: text("status").notNull().default("pending_payment"),
  providerResponse: text("providerResponse"),
  providerError: text("providerError"),
  registeredAt: timestamp("registeredAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const lead = pgTable("lead", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  country: text("country"),
  businessNeed: text("businessNeed"),
  budgetRange: text("budgetRange"),
  timeline: text("timeline"),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("new"),
  qualification: text("qualification"),
  services: text("services"), // JSON string or comma separated
  setupStyle: text("setupStyle"),
  captureSource: text("captureSource"),
  consentAt: timestamp("consentAt"),
  scanFingerprint: text("scanFingerprint"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const secureHandoutLink = pgTable("secure_handout_link", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  tokenHash: text("tokenHash").notNull().unique(),
  payloadSecret: text("payloadSecret").notNull(),
  direction: text("direction").notNull().default("view"),
  ticketId: text("ticketId").references(() => supportTicket.id),
  recipientEmail: text("recipientEmail"),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  revokedAt: timestamp("revokedAt"),
  submittedAt: timestamp("submittedAt"),
  submissionStoragePath: text("submissionStoragePath"),
  submissionFileName: text("submissionFileName"),
  submissionMimeType: text("submissionMimeType"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const caesarChatSession = pgTable("caesar_chat_session", {
  id: text("id").primaryKey(),
  visitorTokenHash: text("visitorTokenHash").notNull(),
  userId: text("userId").references(() => user.id),
  leadId: text("leadId").references(() => lead.id),
  status: text("status").notNull().default("open"),
  intent: text("intent"),
  stage: text("stage").notNull().default("discover"),
  qualification: text("qualification"),
  summary: text("summary"),
  messageCount: integer("messageCount").notNull().default(0),
  lastIpHash: text("lastIpHash"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const caesarChatMessage = pgTable("caesar_chat_message", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId")
    .notNull()
    .references(() => caesarChatSession.id),
  role: text("role").notNull(),
  body: text("body").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const proposal = pgTable("proposal", {
  id: text("id").primaryKey(),
  leadId: text("leadId").references(() => lead.id),
  customerUserId: text("customerUserId").references(() => user.id),
  invoiceId: text("invoiceId").references(() => invoice.id),
  proposalNumber: text("proposalNumber"),
  publicToken: text("publicToken").unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  customerName: text("customerName").notNull(),
  approvalName: text("approvalName"),
  customerEmail: text("customerEmail").notNull(),
  customerCompany: text("customerCompany"),
  introduction: text("introduction"),
  executiveSummary: text("executiveSummary"),
  terms: text("terms"),
  currency: text("currency").notNull().default("ZAR"),
  subtotal: integer("subtotal").notNull().default(0),
  setupTotal: integer("setupTotal").notNull().default(0),
  recurringTotal: integer("recurringTotal").notNull().default(0),
  total: integer("total").notNull().default(0),
  expiresAt: timestamp("expiresAt"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  viewedAt: timestamp("viewedAt"),
  approvedAt: timestamp("approvedAt"),
  convertedAt: timestamp("convertedAt"),
  approvalIp: text("approvalIp"),
  approvalUserAgent: text("approvalUserAgent"),
  createdByUserId: text("createdByUserId").references(() => user.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const proposalItem = pgTable("proposal_item", {
  id: text("id").primaryKey(),
  proposalId: text("proposalId")
    .notNull()
    .references(() => proposal.id),
  productType: text("productType").notNull().default("plan"),
  productId: text("productId"),
  planId: text("planId").references(() => servicePlan.id),
  bundleId: text("bundleId").references(() => bundle.id),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unitPrice").notNull().default(0),
  setupPrice: integer("setupPrice").notNull().default(0),
  recurring: boolean("recurring").notNull().default(true),
  interval: text("interval").notNull().default("month"),
  sortOrder: integer("sortOrder").notNull().default(0),
  serviceDefinition: text("serviceDefinition"),
  features: text("features"),
  lineTotal: integer("lineTotal").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const pitchDeck = pgTable("pitch_deck", {
  id: text("id").primaryKey(),
  customerUserId: text("customerUserId").references(() => user.id),
  leadId: text("leadId").references(() => lead.id),
  createdByUserId: text("createdByUserId").references(() => user.id),
  slug: text("slug").notNull().unique(),
  publicToken: text("publicToken").notNull().unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  content: text("content").notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const pitchDeckAudio = pgTable(
  "pitch_deck_audio",
  {
    id: text("id").primaryKey(),
    pitchDeckId: text("pitchDeckId")
      .notNull()
      .references(() => pitchDeck.id, { onDelete: "cascade" }),
    slideId: text("slideId").notNull(),
    audioData: text("audioData").notNull(),
    mimeType: text("mimeType").notNull().default("audio/wav"),
    provider: text("provider").notNull().default("gemini"),
    model: text("model").notNull(),
    voice: text("voice").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    deckSlideUnique: unique("pitch_deck_audio_deck_slide_unique").on(
      table.pitchDeckId,
      table.slideId,
    ),
  }),
);

export const website = pgTable("website", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  subscriptionId: text("subscriptionId").references(() => subscription.id),
  invoiceId: text("invoiceId").references(() => invoice.id),
  domain: text("domain").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("online"), // online, offline, maintenance, onboarding, live_trial, active, suspended, terminated
  siteType: text("siteType").notNull().default("website"),
  name: text("name"),
  businessName: text("businessName"),
  businessDescription: text("businessDescription"),
  industry: text("industry"),
  temporaryDomain: text("temporaryDomain"),
  primaryDomain: text("primaryDomain"),
  onboardingAnswers: text("onboardingAnswers"),
  requirementManifest: text("requirementManifest"),
  buildManifest: text("buildManifest"),
  provisioningPlan: text("provisioningPlan"),
  aiGenerationStatus: text("aiGenerationStatus").notNull().default("not_started"),
  containerStatus: text("containerStatus").notNull().default("not_provisioned"),
  runtimeServerId: text("runtimeServerId"),
  baseRepo: text("baseRepo"),
  selectedDesignOptionId: text("selectedDesignOptionId"),
  githubRepo: text("githubRepo"),
  trialStartedAt: timestamp("trialStartedAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  graceEndsAt: timestamp("graceEndsAt"),
  suspendedAt: timestamp("suspendedAt"),
  suspensionReason: text("suspensionReason"),
  terminationScheduledAt: timestamp("terminationScheduledAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websiteGrowthAgent = pgTable(
  "website_growth_agent",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    schedule: text("schedule").notNull().default("daily"),
    nextRunAt: timestamp("nextRunAt").notNull().defaultNow(),
    kpi: text("kpi").notNull().default("qualified_leads"),
    dailyBudgetTokens: integer("dailyBudgetTokens").notNull().default(50000),
    maxChangesPerRun: integer("maxChangesPerRun").notNull().default(10),
    lastRunAt: timestamp("lastRunAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({ websiteUnique: unique("website_growth_agent_website_unique").on(table.websiteId) }),
);

export const websiteGrowthRun = pgTable("website_growth_run", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => websiteGrowthAgent.id, { onDelete: "cascade" }),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  scheduledAt: timestamp("scheduledAt").notNull().defaultNow(),
  claimedAt: timestamp("claimedAt"),
  heartbeatAt: timestamp("heartbeatAt"),
  completedAt: timestamp("completedAt"),
  error: text("error"),
  proposalId: text("proposalId"),
  provider: text("provider"),
  model: text("model"),
  inputTokens: integer("inputTokens").notNull().default(0),
  outputTokens: integer("outputTokens").notNull().default(0),
  totalTokens: integer("totalTokens").notNull().default(0),
  providerCostMicrousd: integer("providerCostMicrousd").notNull().default(0),
  usageAvailable: boolean("usageAvailable").notNull().default(false),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const websiteGrowthMessage = pgTable("website_growth_message", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => websiteGrowthAgent.id, { onDelete: "cascade" }),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id, { onDelete: "cascade" }),
  runId: text("runId").references(() => websiteGrowthRun.id, { onDelete: "set null" }),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  senderRole: text("senderRole").notNull(),
  body: text("body").notNull(),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const websiteGrowthProposal = pgTable("website_growth_proposal", {
  id: text("id").primaryKey(),
  agentId: text("agentId")
    .notNull()
    .references(() => websiteGrowthAgent.id, { onDelete: "cascade" }),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id, { onDelete: "cascade" }),
  runId: text("runId")
    .notNull()
    .references(() => websiteGrowthRun.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  diffJson: text("diffJson").notNull(),
  modelClaimedDiffJson: text("modelClaimedDiffJson"),
  verifiedDiffHash: text("verifiedDiffHash"),
  status: text("status").notNull().default("pending"),
  decidedByUserId: text("decidedByUserId").references(() => user.id, { onDelete: "set null" }),
  decisionNote: text("decisionNote"),
  decidedAt: timestamp("decidedAt"),
  approvedDiffHash: text("approvedDiffHash"),
  deploymentStatus: text("deploymentStatus").notNull().default("not_started"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websiteHealthCheck = pgTable("website_health_check", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checkedAt").notNull().defaultNow(),
  httpStatus: integer("httpStatus"),
  sslDaysRemaining: integer("sslDaysRemaining"),
  responseTimeMs: integer("responseTimeMs"),
  contentCheckPassed: boolean("contentCheckPassed").notNull().default(false),
  issues: jsonb("issues")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("down"),
});

export const remediationAttempt = pgTable("remediation_attempt", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id, { onDelete: "cascade" }),
  healthCheckId: text("healthCheckId")
    .notNull()
    .references(() => websiteHealthCheck.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  requestedAt: timestamp("requestedAt").notNull().defaultNow(),
  result: text("result").notNull(),
  resultDetail: text("resultDetail"),
});

export const websiteRuntimeServer = pgTable("website_runtime_server", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("vultr"),
  providerInstanceId: text("providerInstanceId"),
  profileName: text("profileName").notNull().default("geek247-compatible-docker-host"),
  hostname: text("hostname"),
  publicIp: text("publicIp"),
  privateIp: text("privateIp"),
  provisionerUrl: text("provisionerUrl"),
  provisionerSecret: text("provisionerSecret"),
  ingressHostname: text("ingressHostname"),
  ingressIp: text("ingressIp"),
  dockerNetworkName: text("dockerNetworkName").notNull().default("cm_runtime"),
  proxyMode: text("proxyMode").notNull().default("caddy"),
  lastError: text("lastError"),
  region: text("region"),
  status: text("status").notNull().default("planned"),
  cpuTotal: integer("cpuTotal").notNull().default(0),
  memoryTotalMb: integer("memoryTotalMb").notNull().default(0),
  diskTotalGb: integer("diskTotalGb").notNull().default(0),
  activeSiteCount: integer("activeSiteCount").notNull().default(0),
  maxSiteCount: integer("maxSiteCount").notNull().default(0),
  lastHealthCheckAt: timestamp("lastHealthCheckAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websiteStore = pgTable("website_store", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  siteType: text("siteType").notNull().default("website"),
  currency: text("currency").notNull().default("ZAR"),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  status: text("status").notNull().default("trial"),
  paymentMode: text("paymentMode").notNull().default("cloudmonkey_gateway"),
  trialStartedAt: timestamp("trialStartedAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  suspendedAt: timestamp("suspendedAt"),
  terminationScheduledAt: timestamp("terminationScheduledAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websiteStoreDatabase = pgTable("website_store_database", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  engine: text("engine").notNull().default("postgresql"),
  version: text("version").notNull().default("16-alpine"),
  host: text("host"),
  port: integer("port").notNull().default(5432),
  databaseName: text("databaseName").notNull(),
  username: text("username").notNull(),
  passwordSecret: text("passwordSecret").notNull(),
  connectionSecret: text("connectionSecret").notNull(),
  containerName: text("containerName").notNull(),
  volumeName: text("volumeName").notNull(),
  status: text("status").notNull().default("planned"),
  backupStatus: text("backupStatus").notNull().default("not_configured"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websiteDomain = pgTable(
  "website_domain",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    domain: text("domain").notNull(),
    type: text("type").notNull().default("temporary"),
    status: text("status").notNull().default("reserved"),
    dnsTarget: text("dnsTarget"),
    sslStatus: text("sslStatus").notNull().default("pending"),
    isPrimary: boolean("isPrimary").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    verifiedAt: timestamp("verifiedAt"),
  },
  (table) => {
    return {
      websiteDomainWebsiteIdDomainUnique: unique("website_domain_websiteId_domain_unique").on(
        table.websiteId,
        table.domain,
      ),
    };
  },
);

export const websiteDesignOption = pgTable("website_design_option", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  styleLabel: text("styleLabel").notNull(),
  imageUrl: text("imageUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  designManifest: text("designManifest"),
  promptVersion: text("promptVersion"),
  tokenCost: integer("tokenCost").notNull().default(0),
  imageCost: integer("imageCost").notNull().default(0),
  selectedAt: timestamp("selectedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const websiteApprovalToken = pgTable("website_approval_token", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  tokenHash: text("tokenHash").notNull().unique(),
  actionType: text("actionType").notNull(), // design_approval, staging_review
  targetId: text("targetId"),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const websiteReviewRequest = pgTable("website_review_request", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  type: text("type").notNull(), // design, staging
  status: text("status").notNull().default("sent"), // sent, approved, changes_requested
  targetId: text("targetId"),
  message: text("message"),
  response: text("response"),
  sentAt: timestamp("sentAt").notNull().defaultNow(),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const websitePluginInstall = pgTable("website_plugin_install", {
  id: text("id").primaryKey(),
  websiteId: text("websiteId")
    .notNull()
    .references(() => website.id),
  storeId: text("storeId").references(() => websiteStore.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  pluginKey: text("pluginKey").notNull(),
  status: text("status").notNull().default("installed"),
  config: text("config"),
  installedAt: timestamp("installedAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const storeProduct = pgTable("store_product", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  sku: text("sku"),
  status: text("status").notNull().default("draft"),
  price: integer("price").notNull().default(0),
  compareAtPrice: integer("compareAtPrice"),
  costPrice: integer("costPrice"),
  taxable: boolean("taxable").notNull().default(true),
  trackInventory: boolean("trackInventory").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const storeProductVariant = pgTable("store_product_variant", {
  id: text("id").primaryKey(),
  productId: text("productId")
    .notNull()
    .references(() => storeProduct.id),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  sku: text("sku"),
  title: text("title").notNull(),
  options: text("options"),
  price: integer("price").notNull().default(0),
  inventoryQuantity: integer("inventoryQuantity").notNull().default(0),
  barcode: text("barcode"),
  weight: text("weight"),
  status: text("status").notNull().default("active"),
});

export const storeInventoryMovement = pgTable("store_inventory_movement", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  productVariantId: text("productVariantId").references(() => storeProductVariant.id),
  type: text("type").notNull(),
  quantityDelta: integer("quantityDelta").notNull(),
  reason: text("reason"),
  referenceType: text("referenceType"),
  referenceId: text("referenceId"),
  createdBy: text("createdBy").references(() => user.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const storeCustomer = pgTable("store_customer", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  marketingOptIn: boolean("marketingOptIn").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const storeOrder = pgTable("store_order", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  customerId: text("customerId").references(() => storeCustomer.id),
  orderNumber: text("orderNumber").notNull(),
  status: text("status").notNull().default("draft"),
  paymentStatus: text("paymentStatus").notNull().default("pending"),
  fulfillmentStatus: text("fulfillmentStatus").notNull().default("unfulfilled"),
  subtotal: integer("subtotal").notNull().default(0),
  deliveryFee: integer("deliveryFee").notNull().default(0),
  discountTotal: integer("discountTotal").notNull().default(0),
  taxTotal: integer("taxTotal").notNull().default(0),
  total: integer("total").notNull().default(0),
  currency: text("currency").notNull().default("ZAR"),
  source: text("source").notNull().default("online"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const storeOrderItem = pgTable("store_order_item", {
  id: text("id").primaryKey(),
  orderId: text("orderId")
    .notNull()
    .references(() => storeOrder.id),
  productId: text("productId").references(() => storeProduct.id),
  variantId: text("variantId").references(() => storeProductVariant.id),
  title: text("title").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unitPrice").notNull().default(0),
  total: integer("total").notNull().default(0),
});

export const storePayment = pgTable("store_payment", {
  id: text("id").primaryKey(),
  storeId: text("storeId")
    .notNull()
    .references(() => websiteStore.id),
  orderId: text("orderId").references(() => storeOrder.id),
  provider: text("provider").notNull().default("cloudmonkey-paystack"),
  providerReference: text("providerReference"),
  amount: integer("amount").notNull().default(0),
  feeCloudmonkey: integer("feeCloudmonkey").notNull().default(0),
  feeProvider: integer("feeProvider").notNull().default(0),
  status: text("status").notNull().default("pending"),
  rawProviderStatus: text("rawProviderStatus"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  planId: text("planId").references(() => servicePlan.id),
  bundleId: text("bundleId").references(() => bundle.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  amount: integer("amount").notNull().default(0),
  interval: text("interval").notNull().default("month"),
  minimumTermMonths: integer("minimumTermMonths"),
  minimumTermEndsAt: timestamp("minimumTermEndsAt"),
  currentPeriodStart: timestamp("currentPeriodStart").notNull().defaultNow(),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  agreementSigned: boolean("agreementSigned").notNull().default(false),
  agreementSignedAt: timestamp("agreementSignedAt"),
  requiredAgreementTemplateId: text("requiredAgreementTemplateId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  subscriptionId: text("subscriptionId").references(() => subscription.id),
  planId: text("planId").references(() => servicePlan.id),
  name: text("name").notNull(),
  serviceName: text("serviceName").notNull(),
  template: text("template").notNull().default("service-implementation"),
  engagementCode: text("engagementCode"),
  billingCostCentre: text("billingCostCentre"),
  contractingEntity: text("contractingEntity"),
  dataBoundary: text("dataBoundary"),
  description: text("description"),
  status: text("status").notNull().default("planned"),
  priority: text("priority").notNull().default("medium"),
  startDate: timestamp("startDate"),
  targetDate: timestamp("targetDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const projectMember = pgTable(
  "project_member",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    projectUserUnique: unique("project_member_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
  }),
);

export const projectMilestone = pgTable("project_milestone", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"),
  dueDate: timestamp("dueDate"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const projectTask = pgTable("project_task", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  milestoneId: text("milestoneId").references(() => projectMilestone.id, { onDelete: "set null" }),
  assignedToUserId: text("assignedToUserId").references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  sortOrder: integer("sortOrder").notNull().default(0),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const projectDeliverable = pgTable("project_deliverable", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  milestoneId: text("milestoneId").references(() => projectMilestone.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planned"),
  url: text("url"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const projectComment = pgTable("project_comment", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  taskId: text("taskId").references(() => projectTask.id, { onDelete: "cascade" }),
  authorUserId: text("authorUserId")
    .notNull()
    .references(() => user.id),
  body: text("body").notNull(),
  isInternal: boolean("isInternal").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const projectActivity = pgTable("project_activity", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  actorUserId: text("actorUserId").references(() => user.id),
  action: text("action").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const board = pgTable("board", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"),
  visibility: text("visibility").notNull().default("internal"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const boardColumn = pgTable(
  "board_column",
  {
    id: text("id").primaryKey(),
    boardId: text("boardId")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    position: numeric("position", { precision: 20, scale: 10 }).notNull(),
    wipLimit: integer("wipLimit"),
    isTerminal: boolean("isTerminal").notNull().default(false),
    automationKey: text("automationKey"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    boardColumnKeyUnique: unique("board_column_board_key_unique").on(table.boardId, table.key),
  }),
);

export const task = pgTable("task", {
  id: text("id").primaryKey(),
  boardId: text("boardId")
    .notNull()
    .references(() => board.id, { onDelete: "cascade" }),
  columnId: text("columnId")
    .notNull()
    .references(() => boardColumn.id),
  position: numeric("position", { precision: 20, scale: 10 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  visibility: text("visibility").notNull().default("internal"),
  assigneeUserId: text("assigneeUserId").references(() => user.id),
  customerUserId: text("customerUserId").references(() => user.id),
  dueDate: timestamp("dueDate"),
  billable: boolean("billable").notNull().default(false),
  estimateMinutes: integer("estimateMinutes"),
  loggedMinutes: integer("loggedMinutes").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdByUserId: text("createdByUserId")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  completedAt: timestamp("completedAt"),
});

export const taskLink = pgTable(
  "task_link",
  {
    id: text("id").primaryKey(),
    taskId: text("taskId")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
  },
  (table) => ({
    taskEntityUnique: unique("task_link_entity_unique").on(
      table.taskId,
      table.entityType,
      table.entityId,
    ),
  }),
);

export const taskLabel = pgTable(
  "task_label",
  {
    id: text("id").primaryKey(),
    boardId: text("boardId")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colour: text("colour").notNull(),
  },
  (table) => ({
    boardLabelNameUnique: unique("task_label_board_name_unique").on(table.boardId, table.name),
  }),
);

export const taskLabelMap = pgTable(
  "task_label_map",
  {
    taskId: text("taskId")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    labelId: text("labelId")
      .notNull()
      .references(() => taskLabel.id, { onDelete: "cascade" }),
  },
  (table) => ({ taskLabelUnique: unique("task_label_map_unique").on(table.taskId, table.labelId) }),
);

export const taskActivity = pgTable("task_activity", {
  id: text("id").primaryKey(),
  taskId: text("taskId")
    .notNull()
    .references(() => task.id, { onDelete: "cascade" }),
  actorUserId: text("actorUserId").references(() => user.id),
  actorType: text("actorType").notNull().default("user"),
  action: text("action").notNull(),
  fromValue: text("fromValue"),
  toValue: text("toValue"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const userNotification = pgTable("user_notification", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: text("projectId").references(() => project.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const agreementTemplate = pgTable("agreement_template", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  documentType: text("documentType").notNull().default("sla"),
  version: text("version").notNull(),
  status: text("status").notNull().default("active"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  contentHash: text("contentHash").notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const agreementTemplateSku = pgTable("agreement_template_sku", {
  id: text("id").primaryKey(),
  templateId: text("templateId")
    .notNull()
    .references(() => agreementTemplate.id),
  productType: text("productType").notNull(), // plan | bundle
  productId: text("productId").notNull(),
  required: boolean("required").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const signedAgreement = pgTable("signed_agreement", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  subscriptionId: text("subscriptionId").references(() => subscription.id),
  templateId: text("templateId")
    .notNull()
    .references(() => agreementTemplate.id),
  templateVersion: text("templateVersion").notNull(),
  productType: text("productType").notNull(),
  productId: text("productId").notNull(),
  documentHash: text("documentHash").notNull(),
  consentText: text("consentText").notNull(),
  documentSnapshot: text("documentSnapshot").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  signedAt: timestamp("signedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const affiliate = pgTable("affiliate", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id),
  fullName: text("fullName").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  companyName: text("companyName"),
  website: text("website"),
  socialLinks: text("socialLinks"),
  affiliateType: text("affiliateType").notNull().default("individual"),
  expectedReferralMethod: text("expectedReferralMethod"),
  tier: text("tier").notNull().default("starter"),
  status: text("status").notNull().default("pending"),
  referralCode: text("referralCode").notNull().unique(),
  commissionType: text("commissionType").notNull().default("once_off"),
  commissionRateBps: integer("commissionRateBps").notNull().default(1000),
  recurringDurationMonths: integer("recurringDurationMonths").notNull().default(1),
  payoutMethod: text("payoutMethod").notNull().default("manual_eft"),
  payoutDetails: text("payoutDetails"),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  approvedAt: timestamp("approvedAt"),
  rejectedAt: timestamp("rejectedAt"),
  suspendedAt: timestamp("suspendedAt"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  notes: text("notes"),
});

export const affiliateReferral = pgTable("affiliate_referral", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliateId")
    .notNull()
    .references(() => affiliate.id),
  referralCode: text("referralCode").notNull(),
  visitorId: text("visitorId"),
  leadId: text("leadId").references(() => lead.id),
  customerId: text("customerId").references(() => user.id),
  sourceUrl: text("sourceUrl"),
  landingPage: text("landingPage"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  attributionType: text("attributionType").notNull().default("link"),
  attributionModel: text("attributionModel").notNull().default("last_click"),
  status: text("status").notNull().default("clicked"),
  tierAtSignup: text("tierAtSignup"),
  commissionTypeAtSignup: text("commissionTypeAtSignup"),
  commissionRateBpsAtSignup: integer("commissionRateBpsAtSignup"),
  recurringDurationMonthsAtSignup: integer("recurringDurationMonthsAtSignup"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  clickedAt: timestamp("clickedAt").notNull().defaultNow(),
  signedUpAt: timestamp("signedUpAt"),
  convertedAt: timestamp("convertedAt"),
});

export const affiliateCommission = pgTable("affiliate_commission", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliateId")
    .notNull()
    .references(() => affiliate.id),
  referralId: text("referralId").references(() => affiliateReferral.id),
  customerId: text("customerId")
    .notNull()
    .references(() => user.id),
  paymentId: text("paymentId"),
  invoiceId: text("invoiceId").references(() => invoice.id),
  subscriptionId: text("subscriptionId").references(() => subscription.id),
  commissionType: text("commissionType").notNull(),
  commissionRateBps: integer("commissionRateBps").notNull(),
  commissionAmount: integer("commissionAmount").notNull(),
  commissionMonthNumber: integer("commissionMonthNumber").notNull().default(1),
  status: text("status").notNull().default("pending"),
  holdUntilDate: timestamp("holdUntilDate").notNull(),
  approvedAt: timestamp("approvedAt"),
  payableAt: timestamp("payableAt"),
  paidAt: timestamp("paidAt"),
  cancelledAt: timestamp("cancelledAt"),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const affiliatePayout = pgTable("affiliate_payout", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliateId")
    .notNull()
    .references(() => affiliate.id),
  payoutPeriodStart: timestamp("payoutPeriodStart").notNull(),
  payoutPeriodEnd: timestamp("payoutPeriodEnd").notNull(),
  totalAmount: integer("totalAmount").notNull(),
  payoutMethod: text("payoutMethod").notNull().default("manual_eft"),
  payoutReference: text("payoutReference"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paidAt"),
  adminId: text("adminId").references(() => user.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const affiliateFraudFlag = pgTable("affiliate_fraud_flag", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliateId").references(() => affiliate.id),
  referralId: text("referralId").references(() => affiliateReferral.id),
  customerId: text("customerId").references(() => user.id),
  flagType: text("flagType").notNull(),
  severity: text("severity").notNull().default("review"),
  status: text("status").notNull().default("open"),
  detail: text("detail").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});

export const onboardingSubmission = pgTable("onboarding_submission", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  subscriptionId: text("subscriptionId")
    .notNull()
    .references(() => subscription.id),
  productType: text("productType").notNull(), // plan | bundle
  productId: text("productId").notNull(),
  status: text("status").notNull().default("draft"), // draft, submitted, sent_to_n8n, n8n_failed
  answers: text("answers").notNull(),
  n8nResponse: text("n8nResponse"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const aiAgent = pgTable("ai_agent", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull().default("openrouter"),
  model: text("model"),
  status: text("status").notNull().default("draft"),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const supportTicket = pgTable("support_ticket", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  subject: text("subject").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  category: text("category").notNull().default("general"),
  assignedToUserId: text("assignedToUserId").references(() => user.id),
  source: text("source").notNull().default("manual"),
  aiSessionId: text("aiSessionId"),
  lastCustomerMessageAt: timestamp("lastCustomerMessageAt"),
  slaDueAt: timestamp("slaDueAt"),
  resolutionSummary: text("resolutionSummary"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const supportTicketComment = pgTable("support_ticket_comment", {
  id: text("id").primaryKey(),
  ticketId: text("ticketId")
    .notNull()
    .references(() => supportTicket.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  body: text("body").notNull(),
  isInternal: boolean("isInternal").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const supportChatSession = pgTable("support_chat_session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  ticketId: text("ticketId").references(() => supportTicket.id),
  status: text("status").notNull().default("open"),
  summary: text("summary"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const supportChatMessage = pgTable("support_chat_message", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId")
    .notNull()
    .references(() => supportChatSession.id),
  userId: text("userId").references(() => user.id),
  role: text("role").notNull(),
  body: text("body").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const supportChatAttachment = pgTable("support_chat_attachment", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId")
    .notNull()
    .references(() => supportChatSession.id),
  messageId: text("messageId").references(() => supportChatMessage.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  kind: text("kind").notNull(),
  mimeType: text("mimeType").notNull(),
  fileName: text("fileName").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  storagePath: text("storagePath").notNull(),
  transcript: text("transcript"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const supportKnowledgeSource = pgTable("support_knowledge_source", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id),
  sourceType: text("sourceType").notNull(),
  title: text("title").notNull(),
  visibility: text("visibility").notNull().default("customer"),
  status: text("status").notNull().default("active"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const supportKnowledgeChunk = pgTable("support_knowledge_chunk", {
  id: text("id").primaryKey(),
  sourceId: text("sourceId")
    .notNull()
    .references(() => supportKnowledgeSource.id),
  userId: text("userId").references(() => user.id),
  chunkText: text("chunkText").notNull(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  tokenEstimate: integer("tokenEstimate").notNull().default(0),
  confidence: integer("confidence").notNull().default(70),
  status: text("status").notNull().default("active"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const supportLearningEvent = pgTable("support_learning_event", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => user.id),
  sessionId: text("sessionId").references(() => supportChatSession.id),
  ticketId: text("ticketId").references(() => supportTicket.id),
  sourceId: text("sourceId").references(() => supportKnowledgeSource.id),
  eventType: text("eventType").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("stored"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const intelligenceProject = pgTable("intelligence_project", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  businessName: text("businessName").notNull(),
  websiteUrl: text("websiteUrl").notNull(),
  location: text("location"),
  industry: text("industry"),
  servicesProducts: text("servicesProducts"),
  status: text("status").notNull().default("draft"),
  lastScanStatus: text("lastScanStatus"),
  lastScanAt: timestamp("lastScanAt"),
  nextScanAt: timestamp("nextScanAt"),
  visibilityScore: integer("visibilityScore").notNull().default(0),
  technicalSeoScore: integer("technicalSeoScore").notNull().default(0),
  contentSeoScore: integer("contentSeoScore").notNull().default(0),
  contentGapScore: integer("contentGapScore").notNull().default(0),
  localSeoScore: integer("localSeoScore").notNull().default(0),
  performanceScore: integer("performanceScore").notNull().default(0),
  aiReadinessScore: integer("aiReadinessScore").notNull().default(0),
  opportunityScore: integer("opportunityScore").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceCompetitor = pgTable("intelligence_competitor", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  websiteUrl: text("websiteUrl").notNull(),
  competitorType: text("competitorType").notNull().default("manual"),
  status: text("status").notNull().default("active"),
  visibilityScore: integer("visibilityScore").notNull().default(0),
  technicalSeoScore: integer("technicalSeoScore").notNull().default(0),
  contentSeoScore: integer("contentSeoScore").notNull().default(0),
  localSeoScore: integer("localSeoScore").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceKeyword = pgTable("intelligence_keyword", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  keyword: text("keyword").notNull(),
  location: text("location"),
  device: text("device").notNull().default("desktop"),
  intent: text("intent"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceKeywordRanking = pgTable("intelligence_keyword_ranking", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  keywordId: text("keywordId").references(() => intelligenceKeyword.id),
  competitorId: text("competitorId").references(() => intelligenceCompetitor.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  keyword: text("keyword").notNull(),
  target: text("target").notNull().default("primary"),
  rank: integer("rank"),
  previousRank: integer("previousRank"),
  bestRank: integer("bestRank"),
  searchVolume: integer("searchVolume"),
  difficulty: integer("difficulty"),
  opportunity: text("opportunity"),
  serpFeatures: text("serpFeatures"),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const intelligenceJob = pgTable("intelligence_job", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  jobType: text("jobType").notNull(),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("n8n"),
  externalRunId: text("externalRunId"),
  error: text("error"),
  input: text("input"),
  output: text("output"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceCrawlPage = pgTable("intelligence_crawl_page", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  jobId: text("jobId").references(() => intelligenceJob.id),
  competitorId: text("competitorId").references(() => intelligenceCompetitor.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  url: text("url").notNull(),
  target: text("target").notNull().default("primary"),
  httpStatus: integer("httpStatus"),
  title: text("title"),
  metaDescription: text("metaDescription"),
  h1: text("h1"),
  h2Count: integer("h2Count").notNull().default(0),
  wordCount: integer("wordCount").notNull().default(0),
  internalLinkCount: integer("internalLinkCount").notNull().default(0),
  externalLinkCount: integer("externalLinkCount").notNull().default(0),
  imageMissingAltCount: integer("imageMissingAltCount").notNull().default(0),
  hasCanonical: boolean("hasCanonical").notNull().default(false),
  hasSchema: boolean("hasSchema").notNull().default(false),
  loadTimeMs: integer("loadTimeMs"),
  screenshotUrl: text("screenshotUrl"),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const intelligenceSeoAudit = pgTable("intelligence_seo_audit", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  jobId: text("jobId").references(() => intelligenceJob.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  target: text("target").notNull().default("primary"),
  targetUrl: text("targetUrl").notNull(),
  technicalScore: integer("technicalScore").notNull().default(0),
  contentScore: integer("contentScore").notNull().default(0),
  localScore: integer("localScore").notNull().default(0),
  performanceScore: integer("performanceScore").notNull().default(0),
  aiReadinessScore: integer("aiReadinessScore").notNull().default(0),
  summary: text("summary"),
  raw: text("raw"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const intelligencePageIssue = pgTable("intelligence_page_issue", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  auditId: text("auditId").references(() => intelligenceSeoAudit.id),
  crawlPageId: text("crawlPageId").references(() => intelligenceCrawlPage.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description"),
  recommendation: text("recommendation"),
  sourceUrl: text("sourceUrl"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceContentGap = pgTable("intelligence_content_gap", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  competitorId: text("competitorId").references(() => intelligenceCompetitor.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  gapType: text("gapType").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  opportunity: text("opportunity").notNull().default("medium"),
  sourceUrl: text("sourceUrl"),
  suggestedAction: text("suggestedAction"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceSerpResult = pgTable("intelligence_serp_result", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  keywordId: text("keywordId").references(() => intelligenceKeyword.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  keyword: text("keyword").notNull(),
  location: text("location"),
  device: text("device"),
  resultUrl: text("resultUrl"),
  resultTitle: text("resultTitle"),
  domain: text("domain"),
  rank: integer("rank"),
  resultType: text("resultType").notNull().default("organic"),
  hasAds: boolean("hasAds").notNull().default(false),
  hasMapPack: boolean("hasMapPack").notNull().default(false),
  hasAiOverview: boolean("hasAiOverview").notNull().default(false),
  raw: text("raw"),
  observedAt: timestamp("observedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const intelligenceRecommendation = pgTable("intelligence_recommendation", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("seo"),
  priority: text("priority").notNull().default("medium"),
  impact: text("impact").notNull().default("medium"),
  effort: text("effort").notNull().default("medium"),
  sourceType: text("sourceType"),
  sourceId: text("sourceId"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceReport = pgTable("intelligence_report", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  jobId: text("jobId").references(() => intelligenceJob.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  executiveSummary: text("executiveSummary"),
  insightPacket: text("insightPacket"),
  reportJson: text("reportJson"),
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceScheduledReport = pgTable("intelligence_scheduled_report", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  frequency: text("frequency").notNull().default("weekly"),
  status: text("status").notNull().default("active"),
  nextRunAt: timestamp("nextRunAt"),
  lastRunAt: timestamp("lastRunAt"),
  recipients: text("recipients"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceIntegration = pgTable("intelligence_integration", {
  id: text("id").primaryKey(),
  projectId: text("projectId")
    .notNull()
    .references(() => intelligenceProject.id),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("configured"),
  config: text("config"),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorUserId: text("actorUserId").references(() => user.id),
  action: text("action").notNull(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId"),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey(),
  workspaceName: text("workspaceName").notNull().default("CloudMonkey Workspace"),
  adminNotificationEmail: text("adminNotificationEmail"),
  securityContactEmail: text("securityContactEmail"),
  billingLegalName: text("billingLegalName"),
  billingEmail: text("billingEmail"),
  billingPhone: text("billingPhone"),
  billingWebsite: text("billingWebsite"),
  billingAddress: text("billingAddress"),
  billingRegistrationNumber: text("billingRegistrationNumber"),
  billingVatNumber: text("billingVatNumber"),
  billingBankName: text("billingBankName"),
  billingBankAccountName: text("billingBankAccountName"),
  billingBankAccountNumber: text("billingBankAccountNumber"),
  billingBankBranchCode: text("billingBankBranchCode"),
  billingInvoiceNotes: text("billingInvoiceNotes"),
  defaultTicketPriority: text("defaultTicketPriority").notNull().default("medium"),
  allowCustomerTicketCreation: boolean("allowCustomerTicketCreation").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const intelligenceProjectRelations = relations(intelligenceProject, ({ one, many }) => ({
  user: one(user, {
    fields: [intelligenceProject.userId],
    references: [user.id],
  }),
  competitors: many(intelligenceCompetitor),
  keywords: many(intelligenceKeyword),
  rankings: many(intelligenceKeywordRanking),
  jobs: many(intelligenceJob),
  crawlPages: many(intelligenceCrawlPage),
  audits: many(intelligenceSeoAudit),
  issues: many(intelligencePageIssue),
  contentGaps: many(intelligenceContentGap),
  serpResults: many(intelligenceSerpResult),
  recommendations: many(intelligenceRecommendation),
  reports: many(intelligenceReport),
  scheduledReports: many(intelligenceScheduledReport),
  integrations: many(intelligenceIntegration),
}));

export const intelligenceCompetitorRelations = relations(
  intelligenceCompetitor,
  ({ one, many }) => ({
    project: one(intelligenceProject, {
      fields: [intelligenceCompetitor.projectId],
      references: [intelligenceProject.id],
    }),
    user: one(user, {
      fields: [intelligenceCompetitor.userId],
      references: [user.id],
    }),
    rankings: many(intelligenceKeywordRanking),
    crawlPages: many(intelligenceCrawlPage),
    contentGaps: many(intelligenceContentGap),
  }),
);

export const intelligenceKeywordRelations = relations(intelligenceKeyword, ({ one, many }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceKeyword.projectId],
    references: [intelligenceProject.id],
  }),
  user: one(user, {
    fields: [intelligenceKeyword.userId],
    references: [user.id],
  }),
  rankings: many(intelligenceKeywordRanking),
  serpResults: many(intelligenceSerpResult),
}));

export const intelligenceKeywordRankingRelations = relations(
  intelligenceKeywordRanking,
  ({ one }) => ({
    project: one(intelligenceProject, {
      fields: [intelligenceKeywordRanking.projectId],
      references: [intelligenceProject.id],
    }),
    keyword: one(intelligenceKeyword, {
      fields: [intelligenceKeywordRanking.keywordId],
      references: [intelligenceKeyword.id],
    }),
    competitor: one(intelligenceCompetitor, {
      fields: [intelligenceKeywordRanking.competitorId],
      references: [intelligenceCompetitor.id],
    }),
    user: one(user, {
      fields: [intelligenceKeywordRanking.userId],
      references: [user.id],
    }),
  }),
);

export const intelligenceJobRelations = relations(intelligenceJob, ({ one, many }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceJob.projectId],
    references: [intelligenceProject.id],
  }),
  user: one(user, {
    fields: [intelligenceJob.userId],
    references: [user.id],
  }),
  crawlPages: many(intelligenceCrawlPage),
  audits: many(intelligenceSeoAudit),
  reports: many(intelligenceReport),
}));

export const intelligenceCrawlPageRelations = relations(intelligenceCrawlPage, ({ one, many }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceCrawlPage.projectId],
    references: [intelligenceProject.id],
  }),
  job: one(intelligenceJob, {
    fields: [intelligenceCrawlPage.jobId],
    references: [intelligenceJob.id],
  }),
  competitor: one(intelligenceCompetitor, {
    fields: [intelligenceCrawlPage.competitorId],
    references: [intelligenceCompetitor.id],
  }),
  user: one(user, {
    fields: [intelligenceCrawlPage.userId],
    references: [user.id],
  }),
  issues: many(intelligencePageIssue),
}));

export const intelligenceSeoAuditRelations = relations(intelligenceSeoAudit, ({ one, many }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceSeoAudit.projectId],
    references: [intelligenceProject.id],
  }),
  job: one(intelligenceJob, {
    fields: [intelligenceSeoAudit.jobId],
    references: [intelligenceJob.id],
  }),
  user: one(user, {
    fields: [intelligenceSeoAudit.userId],
    references: [user.id],
  }),
  issues: many(intelligencePageIssue),
}));

export const intelligencePageIssueRelations = relations(intelligencePageIssue, ({ one }) => ({
  project: one(intelligenceProject, {
    fields: [intelligencePageIssue.projectId],
    references: [intelligenceProject.id],
  }),
  audit: one(intelligenceSeoAudit, {
    fields: [intelligencePageIssue.auditId],
    references: [intelligenceSeoAudit.id],
  }),
  crawlPage: one(intelligenceCrawlPage, {
    fields: [intelligencePageIssue.crawlPageId],
    references: [intelligenceCrawlPage.id],
  }),
  user: one(user, {
    fields: [intelligencePageIssue.userId],
    references: [user.id],
  }),
}));

export const intelligenceContentGapRelations = relations(intelligenceContentGap, ({ one }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceContentGap.projectId],
    references: [intelligenceProject.id],
  }),
  competitor: one(intelligenceCompetitor, {
    fields: [intelligenceContentGap.competitorId],
    references: [intelligenceCompetitor.id],
  }),
  user: one(user, {
    fields: [intelligenceContentGap.userId],
    references: [user.id],
  }),
}));

export const intelligenceSerpResultRelations = relations(intelligenceSerpResult, ({ one }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceSerpResult.projectId],
    references: [intelligenceProject.id],
  }),
  keyword: one(intelligenceKeyword, {
    fields: [intelligenceSerpResult.keywordId],
    references: [intelligenceKeyword.id],
  }),
  user: one(user, {
    fields: [intelligenceSerpResult.userId],
    references: [user.id],
  }),
}));

export const intelligenceRecommendationRelations = relations(
  intelligenceRecommendation,
  ({ one }) => ({
    project: one(intelligenceProject, {
      fields: [intelligenceRecommendation.projectId],
      references: [intelligenceProject.id],
    }),
    user: one(user, {
      fields: [intelligenceRecommendation.userId],
      references: [user.id],
    }),
  }),
);

export const intelligenceReportRelations = relations(intelligenceReport, ({ one }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceReport.projectId],
    references: [intelligenceProject.id],
  }),
  job: one(intelligenceJob, {
    fields: [intelligenceReport.jobId],
    references: [intelligenceJob.id],
  }),
  user: one(user, {
    fields: [intelligenceReport.userId],
    references: [user.id],
  }),
}));

export const intelligenceScheduledReportRelations = relations(
  intelligenceScheduledReport,
  ({ one }) => ({
    project: one(intelligenceProject, {
      fields: [intelligenceScheduledReport.projectId],
      references: [intelligenceProject.id],
    }),
    user: one(user, {
      fields: [intelligenceScheduledReport.userId],
      references: [user.id],
    }),
  }),
);

export const intelligenceIntegrationRelations = relations(intelligenceIntegration, ({ one }) => ({
  project: one(intelligenceProject, {
    fields: [intelligenceIntegration.projectId],
    references: [intelligenceProject.id],
  }),
  user: one(user, {
    fields: [intelligenceIntegration.userId],
    references: [user.id],
  }),
}));

export const serviceCategoryRelations = relations(serviceCategory, ({ many }) => ({
  services: many(service),
}));

export const serviceRelations = relations(service, ({ one, many }) => ({
  category: one(serviceCategory, {
    fields: [service.categoryId],
    references: [serviceCategory.id],
  }),
  plans: many(servicePlan),
}));

export const servicePlanRelations = relations(servicePlan, ({ one, many }) => ({
  service: one(service, {
    fields: [servicePlan.serviceId],
    references: [service.id],
  }),
  features: many(serviceFeature),
  agreementTemplate: one(agreementTemplate, {
    fields: [servicePlan.agreementTemplateId],
    references: [agreementTemplate.id],
  }),
}));

export const serviceFeatureRelations = relations(serviceFeature, ({ one }) => ({
  plan: one(servicePlan, {
    fields: [serviceFeature.planId],
    references: [servicePlan.id],
  }),
}));

export const bundleRelations = relations(bundle, ({ one, many }) => ({
  features: many(bundleFeature),
  agreementTemplate: one(agreementTemplate, {
    fields: [bundle.agreementTemplateId],
    references: [agreementTemplate.id],
  }),
}));

export const bundleFeatureRelations = relations(bundleFeature, ({ one }) => ({
  bundle: one(bundle, {
    fields: [bundleFeature.bundleId],
    references: [bundle.id],
  }),
}));

export const leadRelations = relations(lead, ({ one, many }) => ({
  user: one(user, {
    fields: [lead.userId],
    references: [user.id],
  }),
  proposals: many(proposal),
  caesarSessions: many(caesarChatSession),
}));

export const caesarChatSessionRelations = relations(caesarChatSession, ({ one, many }) => ({
  user: one(user, {
    fields: [caesarChatSession.userId],
    references: [user.id],
  }),
  lead: one(lead, {
    fields: [caesarChatSession.leadId],
    references: [lead.id],
  }),
  messages: many(caesarChatMessage),
}));

export const caesarChatMessageRelations = relations(caesarChatMessage, ({ one }) => ({
  session: one(caesarChatSession, {
    fields: [caesarChatMessage.sessionId],
    references: [caesarChatSession.id],
  }),
}));

export const proposalRelations = relations(proposal, ({ one, many }) => ({
  lead: one(lead, {
    fields: [proposal.leadId],
    references: [lead.id],
  }),
  customer: one(user, {
    fields: [proposal.customerUserId],
    references: [user.id],
  }),
  invoice: one(invoice, {
    fields: [proposal.invoiceId],
    references: [invoice.id],
  }),
  createdBy: one(user, {
    fields: [proposal.createdByUserId],
    references: [user.id],
  }),
  items: many(proposalItem),
}));

export const proposalItemRelations = relations(proposalItem, ({ one }) => ({
  proposal: one(proposal, {
    fields: [proposalItem.proposalId],
    references: [proposal.id],
  }),
  plan: one(servicePlan, {
    fields: [proposalItem.planId],
    references: [servicePlan.id],
  }),
  bundle: one(bundle, {
    fields: [proposalItem.bundleId],
    references: [bundle.id],
  }),
}));

export const pitchDeckRelations = relations(pitchDeck, ({ one }) => ({
  customer: one(user, { fields: [pitchDeck.customerUserId], references: [user.id] }),
  lead: one(lead, { fields: [pitchDeck.leadId], references: [lead.id] }),
  createdBy: one(user, { fields: [pitchDeck.createdByUserId], references: [user.id] }),
}));

export const websiteRelations = relations(website, ({ one, many }) => ({
  user: one(user, {
    fields: [website.userId],
    references: [user.id],
  }),
  subscription: one(subscription, {
    fields: [website.subscriptionId],
    references: [subscription.id],
  }),
  invoice: one(invoice, {
    fields: [website.invoiceId],
    references: [invoice.id],
  }),
  store: one(websiteStore, {
    fields: [website.id],
    references: [websiteStore.websiteId],
  }),
  domains: many(websiteDomain),
  designOptions: many(websiteDesignOption),
  pluginInstalls: many(websitePluginInstall),
  approvalTokens: many(websiteApprovalToken),
  reviewRequests: many(websiteReviewRequest),
  healthChecks: many(websiteHealthCheck),
  remediationAttempts: many(remediationAttempt),
}));

export const websiteHealthCheckRelations = relations(websiteHealthCheck, ({ one }) => ({
  website: one(website, {
    fields: [websiteHealthCheck.websiteId],
    references: [website.id],
  }),
}));

export const remediationAttemptRelations = relations(remediationAttempt, ({ one }) => ({
  website: one(website, {
    fields: [remediationAttempt.websiteId],
    references: [website.id],
  }),
  healthCheck: one(websiteHealthCheck, {
    fields: [remediationAttempt.healthCheckId],
    references: [websiteHealthCheck.id],
  }),
}));

export const websiteRuntimeServerRelations = relations(websiteRuntimeServer, ({ many }) => ({
  websites: many(website),
}));

export const websiteStoreRelations = relations(websiteStore, ({ one, many }) => ({
  website: one(website, {
    fields: [websiteStore.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteStore.userId],
    references: [user.id],
  }),
  database: one(websiteStoreDatabase, {
    fields: [websiteStore.id],
    references: [websiteStoreDatabase.storeId],
  }),
  plugins: many(websitePluginInstall),
  products: many(storeProduct),
  customers: many(storeCustomer),
  orders: many(storeOrder),
  payments: many(storePayment),
}));

export const websiteStoreDatabaseRelations = relations(websiteStoreDatabase, ({ one }) => ({
  store: one(websiteStore, {
    fields: [websiteStoreDatabase.storeId],
    references: [websiteStore.id],
  }),
  website: one(website, {
    fields: [websiteStoreDatabase.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteStoreDatabase.userId],
    references: [user.id],
  }),
}));

export const websiteDomainRelations = relations(websiteDomain, ({ one }) => ({
  website: one(website, {
    fields: [websiteDomain.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteDomain.userId],
    references: [user.id],
  }),
}));

export const websiteDesignOptionRelations = relations(websiteDesignOption, ({ one }) => ({
  website: one(website, {
    fields: [websiteDesignOption.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteDesignOption.userId],
    references: [user.id],
  }),
}));

export const websiteApprovalTokenRelations = relations(websiteApprovalToken, ({ one }) => ({
  website: one(website, {
    fields: [websiteApprovalToken.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteApprovalToken.userId],
    references: [user.id],
  }),
}));

export const websiteReviewRequestRelations = relations(websiteReviewRequest, ({ one }) => ({
  website: one(website, {
    fields: [websiteReviewRequest.websiteId],
    references: [website.id],
  }),
  user: one(user, {
    fields: [websiteReviewRequest.userId],
    references: [user.id],
  }),
}));

export const websitePluginInstallRelations = relations(websitePluginInstall, ({ one }) => ({
  website: one(website, {
    fields: [websitePluginInstall.websiteId],
    references: [website.id],
  }),
  store: one(websiteStore, {
    fields: [websitePluginInstall.storeId],
    references: [websiteStore.id],
  }),
  user: one(user, {
    fields: [websitePluginInstall.userId],
    references: [user.id],
  }),
}));

export const storeProductRelations = relations(storeProduct, ({ one, many }) => ({
  store: one(websiteStore, {
    fields: [storeProduct.storeId],
    references: [websiteStore.id],
  }),
  user: one(user, {
    fields: [storeProduct.userId],
    references: [user.id],
  }),
  variants: many(storeProductVariant),
}));

export const storeProductVariantRelations = relations(storeProductVariant, ({ one, many }) => ({
  product: one(storeProduct, {
    fields: [storeProductVariant.productId],
    references: [storeProduct.id],
  }),
  store: one(websiteStore, {
    fields: [storeProductVariant.storeId],
    references: [websiteStore.id],
  }),
  inventoryMovements: many(storeInventoryMovement),
}));

export const storeInventoryMovementRelations = relations(storeInventoryMovement, ({ one }) => ({
  store: one(websiteStore, {
    fields: [storeInventoryMovement.storeId],
    references: [websiteStore.id],
  }),
  variant: one(storeProductVariant, {
    fields: [storeInventoryMovement.productVariantId],
    references: [storeProductVariant.id],
  }),
  user: one(user, {
    fields: [storeInventoryMovement.createdBy],
    references: [user.id],
  }),
}));

export const storeCustomerRelations = relations(storeCustomer, ({ one, many }) => ({
  store: one(websiteStore, {
    fields: [storeCustomer.storeId],
    references: [websiteStore.id],
  }),
  orders: many(storeOrder),
}));

export const storeOrderRelations = relations(storeOrder, ({ one, many }) => ({
  store: one(websiteStore, {
    fields: [storeOrder.storeId],
    references: [websiteStore.id],
  }),
  customer: one(storeCustomer, {
    fields: [storeOrder.customerId],
    references: [storeCustomer.id],
  }),
  items: many(storeOrderItem),
  payments: many(storePayment),
}));

export const storeOrderItemRelations = relations(storeOrderItem, ({ one }) => ({
  order: one(storeOrder, {
    fields: [storeOrderItem.orderId],
    references: [storeOrder.id],
  }),
  product: one(storeProduct, {
    fields: [storeOrderItem.productId],
    references: [storeProduct.id],
  }),
  variant: one(storeProductVariant, {
    fields: [storeOrderItem.variantId],
    references: [storeProductVariant.id],
  }),
}));

export const storePaymentRelations = relations(storePayment, ({ one }) => ({
  store: one(websiteStore, {
    fields: [storePayment.storeId],
    references: [websiteStore.id],
  }),
  order: one(storeOrder, {
    fields: [storePayment.orderId],
    references: [storeOrder.id],
  }),
}));

export const serverAgentRelations = relations(serverAgent, ({ one, many }) => ({
  user: one(user, {
    fields: [serverAgent.userId],
    references: [user.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverAgent.instanceId],
    references: [vultrInstance.id],
  }),
  snapshots: many(serverTelemetrySnapshot),
  findings: many(serverSecurityFinding),
  websites: many(serverWebsite),
  containers: many(serverContainer),
  databases: many(serverDatabase),
  aiRuntimes: many(detectedAiRuntime),
  n8nIntegrations: many(serverN8nIntegration),
}));

export const serverTelemetrySnapshotRelations = relations(serverTelemetrySnapshot, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [serverTelemetrySnapshot.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverTelemetrySnapshot.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverTelemetrySnapshot.userId],
    references: [user.id],
  }),
}));

export const serverSecurityFindingRelations = relations(serverSecurityFinding, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [serverSecurityFinding.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverSecurityFinding.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverSecurityFinding.userId],
    references: [user.id],
  }),
}));

export const serverWebsiteRelations = relations(serverWebsite, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [serverWebsite.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverWebsite.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverWebsite.userId],
    references: [user.id],
  }),
}));

export const serverContainerRelations = relations(serverContainer, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [serverContainer.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverContainer.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverContainer.userId],
    references: [user.id],
  }),
}));

export const serverDatabaseRelations = relations(serverDatabase, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [serverDatabase.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverDatabase.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverDatabase.userId],
    references: [user.id],
  }),
}));

export const detectedAiRuntimeRelations = relations(detectedAiRuntime, ({ one }) => ({
  agent: one(serverAgent, {
    fields: [detectedAiRuntime.agentId],
    references: [serverAgent.id],
  }),
  instance: one(vultrInstance, {
    fields: [detectedAiRuntime.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [detectedAiRuntime.userId],
    references: [user.id],
  }),
}));

export const serverN8nIntegrationRelations = relations(serverN8nIntegration, ({ one, many }) => ({
  instance: one(vultrInstance, {
    fields: [serverN8nIntegration.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverN8nIntegration.userId],
    references: [user.id],
  }),
  workflows: many(serverN8nWorkflow),
}));

export const serverN8nWorkflowRelations = relations(serverN8nWorkflow, ({ one }) => ({
  integration: one(serverN8nIntegration, {
    fields: [serverN8nWorkflow.integrationId],
    references: [serverN8nIntegration.id],
  }),
  instance: one(vultrInstance, {
    fields: [serverN8nWorkflow.instanceId],
    references: [vultrInstance.id],
  }),
  user: one(user, {
    fields: [serverN8nWorkflow.userId],
    references: [user.id],
  }),
}));

export const domainOrderRelations = relations(domainOrder, ({ one }) => ({
  user: one(user, {
    fields: [domainOrder.userId],
    references: [user.id],
  }),
  invoice: one(invoice, {
    fields: [domainOrder.invoiceId],
    references: [invoice.id],
  }),
  subscription: one(subscription, {
    fields: [domainOrder.subscriptionId],
    references: [subscription.id],
  }),
  plan: one(servicePlan, {
    fields: [domainOrder.domainPlanId],
    references: [servicePlan.id],
  }),
}));

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  user: one(user, {
    fields: [subscription.userId],
    references: [user.id],
  }),
  plan: one(servicePlan, {
    fields: [subscription.planId],
    references: [servicePlan.id],
  }),
  bundle: one(bundle, {
    fields: [subscription.bundleId],
    references: [bundle.id],
  }),
  requiredAgreementTemplate: one(agreementTemplate, {
    fields: [subscription.requiredAgreementTemplateId],
    references: [agreementTemplate.id],
  }),
  signedAgreements: many(signedAgreement),
}));

export const agreementTemplateRelations = relations(agreementTemplate, ({ many }) => ({
  skuMappings: many(agreementTemplateSku),
  signedAgreements: many(signedAgreement),
}));

export const agreementTemplateSkuRelations = relations(agreementTemplateSku, ({ one }) => ({
  template: one(agreementTemplate, {
    fields: [agreementTemplateSku.templateId],
    references: [agreementTemplate.id],
  }),
}));

export const signedAgreementRelations = relations(signedAgreement, ({ one }) => ({
  user: one(user, {
    fields: [signedAgreement.userId],
    references: [user.id],
  }),
  subscription: one(subscription, {
    fields: [signedAgreement.subscriptionId],
    references: [subscription.id],
  }),
  template: one(agreementTemplate, {
    fields: [signedAgreement.templateId],
    references: [agreementTemplate.id],
  }),
}));

export const affiliateRelations = relations(affiliate, ({ one, many }) => ({
  user: one(user, {
    fields: [affiliate.userId],
    references: [user.id],
  }),
  referrals: many(affiliateReferral),
  commissions: many(affiliateCommission),
  payouts: many(affiliatePayout),
  fraudFlags: many(affiliateFraudFlag),
}));

export const affiliateReferralRelations = relations(affiliateReferral, ({ one, many }) => ({
  affiliate: one(affiliate, {
    fields: [affiliateReferral.affiliateId],
    references: [affiliate.id],
  }),
  lead: one(lead, {
    fields: [affiliateReferral.leadId],
    references: [lead.id],
  }),
  customer: one(user, {
    fields: [affiliateReferral.customerId],
    references: [user.id],
  }),
  commissions: many(affiliateCommission),
  fraudFlags: many(affiliateFraudFlag),
}));

export const affiliateCommissionRelations = relations(affiliateCommission, ({ one }) => ({
  affiliate: one(affiliate, {
    fields: [affiliateCommission.affiliateId],
    references: [affiliate.id],
  }),
  referral: one(affiliateReferral, {
    fields: [affiliateCommission.referralId],
    references: [affiliateReferral.id],
  }),
  customer: one(user, {
    fields: [affiliateCommission.customerId],
    references: [user.id],
  }),
  invoice: one(invoice, {
    fields: [affiliateCommission.invoiceId],
    references: [invoice.id],
  }),
  subscription: one(subscription, {
    fields: [affiliateCommission.subscriptionId],
    references: [subscription.id],
  }),
}));

export const affiliatePayoutRelations = relations(affiliatePayout, ({ one }) => ({
  affiliate: one(affiliate, {
    fields: [affiliatePayout.affiliateId],
    references: [affiliate.id],
  }),
  admin: one(user, {
    fields: [affiliatePayout.adminId],
    references: [user.id],
  }),
}));

export const affiliateFraudFlagRelations = relations(affiliateFraudFlag, ({ one }) => ({
  affiliate: one(affiliate, {
    fields: [affiliateFraudFlag.affiliateId],
    references: [affiliate.id],
  }),
  referral: one(affiliateReferral, {
    fields: [affiliateFraudFlag.referralId],
    references: [affiliateReferral.id],
  }),
  customer: one(user, {
    fields: [affiliateFraudFlag.customerId],
    references: [user.id],
  }),
}));

export const onboardingSubmissionRelations = relations(onboardingSubmission, ({ one }) => ({
  user: one(user, {
    fields: [onboardingSubmission.userId],
    references: [user.id],
  }),
  subscription: one(subscription, {
    fields: [onboardingSubmission.subscriptionId],
    references: [subscription.id],
  }),
}));

export const aiAgentRelations = relations(aiAgent, ({ one }) => ({
  user: one(user, {
    fields: [aiAgent.userId],
    references: [user.id],
  }),
}));

export const supportTicketRelations = relations(supportTicket, ({ one, many }) => ({
  user: one(user, {
    fields: [supportTicket.userId],
    references: [user.id],
  }),
  assignee: one(user, {
    fields: [supportTicket.assignedToUserId],
    references: [user.id],
  }),
  comments: many(supportTicketComment),
}));

export const supportTicketCommentRelations = relations(supportTicketComment, ({ one }) => ({
  ticket: one(supportTicket, {
    fields: [supportTicketComment.ticketId],
    references: [supportTicket.id],
  }),
  user: one(user, {
    fields: [supportTicketComment.userId],
    references: [user.id],
  }),
}));

export const supportChatSessionRelations = relations(supportChatSession, ({ one, many }) => ({
  user: one(user, {
    fields: [supportChatSession.userId],
    references: [user.id],
  }),
  ticket: one(supportTicket, {
    fields: [supportChatSession.ticketId],
    references: [supportTicket.id],
  }),
  messages: many(supportChatMessage),
  attachments: many(supportChatAttachment),
}));

export const supportChatMessageRelations = relations(supportChatMessage, ({ one, many }) => ({
  session: one(supportChatSession, {
    fields: [supportChatMessage.sessionId],
    references: [supportChatSession.id],
  }),
  user: one(user, {
    fields: [supportChatMessage.userId],
    references: [user.id],
  }),
  attachments: many(supportChatAttachment),
}));

export const supportChatAttachmentRelations = relations(supportChatAttachment, ({ one }) => ({
  session: one(supportChatSession, {
    fields: [supportChatAttachment.sessionId],
    references: [supportChatSession.id],
  }),
  message: one(supportChatMessage, {
    fields: [supportChatAttachment.messageId],
    references: [supportChatMessage.id],
  }),
  user: one(user, {
    fields: [supportChatAttachment.userId],
    references: [user.id],
  }),
}));

export const adminChatSession = pgTable("admin_chat_session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull().default("open"),
  summary: text("summary"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const adminChatMessage = pgTable("admin_chat_message", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId")
    .notNull()
    .references(() => adminChatSession.id),
  userId: text("userId").references(() => user.id),
  role: text("role").notNull(),
  body: text("body").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const adminChatSessionRelations = relations(adminChatSession, ({ one, many }) => ({
  user: one(user, {
    fields: [adminChatSession.userId],
    references: [user.id],
  }),
  messages: many(adminChatMessage),
}));

export const adminChatMessageRelations = relations(adminChatMessage, ({ one }) => ({
  session: one(adminChatSession, {
    fields: [adminChatMessage.sessionId],
    references: [adminChatSession.id],
  }),
  user: one(user, {
    fields: [adminChatMessage.userId],
    references: [user.id],
  }),
}));
