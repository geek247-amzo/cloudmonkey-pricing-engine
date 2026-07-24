ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "minimumTermEndsAt" timestamp;

UPDATE "service_plan"
SET "minimumTermMonths" = CASE
  WHEN "minimumTerm" IS NULL OR trim("minimumTerm") = '' THEN NULL
  WHEN lower("minimumTerm") LIKE '%year%' THEN GREATEST(1, COALESCE(NULLIF(regexp_replace("minimumTerm", '\D', '', 'g'), '')::integer, 1) * 12)
  WHEN lower("minimumTerm") LIKE '%monthly%' OR lower("minimumTerm") = 'month' THEN 1
  ELSE GREATEST(1, NULLIF(regexp_replace("minimumTerm", '\D', '', 'g'), '')::integer)
END
WHERE "minimumTermMonths" IS NULL AND "minimumTerm" IS NOT NULL;

UPDATE "bundle"
SET "minimumTermMonths" = CASE
  WHEN "minimumTerm" IS NULL OR trim("minimumTerm") = '' THEN NULL
  WHEN lower("minimumTerm") LIKE '%year%' THEN GREATEST(1, COALESCE(NULLIF(regexp_replace("minimumTerm", '\D', '', 'g'), '')::integer, 1) * 12)
  WHEN lower("minimumTerm") LIKE '%monthly%' OR lower("minimumTerm") = 'month' THEN 1
  ELSE GREATEST(1, NULLIF(regexp_replace("minimumTerm", '\D', '', 'g'), '')::integer)
END
WHERE "minimumTermMonths" IS NULL AND "minimumTerm" IS NOT NULL;

ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "paymentMethod" text DEFAULT 'gateway' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "collectionStatus" text DEFAULT 'current' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "collectionDayCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "firstReminderAt" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "lastReminderAt" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "nextReminderAt" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "suspensionDueAt" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp;

CREATE TABLE IF NOT EXISTS "invoice_payment" (
  "id" text PRIMARY KEY NOT NULL,
  "invoiceId" text NOT NULL REFERENCES "invoice"("id"),
  "userId" text NOT NULL REFERENCES "user"("id"),
  "amount" integer NOT NULL,
  "method" text DEFAULT 'eft' NOT NULL,
  "reference" text,
  "notes" text,
  "capturedByUserId" text REFERENCES "user"("id"),
  "paidAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "vultr_instance" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp;
ALTER TABLE "vultr_instance" ADD COLUMN IF NOT EXISTS "suspensionReason" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "suspensionReason" text;
