ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "planId" text REFERENCES "service_plan"("id");
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "bundleId" text REFERENCES "bundle"("id");
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "recurring" boolean DEFAULT false NOT NULL;
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "interval" text DEFAULT 'month' NOT NULL;
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "websitePackageType" text;
