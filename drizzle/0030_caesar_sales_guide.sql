ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "userId" text REFERENCES "user"("id");
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "businessNeed" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "budgetRange" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "timeline" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'website';
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'new';
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "qualification" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "caesar_chat_session" (
  "id" text PRIMARY KEY NOT NULL,
  "visitorTokenHash" text NOT NULL,
  "userId" text REFERENCES "user"("id"),
  "leadId" text REFERENCES "lead"("id"),
  "status" text NOT NULL DEFAULT 'open',
  "intent" text,
  "stage" text NOT NULL DEFAULT 'discover',
  "qualification" text,
  "summary" text,
  "messageCount" integer NOT NULL DEFAULT 0,
  "lastIpHash" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "caesar_chat_message" (
  "id" text PRIMARY KEY NOT NULL,
  "sessionId" text NOT NULL REFERENCES "caesar_chat_session"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "body" text NOT NULL,
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "caesar_chat_session_user_idx" ON "caesar_chat_session" ("userId");
CREATE INDEX IF NOT EXISTS "caesar_chat_session_lead_idx" ON "caesar_chat_session" ("leadId");
CREATE INDEX IF NOT EXISTS "caesar_chat_message_session_idx" ON "caesar_chat_message" ("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "lead_source_status_idx" ON "lead" ("source", "status");
