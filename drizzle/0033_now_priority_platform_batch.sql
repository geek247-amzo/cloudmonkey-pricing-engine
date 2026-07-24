ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "captureSource" text;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "consentAt" timestamp;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "scanFingerprint" text;

CREATE TABLE IF NOT EXISTS "secure_handout_link" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "tokenHash" text NOT NULL UNIQUE,
  "payloadSecret" text NOT NULL,
  "recipientEmail" text,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "revokedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'public';

ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "direction" text NOT NULL DEFAULT 'view';
ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "ticketId" text REFERENCES "support_ticket"("id");
ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "submittedAt" timestamp;
ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "submissionStoragePath" text;
ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "submissionFileName" text;
ALTER TABLE "secure_handout_link" ADD COLUMN IF NOT EXISTS "submissionMimeType" text;

ALTER TABLE "vultr_instance" ADD COLUMN IF NOT EXISTS "hostingMode" text NOT NULL DEFAULT 'private';
