ALTER TABLE "server_website" ADD COLUMN IF NOT EXISTS "redirectUrl" text;
--> statement-breakpoint
ALTER TABLE "server_website" ADD COLUMN IF NOT EXISTS "sslHostnameMatches" boolean;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_n8n_integration" (
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
CREATE TABLE IF NOT EXISTS "server_n8n_workflow" (
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
DO $$ BEGIN
	ALTER TABLE "server_n8n_integration" ADD CONSTRAINT "server_n8n_integration_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_n8n_integration" ADD CONSTRAINT "server_n8n_integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_integrationId_server_n8n_integration_id_fk" FOREIGN KEY ("integrationId") REFERENCES "public"."server_n8n_integration"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_instanceId_vultr_instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "public"."vultr_instance"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "server_n8n_workflow" ADD CONSTRAINT "server_n8n_workflow_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
