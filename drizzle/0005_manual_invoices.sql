ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "invoiceSource" text DEFAULT 'checkout' NOT NULL;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "publishedAt" timestamp;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "emailedAt" timestamp;
