import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "bun:test";

const serverSource = readFileSync(path.join(import.meta.dir, "../src/server.ts"), "utf8");
const webhookSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/webhooks.ts"),
  "utf8",
);
const billingSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/billing.ts"),
  "utf8",
);
const domainsSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/domains.ts"),
  "utf8",
);
const intelligenceSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/intelligence.ts"),
  "utf8",
);
const affiliatesSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/affiliates.ts"),
  "utf8",
);
const walletSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/wallet.ts"),
  "utf8",
);
const supportChatSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/support-chat.ts"),
  "utf8",
);
const adminSource = readFileSync(path.join(import.meta.dir, "../src/lib/domain/admin.ts"), "utf8");
const agentsRuntimeSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/agents-runtime.ts"),
  "utf8",
);
const internalToolsSource = readFileSync(
  path.join(import.meta.dir, "../src/lib/domain/internal-tools.ts"),
  "utf8",
);
const walletMigrationSource = readFileSync(
  path.join(import.meta.dir, "../drizzle/0026_token_wallet.sql"),
  "utf8",
);
const serverLines = serverSource.split(/\r?\n/);

function snippetFrom(lineIndex: number, window = 28) {
  return serverLines.slice(lineIndex, lineIndex + window).join("\n");
}

function routeContext(lineIndex: number, before = 180, after = 28) {
  return serverLines.slice(Math.max(0, lineIndex - before), lineIndex + after).join("\n");
}

function routeGuardChecks() {
  return serverLines.flatMap((line, index) => {
    const looksLikeProtectedRoute =
      line.includes("if (url.pathname") &&
      (line.includes('"/api/admin') ||
        line.includes('"/api/user/affiliate"') ||
        line.includes('"/api/admin/affiliates"') ||
        line.includes('"/api/user/intelligence"') ||
        line.includes('"/api/admin/intelligence"') ||
        line.includes('"/api/user/domain-orders"') ||
        line.includes('"/api/user/domains"') ||
        line.includes('"/api/user/website-onboarding"') ||
        line.includes('"/api/user/websites"') ||
        line.includes('"/api/user/wallet"') ||
        line.includes('"/api/admin/wallet"') ||
        line.includes('"/api/internal') ||
        line.includes('"/api/webhooks') ||
        line.includes('"/api/admin/'));

    if (!looksLikeProtectedRoute) return [];
    return [{ line: index + 1, text: line, snippet: routeContext(index) }];
  });
}

describe("server route security audit", () => {
  test("dashboard HTML routes require an authenticated session before SSR", () => {
    expect(serverSource).toContain(
      'url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")',
    );
    expect(serverSource).toContain("auth.api.getSession({ headers: request.headers })");
    expect(serverSource).toContain(
      "Location: `/auth/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`",
    );
  });

  test("manual invoice requests are delegated before the generic admin handler", () => {
    const manualInvoices = serverSource.indexOf(
      'url.pathname.startsWith("/api/admin/manual-invoices")',
    );
    const genericAdmin = serverSource.indexOf('url.pathname.startsWith("/api/admin/")');

    expect(manualInvoices).toBeGreaterThanOrEqual(0);
    expect(genericAdmin).toBeGreaterThan(manualInvoices);
    expect(serverSource).toContain("billingHandlers.handleAdminManualInvoices(request)");
  });

  test("server-agent enrollment is delegated before the generic admin handler", () => {
    const enrollmentIndex = serverSource.indexOf(
      'url.pathname === "/api/admin/server-agents/enrollment"',
    );
    const genericAdmin = serverSource.indexOf('url.pathname.startsWith("/api/admin/")');

    expect(enrollmentIndex).toBeGreaterThanOrEqual(0);
    expect(genericAdmin).toBeGreaterThan(enrollmentIndex);
    expect(serverSource).toContain(
      "agentsRuntimeHandlers.handleAdminServerAgentEnrollment(request)",
    );
  });

  test("billing invoice and subscription routes are delegated before the generic admin handler", () => {
    const invoiceIndex = serverSource.indexOf('url.pathname.startsWith("/api/admin/invoices")');
    const subscriptionIndex = serverSource.indexOf(
      'url.pathname.startsWith("/api/admin/subscriptions")',
    );
    const genericAdmin = serverSource.indexOf('url.pathname.startsWith("/api/admin/")');

    expect(invoiceIndex).toBeGreaterThanOrEqual(0);
    expect(subscriptionIndex).toBeGreaterThanOrEqual(0);
    expect(genericAdmin).toBeGreaterThan(invoiceIndex);
    expect(genericAdmin).toBeGreaterThan(subscriptionIndex);
    expect(serverSource).toContain("billingHandlers.handleAdminInvoices(request)");
    expect(serverSource).toContain("billingHandlers.handleAdminSubscriptions(request)");
  });

  test("public general scan is delegated to the rate-limited scan handler", () => {
    const scanIndex = serverSource.indexOf('url.pathname === "/api/public/scan"');
    const genericAdmin = serverSource.indexOf('url.pathname.startsWith("/api/admin/")');

    expect(scanIndex).toBeGreaterThanOrEqual(0);
    expect(genericAdmin).toBeGreaterThan(scanIndex);
    expect(serverSource).toContain("publicScanHandlers.handleGeneralScan(request)");
  });

  test("all admin/internal branches carry an auth or signature guard", () => {
    const guards = [
      "requireAdmin(request)",
      "requireSession(request)",
      "verifyInternalSqlConsoleAccess",
      "verifyInternalAdminSecondFactor",
      "verifyMailjetWebhookSignature",
      "verifyIntelligenceWebhook(request)",
      "webhooksHandlers.handlePaystackWebhook",
      "webhooksHandlers.handleMailjetWebhook",
      "webhooksHandlers.handleIntelligenceWebhook",
      "walletHandlers.handleUserWallet",
      "walletHandlers.handleUserWalletTopUps",
      "walletHandlers.handleAdminWallet",
      "walletHandlers.handleAdminWalletAdjustments",
      "supportChatHandlers.handleUserSupportChat",
      "billingHandlers.handleSubscriptionVerify",
      "billingHandlers.handleAgreementRequirement",
      "billingHandlers.handleBillingCollectionsRun",
      "billingHandlers.handleAdminInvoices",
      "billingHandlers.handleAdminManualInvoices",
      "billingHandlers.handleAdminSubscriptions",
      "affiliateHandlers.handleUserAffiliate",
      "affiliateHandlers.handleAdminAffiliates",
      "adminHandlers.handleAdminRoot",
      "domainsHandlers.handleUserDomainOrders",
      "domainsHandlers.handleUserDomainsDns",
      "domainsHandlers.handleUserDomainsInfo",
      "domainsHandlers.handleUserDomains",
      "domainsHandlers.handleAdminAssignDomain",
      "intelligenceHandlers.handleUserIntelligence",
      "intelligenceHandlers.handleAdminIntelligence",
      "websiteHandlers.handleUserWebsiteOnboarding",
      "websiteHandlers.handleUserWebsites",
      "websiteHandlers.handleAdminWebsiteRuntimeServers",
      "websiteHandlers.handleAdminWebsiteProjects",
      "websiteHandlers.handleAdminWebsites",
      "agentsRuntimeHandlers.handleAgentEnroll",
      "agentsRuntimeHandlers.handleAgentConfig",
      "agentsRuntimeHandlers.handleAgentHeartbeat",
      "agentsRuntimeHandlers.handleAgentSnapshot",
      "createAdminHandlers",
      "internalToolsHandlers.handleSqlConsole",
      "internalToolsHandlers.handleSendReminder",
      "auth.api.getSession({ headers: request.headers })",
      "isAdmin(session)",
    ];

    const protectedRoutes = routeGuardChecks();
    const failures = protectedRoutes.filter(
      ({ snippet }) => !guards.some((guard) => snippet.includes(guard)),
    );

    if (failures.length) {
      console.error(JSON.stringify(failures.slice(0, 5), null, 2));
    }
    expect(failures).toEqual([]);
  });

  test("domain availability is routed through the rate-limited public namespace", () => {
    expect(serverSource).toContain('url.pathname === "/api/public/domains/check"');
    expect(serverSource).toContain("webhooksHandlers.handleDomainsCheck(request)");
    expect(webhookSource).toContain('request.method !== "GET"');
    expect(webhookSource).toContain("parts.every(validLabel)");
    expect(webhookSource).toContain("encodeURIComponent(apiKey)");
    expect(webhookSource).toContain("toPublicDomainAvailability(data, domain, sld, tld)");
    expect(webhookSource).not.toContain("JSON.stringify(data)");
  });

  test("sql console and reminder routes are explicitly hardened", () => {
    const sqlIndex = serverLines.findIndex((line) => line.includes('"/api/internal/admin/sql"'));
    const reminderIndex = serverLines.findIndex((line) =>
      line.includes('"/api/internal/admin/send-reminder"'),
    );

    expect(sqlIndex).toBeGreaterThanOrEqual(0);
    expect(reminderIndex).toBeGreaterThanOrEqual(0);

    expect(snippetFrom(sqlIndex).includes("requireAdmin(request)")).toBe(true);
    expect(snippetFrom(reminderIndex).includes("requireAdmin(request)")).toBe(true);
    expect(internalToolsSource.includes("verifyInternalSqlConsoleAccess")).toBe(true);
    expect(internalToolsSource.includes("verifyInternalAdminSecondFactor")).toBe(true);
    expect(internalToolsSource.includes("recordInternalToolAudit")).toBe(true);
    expect(billingSource.includes("requireSession(request)")).toBe(true);
    expect(billingSource.includes("requireAdmin(request)")).toBe(true);
    expect(agentsRuntimeSource.includes("requireAdmin(request)")).toBe(true);
    expect(agentsRuntimeSource.includes("x-cm-signature")).toBe(true);
  });

  test("admin routes are delegated and the admin module keeps explicit auth and safety checks", () => {
    expect(serverSource.includes("adminHandlers.handleAdminRoot(request)")).toBe(true);
    expect(
      serverSource.includes(
        "getSupportCrmContext: (userId) => getSupportCrmContext({ db }, userId)",
      ),
    ).toBe(true);
    expect(
      serverSource.includes("const body = await parseBody(request, adminUserUpdateSchema)"),
    ).toBe(false);
    expect(serverSource.includes("const body = await parseBody(request, roleUpdateSchema)")).toBe(
      false,
    );
    expect(
      serverSource.includes("const body = await parseBody(request, proposalCreateSchema)"),
    ).toBe(false);
    expect(serverSource.includes("const adminUserUpdateSchema = z.object")).toBe(false);
    expect(serverSource.includes("const roleUpdateSchema = z.object")).toBe(false);
    expect(serverSource.includes("const adminChatSchema = z.object")).toBe(false);
    expect(serverSource.includes("const settingsSchema = z.object")).toBe(false);
    expect(serverSource.includes("const proposalCreateSchema = z.object")).toBe(false);

    expect(adminSource.includes("requireAdmin(request)")).toBe(true);
    expect(adminSource.includes("ticketUpdateSchema")).toBe(true);
    expect(adminSource.includes("serverN8nSchema")).toBe(true);
    expect(adminSource.includes("microsoft365RedirectUri")).toBe(true);
    expect(adminSource.includes("microsoft365ClientConfig")).toBe(true);
    expect(adminSource.includes("microsoft365Scopes")).toBe(true);
    expect(adminSource.includes("createAdminHandlers")).toBe(true);
    expect(adminSource.includes("handleAdminRoot")).toBe(true);
  });

  test("payment and mail webhooks are signature gated", () => {
    expect(webhookSource.includes("x-paystack-signature")).toBe(true);
    expect(webhookSource.includes("verifyMailjetWebhookSignature")).toBe(true);
    expect(webhookSource.includes("deps.verifyIntelligenceWebhook(request)")).toBe(true);
    expect(webhookSource.includes("processPaystackTopUpWebhook")).toBe(true);
  });

  test("billing routes stay guarded in the billing module", () => {
    expect(billingSource.includes("verifyPayment(targetInvoice.paystackReference)")).toBe(true);
    expect(billingSource.includes("BILLING_COLLECTIONS_SECRET")).toBe(true);
    expect(billingSource.includes("agreementRequirementForProduct")).toBe(true);
  });

  test("affiliate routes are delegated and the module keeps fraud, payout, and commission checks", () => {
    expect(serverSource.includes("affiliateHandlers.handlePublicAffiliateClick(request)")).toBe(
      true,
    );
    expect(
      serverSource.includes("affiliateHandlers.handlePublicAffiliateApplication(request)"),
    ).toBe(true);
    expect(serverSource.includes("affiliateHandlers.handleUserAffiliate(request)")).toBe(true);
    expect(serverSource.includes("affiliateHandlers.handleAdminAffiliates(request)")).toBe(true);

    expect(
      serverSource.includes("const body = await parseBody(request, affiliateClickSchema)"),
    ).toBe(false);
    expect(
      serverSource.includes("const body = await parseBody(request, affiliateApplicationSchema)"),
    ).toBe(false);
    expect(
      serverSource.includes("const body = await parseBody(request, affiliateProfileSchema)"),
    ).toBe(false);

    expect(affiliatesSource.includes("affiliate.referral.attributed")).toBe(true);
    expect(affiliatesSource.includes("affiliate.commission.created")).toBe(true);
    expect(affiliatesSource.includes("affiliate.payout.paid")).toBe(true);
    expect(affiliatesSource.includes("affiliate.referral.manual_attribution")).toBe(true);
    expect(affiliatesSource.includes("Select payable commissions for one affiliate")).toBe(true);
    expect(affiliatesSource.includes("requireSession(request)")).toBe(true);
    expect(affiliatesSource.includes("requireAdmin(request)")).toBe(true);
  });

  test("domain routes are delegated and the module keeps registration and ownership guards", () => {
    expect(serverSource.includes("domainsHandlers.handleUserDomainOrders(request)")).toBe(true);
    expect(serverSource.includes("domainsHandlers.handleUserDomainsDns(request)")).toBe(true);
    expect(serverSource.includes("domainsHandlers.handleUserDomainsInfo(request)")).toBe(true);
    expect(serverSource.includes("domainsHandlers.handleUserDomains(request)")).toBe(true);
    expect(serverSource.includes("adminHandlers.handleAdminRoot(request)")).toBe(true);

    expect(serverSource.includes("const body = await parseBody(request, domainOrderSchema)")).toBe(
      false,
    );
    expect(
      serverSource.includes(
        "const body = await request.json();\n      const expiryDate = parseProviderDate(body.expiryDate)",
      ),
    ).toBe(false);

    expect(domainsSource.includes("Domains API registration endpoint is not configured")).toBe(
      true,
    );
    expect(domainsSource.includes("Domain checkout requires a payable price")).toBe(true);
    expect(domainsSource.includes("Domain registration follow-up created for")).toBe(true);
    expect(domainsSource.includes("Forbidden")).toBe(true);
  });

  test("intelligence routes are delegated and the module keeps explicit update validation", () => {
    expect(serverSource.includes("intelligenceHandlers.handleUserIntelligence(request)")).toBe(
      true,
    );
    expect(serverSource.includes("intelligenceHandlers.handleAdminIntelligence(request)")).toBe(
      true,
    );
    expect(intelligenceSource.includes("buildIntelligenceProjectUpdateSchema")).toBe(true);
    expect(
      intelligenceSource.includes("Complete the required intelligence fields before submitting"),
    ).toBe(true);
    expect(intelligenceSource.includes("Only admins can run Competitor Intelligence reports")).toBe(
      true,
    );
  });

  test("wallet routes are delegated and the module keeps reservation and top-up idempotency checks", () => {
    expect(serverSource.includes("walletHandlers.handleUserWallet(request)")).toBe(true);
    expect(serverSource.includes("walletHandlers.handleUserWalletTopUps(request)")).toBe(true);
    expect(serverSource.includes("walletHandlers.handleAdminWallet(request)")).toBe(true);
    expect(serverSource.includes("walletHandlers.handleAdminWalletAdjustments(request)")).toBe(
      true,
    );
    expect(serverSource.includes("webhooksHandlers.handlePaystackWebhook(request)")).toBe(true);

    expect(walletSource.includes("requireSession(request)")).toBe(true);
    expect(walletSource.includes("requireAdmin(request)")).toBe(true);
    expect(walletSource.includes("processPaystackTopUpWebhook")).toBe(true);
    expect(walletMigrationSource.includes("token_wallet_reservation_wallet_request_unique")).toBe(
      true,
    );
    expect(walletMigrationSource.includes("token_topup_intent_paystack_reference_unique")).toBe(
      true,
    );
    expect(walletMigrationSource.includes("token_wallet_ledger_idempotency_unique")).toBe(true);
    expect(walletMigrationSource.includes("token_wallet_user_id_unique")).toBe(true);
  });

  test("support chat routes are delegated and the module keeps upload handling without wallet gating", () => {
    expect(serverSource.includes("supportChatHandlers.handleUserSupportChat(request)")).toBe(true);
    expect(serverSource.includes("const body = await parseBody(request, supportChatSchema)")).toBe(
      false,
    );
    expect(serverSource.includes("const supportChatSchema = z.object")).toBe(false);
    expect(supportChatSource.includes("createSupportChatHandlers")).toBe(true);
    expect(supportChatSource.includes("reserveSupportChatTokens")).toBe(false);
    expect(supportChatSource.includes("supportChatWalletErrorMessage")).toBe(false);
    expect(supportChatSource.includes("insufficient_tokens")).toBe(false);
    expect(supportChatSource.includes("Message or attachment is required")).toBe(true);
  });

  test("agent runtime routes are delegated from server.ts and no inline handlers remain", () => {
    const enrollIndex = serverLines.findIndex((line) =>
      line.includes("agentsRuntimeHandlers.handleAgentEnroll"),
    );
    const configIndex = serverLines.findIndex((line) =>
      line.includes("agentsRuntimeHandlers.handleAgentConfig"),
    );
    const heartbeatIndex = serverLines.findIndex((line) =>
      line.includes("agentsRuntimeHandlers.handleAgentHeartbeat"),
    );
    const snapshotIndex = serverLines.findIndex((line) =>
      line.includes("agentsRuntimeHandlers.handleAgentSnapshot"),
    );

    expect(enrollIndex).toBeGreaterThanOrEqual(0);
    expect(configIndex).toBeGreaterThanOrEqual(0);
    expect(heartbeatIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotIndex).toBeGreaterThanOrEqual(0);

    expect(serverSource.includes("const body = await parseBody(request, agentEnrollSchema)")).toBe(
      false,
    );
    expect(
      serverSource.includes("const body = await parseBody(request, agentEnrollmentRequestSchema)"),
    ).toBe(false);
    expect(serverSource.includes("readSignedAgentRequest(request, url)")).toBe(false);
    expect(serverSource.includes("getAgentConfig()")).toBe(false);

    expect(agentsRuntimeSource.includes("Missing agent signature headers")).toBe(true);
    expect(agentsRuntimeSource.includes("Stale agent signature")).toBe(true);
    expect(agentsRuntimeSource.includes("Invalid agent signature")).toBe(true);
    expect(agentsRuntimeSource.includes("Invalid enrollment token")).toBe(true);
    expect(
      agentsRuntimeSource.includes("CloudMonkey VPS server is not assigned in CloudMonkey"),
    ).toBe(true);
  });

  test("website routes are delegated from server.ts and no inline bodies remain", () => {
    expect(serverSource.includes("websiteHandlers.handleUserWebsiteOnboarding(request)")).toBe(
      true,
    );
    expect(serverSource.includes("websiteHandlers.handleUserWebsites(request)")).toBe(true);
    expect(serverSource.includes("websiteHandlers.handleAdminWebsiteRuntimeServers(request)")).toBe(
      true,
    );
    expect(serverSource.includes("websiteHandlers.handleAdminWebsiteProjects(request)")).toBe(true);
    expect(serverSource.includes("websiteHandlers.handleAdminWebsites(request)")).toBe(true);

    expect(
      serverSource.includes("const body = await parseBody(request, userWebsiteCreateSchema)"),
    ).toBe(false);
    expect(
      serverSource.includes(
        "const body = await parseBody(request, adminWebsiteProjectCreateSchema)",
      ),
    ).toBe(false);
    expect(
      serverSource.includes("const body = await parseBody(request, adminDesignOptionSchema)"),
    ).toBe(false);
    expect(
      serverSource.includes(
        "const body = await parseBody(request, adminWebsiteDesignInputsSchema)",
      ),
    ).toBe(false);
    expect(
      serverSource.includes("const body = await parseBody(request, runtimeServerSchema)"),
    ).toBe(false);
    expect(serverSource.includes("const body = await parseBody(request, websiteSchema)")).toBe(
      false,
    );
  });
});
