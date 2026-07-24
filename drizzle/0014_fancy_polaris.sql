CREATE TABLE "admin_chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"userId" text,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_chat_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"summary" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"fullName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"companyName" text,
	"website" text,
	"socialLinks" text,
	"affiliateType" text DEFAULT 'individual' NOT NULL,
	"expectedReferralMethod" text,
	"tier" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referralCode" text NOT NULL,
	"commissionType" text DEFAULT 'once_off' NOT NULL,
	"commissionRateBps" integer DEFAULT 1000 NOT NULL,
	"recurringDurationMonths" integer DEFAULT 1 NOT NULL,
	"payoutMethod" text DEFAULT 'manual_eft' NOT NULL,
	"payoutDetails" text,
	"termsAcceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"approvedAt" timestamp,
	"rejectedAt" timestamp,
	"suspendedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "affiliate_email_unique" UNIQUE("email"),
	CONSTRAINT "affiliate_referralCode_unique" UNIQUE("referralCode")
);
--> statement-breakpoint
CREATE TABLE "affiliate_commission" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"referralId" text,
	"customerId" text NOT NULL,
	"paymentId" text,
	"invoiceId" text,
	"subscriptionId" text,
	"commissionType" text NOT NULL,
	"commissionRateBps" integer NOT NULL,
	"commissionAmount" integer NOT NULL,
	"commissionMonthNumber" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"holdUntilDate" timestamp NOT NULL,
	"approvedAt" timestamp,
	"payableAt" timestamp,
	"paidAt" timestamp,
	"cancelledAt" timestamp,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_fraud_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text,
	"referralId" text,
	"customerId" text,
	"flagType" text NOT NULL,
	"severity" text DEFAULT 'review' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detail" text NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"payoutPeriodStart" timestamp NOT NULL,
	"payoutPeriodEnd" timestamp NOT NULL,
	"totalAmount" integer NOT NULL,
	"payoutMethod" text DEFAULT 'manual_eft' NOT NULL,
	"payoutReference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"adminId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referral" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"referralCode" text NOT NULL,
	"visitorId" text,
	"leadId" text,
	"customerId" text,
	"sourceUrl" text,
	"landingPage" text,
	"ipAddress" text,
	"userAgent" text,
	"attributionType" text DEFAULT 'link' NOT NULL,
	"attributionModel" text DEFAULT 'last_click' NOT NULL,
	"status" text DEFAULT 'clicked' NOT NULL,
	"tierAtSignup" text,
	"commissionTypeAtSignup" text,
	"commissionRateBpsAtSignup" integer,
	"recurringDurationMonthsAtSignup" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"clickedAt" timestamp DEFAULT now() NOT NULL,
	"signedUpAt" timestamp,
	"convertedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "agreement_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"documentType" text DEFAULT 'sla' NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"contentHash" text NOT NULL,
	"effectiveFrom" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_template_sku" (
	"id" text PRIMARY KEY NOT NULL,
	"templateId" text NOT NULL,
	"productType" text NOT NULL,
	"productId" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_ai_runtime" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"runtime" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"version" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"health" text,
	"ports" text,
	"raw" text,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"domainName" text NOT NULL,
	"domainPlanId" text,
	"addonPlanIds" text,
	"invoiceId" text,
	"subscriptionId" text,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"providerResponse" text,
	"providerError" text,
	"registeredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_competitor" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"websiteUrl" text NOT NULL,
	"competitorType" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"visibilityScore" integer DEFAULT 0 NOT NULL,
	"technicalSeoScore" integer DEFAULT 0 NOT NULL,
	"contentSeoScore" integer DEFAULT 0 NOT NULL,
	"localSeoScore" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_content_gap" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"competitorId" text,
	"userId" text NOT NULL,
	"gapType" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"opportunity" text DEFAULT 'medium' NOT NULL,
	"sourceUrl" text,
	"suggestedAction" text,
	"status" text DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_crawl_page" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"jobId" text,
	"competitorId" text,
	"userId" text NOT NULL,
	"url" text NOT NULL,
	"target" text DEFAULT 'primary' NOT NULL,
	"httpStatus" integer,
	"title" text,
	"metaDescription" text,
	"h1" text,
	"h2Count" integer DEFAULT 0 NOT NULL,
	"wordCount" integer DEFAULT 0 NOT NULL,
	"internalLinkCount" integer DEFAULT 0 NOT NULL,
	"externalLinkCount" integer DEFAULT 0 NOT NULL,
	"imageMissingAltCount" integer DEFAULT 0 NOT NULL,
	"hasCanonical" boolean DEFAULT false NOT NULL,
	"hasSchema" boolean DEFAULT false NOT NULL,
	"loadTimeMs" integer,
	"screenshotUrl" text,
	"raw" text,
	"observedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'configured' NOT NULL,
	"config" text,
	"lastSyncAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_job" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"jobType" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'n8n' NOT NULL,
	"externalRunId" text,
	"error" text,
	"input" text,
	"output" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_keyword" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"keyword" text NOT NULL,
	"location" text,
	"device" text DEFAULT 'desktop' NOT NULL,
	"intent" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_keyword_ranking" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"keywordId" text,
	"competitorId" text,
	"userId" text NOT NULL,
	"keyword" text NOT NULL,
	"target" text DEFAULT 'primary' NOT NULL,
	"rank" integer,
	"previousRank" integer,
	"bestRank" integer,
	"searchVolume" integer,
	"difficulty" integer,
	"opportunity" text,
	"serpFeatures" text,
	"raw" text,
	"observedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_page_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"auditId" text,
	"crawlPageId" text,
	"userId" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"recommendation" text,
	"sourceUrl" text,
	"status" text DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_project" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"businessName" text NOT NULL,
	"websiteUrl" text NOT NULL,
	"location" text,
	"industry" text,
	"servicesProducts" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"lastScanStatus" text,
	"lastScanAt" timestamp,
	"nextScanAt" timestamp,
	"visibilityScore" integer DEFAULT 0 NOT NULL,
	"technicalSeoScore" integer DEFAULT 0 NOT NULL,
	"contentSeoScore" integer DEFAULT 0 NOT NULL,
	"contentGapScore" integer DEFAULT 0 NOT NULL,
	"localSeoScore" integer DEFAULT 0 NOT NULL,
	"performanceScore" integer DEFAULT 0 NOT NULL,
	"aiReadinessScore" integer DEFAULT 0 NOT NULL,
	"opportunityScore" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'seo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"effort" text DEFAULT 'medium' NOT NULL,
	"sourceType" text,
	"sourceId" text,
	"status" text DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_report" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"jobId" text,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"executiveSummary" text,
	"insightPacket" text,
	"reportJson" text,
	"pdfUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_scheduled_report" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"nextRunAt" timestamp,
	"lastRunAt" timestamp,
	"recipients" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_seo_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"jobId" text,
	"userId" text NOT NULL,
	"target" text DEFAULT 'primary' NOT NULL,
	"targetUrl" text NOT NULL,
	"technicalScore" integer DEFAULT 0 NOT NULL,
	"contentScore" integer DEFAULT 0 NOT NULL,
	"localScore" integer DEFAULT 0 NOT NULL,
	"performanceScore" integer DEFAULT 0 NOT NULL,
	"aiReadinessScore" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"raw" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_serp_result" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"keywordId" text,
	"userId" text NOT NULL,
	"keyword" text NOT NULL,
	"location" text,
	"device" text,
	"resultUrl" text,
	"resultTitle" text,
	"domain" text,
	"rank" integer,
	"resultType" text DEFAULT 'organic' NOT NULL,
	"hasAds" boolean DEFAULT false NOT NULL,
	"hasMapPack" boolean DEFAULT false NOT NULL,
	"hasAiOverview" boolean DEFAULT false NOT NULL,
	"raw" text,
	"observedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"userId" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'eft' NOT NULL,
	"reference" text,
	"notes" text,
	"capturedByUserId" text,
	"paidAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "microsoft365_tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text NOT NULL,
	"displayName" text,
	"defaultDomain" text,
	"connectedAccountEmail" text,
	"connectedByUserId" text,
	"scopes" text NOT NULL,
	"refreshTokenSecret" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"userCount" integer,
	"secureScoreCurrent" text,
	"secureScoreMax" text,
	"secureScorePercent" integer,
	"serviceHealthStatus" text,
	"serviceIssueCount" integer DEFAULT 0 NOT NULL,
	"lastSyncAt" timestamp,
	"lastError" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "microsoft365_tenant_tenantId_unique" UNIQUE("tenantId")
);
--> statement-breakpoint
CREATE TABLE "microsoft365_tenant_scan" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" text,
	"secureScorePercent" integer,
	"serviceHealthStatus" text,
	"serviceIssueCount" integer DEFAULT 0 NOT NULL,
	"error" text,
	"startedAt" timestamp NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "onboarding_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subscriptionId" text NOT NULL,
	"productType" text NOT NULL,
	"productId" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"answers" text NOT NULL,
	"n8nResponse" text,
	"submittedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text,
	"customerUserId" text,
	"invoiceId" text,
	"proposalNumber" text,
	"publicToken" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerCompany" text,
	"introduction" text,
	"executiveSummary" text,
	"terms" text,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"setupTotal" integer DEFAULT 0 NOT NULL,
	"recurringTotal" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp,
	"sentAt" timestamp,
	"approvedAt" timestamp,
	"convertedAt" timestamp,
	"approvalIp" text,
	"approvalUserAgent" text,
	"createdByUserId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_publicToken_unique" UNIQUE("publicToken")
);
--> statement-breakpoint
CREATE TABLE "proposal_item" (
	"id" text PRIMARY KEY NOT NULL,
	"proposalId" text NOT NULL,
	"productType" text DEFAULT 'plan' NOT NULL,
	"productId" text,
	"planId" text,
	"bundleId" text,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer DEFAULT 0 NOT NULL,
	"setupPrice" integer DEFAULT 0 NOT NULL,
	"recurring" boolean DEFAULT true NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"serviceDefinition" text,
	"features" text,
	"lineTotal" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text,
	"version" text,
	"hostname" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"enrollmentTokenHash" text,
	"secretHash" text,
	"enrolledAt" timestamp,
	"lastSeenAt" timestamp,
	"lastIp" text,
	"config" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_container" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"containerId" text NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"status" text NOT NULL,
	"health" text,
	"ports" text,
	"labels" text,
	"isPrivileged" boolean DEFAULT false NOT NULL,
	"restartCount" integer DEFAULT 0 NOT NULL,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_database" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"engine" text NOT NULL,
	"version" text,
	"source" text DEFAULT 'container' NOT NULL,
	"containerName" text,
	"port" integer,
	"status" text DEFAULT 'unknown' NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"hasPersistentVolume" boolean DEFAULT false NOT NULL,
	"raw" text,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_n8n_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"baseUrl" text NOT NULL,
	"apiKeySecret" text NOT NULL,
	"status" text DEFAULT 'configured' NOT NULL,
	"lastSyncAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_n8n_workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"integrationId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"workflowId" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"triggerSummary" text,
	"workflowUpdatedAt" timestamp,
	"raw" text,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_security_finding" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detail" text,
	"evidence" text,
	"observedAt" timestamp NOT NULL,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_telemetry_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"hostname" text,
	"osName" text,
	"kernel" text,
	"uptimeSeconds" integer,
	"cpuUsagePercent" integer,
	"memoryUsedMb" integer,
	"memoryTotalMb" integer,
	"diskUsedGb" integer,
	"diskTotalGb" integer,
	"securityScore" integer,
	"securitySummary" text,
	"raw" text NOT NULL,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_website" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"httpStatus" integer,
	"redirectUrl" text,
	"sslStatus" text,
	"sslIssuer" text,
	"sslExpiresAt" timestamp,
	"sslHostnameMatches" boolean,
	"appType" text,
	"source" text,
	"raw" text,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signed_agreement" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subscriptionId" text,
	"templateId" text NOT NULL,
	"templateVersion" text NOT NULL,
	"productType" text NOT NULL,
	"productId" text NOT NULL,
	"documentHash" text NOT NULL,
	"consentText" text NOT NULL,
	"documentSnapshot" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"signedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"marketingOptIn" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_inventory_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"productVariantId" text,
	"type" text NOT NULL,
	"quantityDelta" integer NOT NULL,
	"reason" text,
	"referenceType" text,
	"referenceId" text,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_order" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"customerId" text,
	"orderNumber" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paymentStatus" text DEFAULT 'pending' NOT NULL,
	"fulfillmentStatus" text DEFAULT 'unfulfilled' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"deliveryFee" integer DEFAULT 0 NOT NULL,
	"discountTotal" integer DEFAULT 0 NOT NULL,
	"taxTotal" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"source" text DEFAULT 'online' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text,
	"variantId" text,
	"title" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"orderId" text,
	"provider" text DEFAULT 'cloudmonkey-paystack' NOT NULL,
	"providerReference" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"feeCloudmonkey" integer DEFAULT 0 NOT NULL,
	"feeProvider" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rawProviderStatus" text,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sku" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"compareAtPrice" integer,
	"costPrice" integer,
	"taxable" boolean DEFAULT true NOT NULL,
	"trackInventory" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"storeId" text NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"options" text,
	"price" integer DEFAULT 0 NOT NULL,
	"inventoryQuantity" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"weight" text,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_chat_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"messageId" text,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"mimeType" text NOT NULL,
	"fileName" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"storagePath" text NOT NULL,
	"transcript" text,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"userId" text,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_chat_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"ticketId" text,
	"status" text DEFAULT 'open' NOT NULL,
	"summary" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_knowledge_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceId" text NOT NULL,
	"userId" text,
	"chunkText" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"tokenEstimate" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 70 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_knowledge_source" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"sourceType" text NOT NULL,
	"title" text NOT NULL,
	"visibility" text DEFAULT 'customer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_learning_event" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"sessionId" text,
	"ticketId" text,
	"sourceId" text,
	"eventType" text NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'stored' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_approval_token" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"actionType" text NOT NULL,
	"targetId" text,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_approval_token_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "website_design_option" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"styleLabel" text NOT NULL,
	"imageUrl" text,
	"thumbnailUrl" text,
	"designManifest" text,
	"promptVersion" text,
	"tokenCost" integer DEFAULT 0 NOT NULL,
	"imageCost" integer DEFAULT 0 NOT NULL,
	"selectedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"domain" text NOT NULL,
	"type" text DEFAULT 'temporary' NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"dnsTarget" text,
	"sslStatus" text DEFAULT 'pending' NOT NULL,
	"isPrimary" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"verifiedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "website_plugin_install" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"storeId" text,
	"userId" text NOT NULL,
	"pluginKey" text NOT NULL,
	"status" text DEFAULT 'installed' NOT NULL,
	"config" text,
	"installedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_review_request" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"targetId" text,
	"message" text,
	"response" text,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	"respondedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_runtime_server" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'vultr' NOT NULL,
	"providerInstanceId" text,
	"profileName" text DEFAULT 'geek247-compatible-docker-host' NOT NULL,
	"hostname" text,
	"publicIp" text,
	"privateIp" text,
	"provisionerUrl" text,
	"provisionerSecret" text,
	"ingressHostname" text,
	"ingressIp" text,
	"dockerNetworkName" text DEFAULT 'cm_runtime' NOT NULL,
	"proxyMode" text DEFAULT 'caddy' NOT NULL,
	"lastError" text,
	"region" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"cpuTotal" integer DEFAULT 0 NOT NULL,
	"memoryTotalMb" integer DEFAULT 0 NOT NULL,
	"diskTotalGb" integer DEFAULT 0 NOT NULL,
	"activeSiteCount" integer DEFAULT 0 NOT NULL,
	"maxSiteCount" integer DEFAULT 0 NOT NULL,
	"lastHealthCheckAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_store" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"siteType" text DEFAULT 'website' NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"timezone" text DEFAULT 'Africa/Johannesburg' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"paymentMode" text DEFAULT 'cloudmonkey_gateway' NOT NULL,
	"trialStartedAt" timestamp,
	"trialEndsAt" timestamp,
	"suspendedAt" timestamp,
	"terminationScheduledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_store_database" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"engine" text DEFAULT 'postgresql' NOT NULL,
	"version" text DEFAULT '16-alpine' NOT NULL,
	"host" text,
	"port" integer DEFAULT 5432 NOT NULL,
	"databaseName" text NOT NULL,
	"username" text NOT NULL,
	"passwordSecret" text NOT NULL,
	"connectionSecret" text NOT NULL,
	"containerName" text NOT NULL,
	"volumeName" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"backupStatus" text DEFAULT 'not_configured' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "setupPriceZar" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "billingFrequency" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "minimumTerm" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "minimumTermMonths" integer;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "billingType" text DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "priceLabel" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "isBundle" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "categoryNote" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "serviceNote" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "serviceDefinition" text;--> statement-breakpoint
ALTER TABLE "bundle" ADD COLUMN "agreementTemplateId" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "invoiceNumber" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "invoiceSource" text DEFAULT 'checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "issuedAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "emailedAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "paidAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "billingPeriodStart" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "billingPeriodEnd" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "currency" text DEFAULT 'ZAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "vatRateBps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "customerName" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "customerEmail" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "customerCompany" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "customerAddress" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "customerVatNumber" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "workspaceBillingSnapshot" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "paymentMethod" text DEFAULT 'gateway' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "collectionStatus" text DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "collectionDayCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "firstReminderAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "lastReminderAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "nextReminderAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "suspensionDueAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "planId" text;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "bundleId" text;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "websitePackageType" text;--> statement-breakpoint
ALTER TABLE "service" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_category" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "service_category" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_category" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "setupPriceZar" text;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "billingFrequency" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "minimumTerm" text;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "minimumTermMonths" integer;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "billingType" text DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "priceLabel" text;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "isBundle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "serviceNote" text;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "trialDays" integer;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "serviceDefinition" text;--> statement-breakpoint
ALTER TABLE "service_plan" ADD COLUMN "agreementTemplateId" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "minimumTermMonths" integer;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "minimumTermEndsAt" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "agreementSigned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "agreementSignedAt" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "requiredAgreementTemplateId" text;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "aiSessionId" text;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "lastCustomerMessageAt" timestamp;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "slaDueAt" timestamp;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "resolutionSummary" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vultr_instance" ADD COLUMN "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "vultr_instance" ADD COLUMN "suspensionReason" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "subscriptionId" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "invoiceId" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "siteType" text DEFAULT 'website' NOT NULL;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "businessName" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "businessDescription" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "temporaryDomain" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "primaryDomain" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "onboardingAnswers" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "requirementManifest" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "buildManifest" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "provisioningPlan" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "aiGenerationStatus" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "containerStatus" text DEFAULT 'not_provisioned' NOT NULL;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "runtimeServerId" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "baseRepo" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "selectedDesignOptionId" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "trialStartedAt" timestamp;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "trialEndsAt" timestamp;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "graceEndsAt" timestamp;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "suspensionReason" text;--> statement-breakpoint
ALTER TABLE "website" ADD COLUMN "terminationScheduledAt" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingLegalName" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingEmail" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingPhone" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingWebsite" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingAddress" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingRegistrationNumber" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingVatNumber" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingBankName" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingBankAccountName" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingBankAccountNumber" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingBankBranchCode" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billingInvoiceNotes" text;--> statement-breakpoint
ALTER TABLE "admin_chat_message" ADD CONSTRAINT "admin_chat_message_sessionId_admin_chat_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."admin_chat_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_chat_message" ADD CONSTRAINT "admin_chat_message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_chat_session" ADD CONSTRAINT "admin_chat_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_referralId_affiliate_referral_id_fk" FOREIGN KEY ("referralId") REFERENCES "public"."affiliate_referral"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_referralId_affiliate_referral_id_fk" FOREIGN KEY ("referralId") REFERENCES "public"."affiliate_referral"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_adminId_user_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_template_sku" ADD CONSTRAINT "agreement_template_sku_templateId_agreement_template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."agreement_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_order" ADD CONSTRAINT "domain_order_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_order" ADD CONSTRAINT "domain_order_domainPlanId_service_plan_id_fk" FOREIGN KEY ("domainPlanId") REFERENCES "public"."service_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_order" ADD CONSTRAINT "domain_order_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_order" ADD CONSTRAINT "domain_order_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_competitor" ADD CONSTRAINT "intelligence_competitor_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_competitor" ADD CONSTRAINT "intelligence_competitor_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_content_gap" ADD CONSTRAINT "intelligence_content_gap_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_content_gap" ADD CONSTRAINT "intelligence_content_gap_competitorId_intelligence_competitor_id_fk" FOREIGN KEY ("competitorId") REFERENCES "public"."intelligence_competitor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_content_gap" ADD CONSTRAINT "intelligence_content_gap_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_crawl_page" ADD CONSTRAINT "intelligence_crawl_page_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_crawl_page" ADD CONSTRAINT "intelligence_crawl_page_jobId_intelligence_job_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."intelligence_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_crawl_page" ADD CONSTRAINT "intelligence_crawl_page_competitorId_intelligence_competitor_id_fk" FOREIGN KEY ("competitorId") REFERENCES "public"."intelligence_competitor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_crawl_page" ADD CONSTRAINT "intelligence_crawl_page_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_integration" ADD CONSTRAINT "intelligence_integration_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_integration" ADD CONSTRAINT "intelligence_integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_job" ADD CONSTRAINT "intelligence_job_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_job" ADD CONSTRAINT "intelligence_job_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword" ADD CONSTRAINT "intelligence_keyword_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword" ADD CONSTRAINT "intelligence_keyword_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword_ranking" ADD CONSTRAINT "intelligence_keyword_ranking_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword_ranking" ADD CONSTRAINT "intelligence_keyword_ranking_keywordId_intelligence_keyword_id_fk" FOREIGN KEY ("keywordId") REFERENCES "public"."intelligence_keyword"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword_ranking" ADD CONSTRAINT "intelligence_keyword_ranking_competitorId_intelligence_competitor_id_fk" FOREIGN KEY ("competitorId") REFERENCES "public"."intelligence_competitor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_keyword_ranking" ADD CONSTRAINT "intelligence_keyword_ranking_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_page_issue" ADD CONSTRAINT "intelligence_page_issue_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_page_issue" ADD CONSTRAINT "intelligence_page_issue_auditId_intelligence_seo_audit_id_fk" FOREIGN KEY ("auditId") REFERENCES "public"."intelligence_seo_audit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_page_issue" ADD CONSTRAINT "intelligence_page_issue_crawlPageId_intelligence_crawl_page_id_fk" FOREIGN KEY ("crawlPageId") REFERENCES "public"."intelligence_crawl_page"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_page_issue" ADD CONSTRAINT "intelligence_page_issue_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_project" ADD CONSTRAINT "intelligence_project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_recommendation" ADD CONSTRAINT "intelligence_recommendation_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_recommendation" ADD CONSTRAINT "intelligence_recommendation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_report" ADD CONSTRAINT "intelligence_report_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_report" ADD CONSTRAINT "intelligence_report_jobId_intelligence_job_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."intelligence_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_report" ADD CONSTRAINT "intelligence_report_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_scheduled_report" ADD CONSTRAINT "intelligence_scheduled_report_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_scheduled_report" ADD CONSTRAINT "intelligence_scheduled_report_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_seo_audit" ADD CONSTRAINT "intelligence_seo_audit_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_seo_audit" ADD CONSTRAINT "intelligence_seo_audit_jobId_intelligence_job_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."intelligence_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_seo_audit" ADD CONSTRAINT "intelligence_seo_audit_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_serp_result" ADD CONSTRAINT "intelligence_serp_result_projectId_intelligence_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."intelligence_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_serp_result" ADD CONSTRAINT "intelligence_serp_result_keywordId_intelligence_keyword_id_fk" FOREIGN KEY ("keywordId") REFERENCES "public"."intelligence_keyword"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_serp_result" ADD CONSTRAINT "intelligence_serp_result_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_capturedByUserId_user_id_fk" FOREIGN KEY ("capturedByUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microsoft365_tenant" ADD CONSTRAINT "microsoft365_tenant_connectedByUserId_user_id_fk" FOREIGN KEY ("connectedByUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microsoft365_tenant_scan" ADD CONSTRAINT "microsoft365_tenant_scan_tenantId_microsoft365_tenant_tenantId_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."microsoft365_tenant"("tenantId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submission" ADD CONSTRAINT "onboarding_submission_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_submission" ADD CONSTRAINT "onboarding_submission_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_customerUserId_user_id_fk" FOREIGN KEY ("customerUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_proposalId_proposal_id_fk" FOREIGN KEY ("proposalId") REFERENCES "public"."proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_planId_service_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."service_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_bundleId_bundle_id_fk" FOREIGN KEY ("bundleId") REFERENCES "public"."bundle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_agent" ADD CONSTRAINT "server_agent_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_agent" ADD CONSTRAINT "server_agent_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_container" ADD CONSTRAINT "server_container_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_container" ADD CONSTRAINT "server_container_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_container" ADD CONSTRAINT "server_container_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_database" ADD CONSTRAINT "server_database_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_database" ADD CONSTRAINT "server_database_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_database" ADD CONSTRAINT "server_database_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_n8n_integration" ADD CONSTRAINT "server_n8n_integration_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_n8n_integration" ADD CONSTRAINT "server_n8n_integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_integrationId_server_n8n_integration_id_fk" FOREIGN KEY ("integrationId") REFERENCES "public"."server_n8n_integration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_website" ADD CONSTRAINT "server_website_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_website" ADD CONSTRAINT "server_website_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_website" ADD CONSTRAINT "server_website_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_templateId_agreement_template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."agreement_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_customer" ADD CONSTRAINT "store_customer_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_productVariantId_store_product_variant_id_fk" FOREIGN KEY ("productVariantId") REFERENCES "public"."store_product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order" ADD CONSTRAINT "store_order_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order" ADD CONSTRAINT "store_order_customerId_store_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."store_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_orderId_store_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."store_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_productId_store_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."store_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_variantId_store_product_variant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."store_product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_orderId_store_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."store_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product" ADD CONSTRAINT "store_product_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product" ADD CONSTRAINT "store_product_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_variant" ADD CONSTRAINT "store_product_variant_productId_store_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."store_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_variant" ADD CONSTRAINT "store_product_variant_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_attachment" ADD CONSTRAINT "support_chat_attachment_sessionId_support_chat_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."support_chat_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_attachment" ADD CONSTRAINT "support_chat_attachment_messageId_support_chat_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."support_chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_attachment" ADD CONSTRAINT "support_chat_attachment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_message" ADD CONSTRAINT "support_chat_message_sessionId_support_chat_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."support_chat_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_message" ADD CONSTRAINT "support_chat_message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_session" ADD CONSTRAINT "support_chat_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_session" ADD CONSTRAINT "support_chat_session_ticketId_support_ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_knowledge_chunk" ADD CONSTRAINT "support_knowledge_chunk_sourceId_support_knowledge_source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."support_knowledge_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_knowledge_chunk" ADD CONSTRAINT "support_knowledge_chunk_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_knowledge_source" ADD CONSTRAINT "support_knowledge_source_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_learning_event" ADD CONSTRAINT "support_learning_event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_learning_event" ADD CONSTRAINT "support_learning_event_sessionId_support_chat_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."support_chat_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_learning_event" ADD CONSTRAINT "support_learning_event_ticketId_support_ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_learning_event" ADD CONSTRAINT "support_learning_event_sourceId_support_knowledge_source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."support_knowledge_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_approval_token" ADD CONSTRAINT "website_approval_token_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_approval_token" ADD CONSTRAINT "website_approval_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_design_option" ADD CONSTRAINT "website_design_option_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_design_option" ADD CONSTRAINT "website_design_option_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_domain" ADD CONSTRAINT "website_domain_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_domain" ADD CONSTRAINT "website_domain_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_review_request" ADD CONSTRAINT "website_review_request_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_review_request" ADD CONSTRAINT "website_review_request_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_store" ADD CONSTRAINT "website_store_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_store" ADD CONSTRAINT "website_store_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_planId_service_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."service_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_bundleId_bundle_id_fk" FOREIGN KEY ("bundleId") REFERENCES "public"."bundle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;