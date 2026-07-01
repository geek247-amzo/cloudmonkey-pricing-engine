CREATE TABLE IF NOT EXISTS "server_agent" (
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
CREATE TABLE IF NOT EXISTS "server_telemetry_snapshot" (
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
CREATE TABLE IF NOT EXISTS "server_security_finding" (
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
CREATE TABLE IF NOT EXISTS "server_website" (
	"id" text PRIMARY KEY NOT NULL,
	"agentId" text NOT NULL,
	"instanceId" text NOT NULL,
	"userId" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"httpStatus" integer,
	"sslStatus" text,
	"sslIssuer" text,
	"sslExpiresAt" timestamp,
	"appType" text,
	"source" text,
	"raw" text,
	"observedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_container" (
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
CREATE TABLE IF NOT EXISTS "server_database" (
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
CREATE TABLE IF NOT EXISTS "detected_ai_runtime" (
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
DO $$ BEGIN
	ALTER TABLE "server_agent" ADD CONSTRAINT "server_agent_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_agent" ADD CONSTRAINT "server_agent_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_telemetry_snapshot" ADD CONSTRAINT "server_telemetry_snapshot_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_security_finding" ADD CONSTRAINT "server_security_finding_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_website" ADD CONSTRAINT "server_website_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_website" ADD CONSTRAINT "server_website_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_website" ADD CONSTRAINT "server_website_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_container" ADD CONSTRAINT "server_container_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_container" ADD CONSTRAINT "server_container_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_container" ADD CONSTRAINT "server_container_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_database" ADD CONSTRAINT "server_database_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_database" ADD CONSTRAINT "server_database_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_database" ADD CONSTRAINT "server_database_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_agentId_server_agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."server_agent"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "detected_ai_runtime" ADD CONSTRAINT "detected_ai_runtime_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
