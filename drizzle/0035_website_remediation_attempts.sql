CREATE TABLE IF NOT EXISTS "remediation_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "websiteId" text NOT NULL,
  "healthCheckId" text NOT NULL,
  "action" text NOT NULL,
  "requestedAt" timestamp DEFAULT now() NOT NULL,
  "result" text NOT NULL,
  "resultDetail" text,
  CONSTRAINT "remediation_attempt_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "website"("id") ON DELETE cascade,
  CONSTRAINT "remediation_attempt_health_check_id_fk" FOREIGN KEY ("healthCheckId") REFERENCES "website_health_check"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "remediation_attempt_website_requested_idx" ON "remediation_attempt" ("websiteId", "requestedAt");
