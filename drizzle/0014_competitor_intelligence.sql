CREATE TABLE IF NOT EXISTS "intelligence_project" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_competitor" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_keyword" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"keyword" text NOT NULL,
	"location" text,
	"device" text DEFAULT 'desktop' NOT NULL,
	"intent" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "intelligence_keyword_ranking" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"keywordId" text REFERENCES "intelligence_keyword"("id"),
	"competitorId" text REFERENCES "intelligence_competitor"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_job" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_crawl_page" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"jobId" text REFERENCES "intelligence_job"("id"),
	"competitorId" text REFERENCES "intelligence_competitor"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_seo_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"jobId" text REFERENCES "intelligence_job"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_page_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"auditId" text REFERENCES "intelligence_seo_audit"("id"),
	"crawlPageId" text REFERENCES "intelligence_crawl_page"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_content_gap" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"competitorId" text REFERENCES "intelligence_competitor"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_serp_result" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"keywordId" text REFERENCES "intelligence_keyword"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
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

CREATE TABLE IF NOT EXISTS "intelligence_report" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"jobId" text REFERENCES "intelligence_job"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"executiveSummary" text,
	"insightPacket" text,
	"reportJson" text,
	"pdfUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "intelligence_scheduled_report" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"nextRunAt" timestamp,
	"lastRunAt" timestamp,
	"recipients" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "intelligence_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL REFERENCES "intelligence_project"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"provider" text NOT NULL,
	"status" text DEFAULT 'configured' NOT NULL,
	"config" text,
	"lastSyncAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_intelligence_project_user" ON "intelligence_project" ("userId");
CREATE INDEX IF NOT EXISTS "idx_intelligence_project_status" ON "intelligence_project" ("status");
CREATE INDEX IF NOT EXISTS "idx_intelligence_competitor_project" ON "intelligence_competitor" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_intelligence_keyword_project" ON "intelligence_keyword" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_intelligence_ranking_project_observed" ON "intelligence_keyword_ranking" ("projectId", "observedAt");
CREATE INDEX IF NOT EXISTS "idx_intelligence_job_project_status" ON "intelligence_job" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "idx_intelligence_crawl_project_observed" ON "intelligence_crawl_page" ("projectId", "observedAt");
CREATE INDEX IF NOT EXISTS "idx_intelligence_issue_project_status" ON "intelligence_page_issue" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "idx_intelligence_gap_project_status" ON "intelligence_content_gap" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "idx_intelligence_serp_project_observed" ON "intelligence_serp_result" ("projectId", "observedAt");
CREATE INDEX IF NOT EXISTS "idx_intelligence_recommendation_project_status" ON "intelligence_recommendation" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "idx_intelligence_report_project_created" ON "intelligence_report" ("projectId", "createdAt");
