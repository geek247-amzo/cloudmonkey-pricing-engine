CREATE TABLE IF NOT EXISTS "website_health_check" (
  "id" text PRIMARY KEY NOT NULL,
  "websiteId" text NOT NULL,
  "checkedAt" timestamp DEFAULT now() NOT NULL,
  "httpStatus" integer,
  "sslDaysRemaining" integer,
  "responseTimeMs" integer,
  "contentCheckPassed" boolean DEFAULT false NOT NULL,
  "issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'down' NOT NULL,
  CONSTRAINT "website_health_check_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "website"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "website_health_check_website_checked_idx" ON "website_health_check" ("websiteId", "checkedAt");
