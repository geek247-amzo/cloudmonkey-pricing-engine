ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "note" text;
ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;

ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;

ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "setupPriceZar" text;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "minimumTerm" text;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "billingType" text DEFAULT 'recurring' NOT NULL;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "priceLabel" text;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "isBundle" boolean DEFAULT false NOT NULL;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "serviceNote" text;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;

ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "setupPriceZar" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "unit" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "minimumTerm" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "billingType" text DEFAULT 'recurring' NOT NULL;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "priceLabel" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "isBundle" boolean DEFAULT true NOT NULL;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "categoryNote" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "serviceNote" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;

UPDATE "service_category"
SET "active" = false
WHERE "id" IN ('cloud', 'business', 'ai');
