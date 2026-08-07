CREATE TABLE IF NOT EXISTS "service_incident" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "body" text NOT NULL,
  "severity" text DEFAULT 'minor' NOT NULL,
  "status" text DEFAULT 'investigating' NOT NULL,
  "affectedServices" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "audience" jsonb DEFAULT '{"groups":["all"],"userIds":[]}'::jsonb NOT NULL,
  "createdByUserId" text,
  "publishedAt" timestamp,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_incident_created_by_fk" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "service_incident_update" (
  "id" text PRIMARY KEY NOT NULL,
  "incidentId" text NOT NULL,
  "status" text NOT NULL,
  "body" text NOT NULL,
  "createdByUserId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_incident_update_incident_fk" FOREIGN KEY ("incidentId") REFERENCES "service_incident"("id") ON DELETE CASCADE,
  CONSTRAINT "service_incident_update_created_by_fk" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "service_incident_status_updated_idx" ON "service_incident" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "service_incident_update_incident_created_idx" ON "service_incident_update" ("incidentId", "createdAt");
