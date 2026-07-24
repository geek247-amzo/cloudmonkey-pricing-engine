CREATE TABLE IF NOT EXISTS "microsoft365_tenant" (
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

CREATE TABLE IF NOT EXISTS "microsoft365_tenant_scan" (
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

DO $$ BEGIN
 ALTER TABLE "microsoft365_tenant" ADD CONSTRAINT "microsoft365_tenant_connectedByUserId_user_id_fk" FOREIGN KEY ("connectedByUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "microsoft365_tenant_scan" ADD CONSTRAINT "microsoft365_tenant_scan_tenantId_microsoft365_tenant_tenantId_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."microsoft365_tenant"("tenantId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
