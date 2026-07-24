ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "serviceDefinition" text;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "agreementTemplateId" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "serviceDefinition" text;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "agreementTemplateId" text;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "agreementSigned" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "agreementSignedAt" timestamp;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "requiredAgreementTemplateId" text;

CREATE TABLE IF NOT EXISTS "agreement_template" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "documentType" text DEFAULT 'sla' NOT NULL,
  "version" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "contentHash" text NOT NULL,
  "effectiveFrom" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agreement_template_sku" (
  "id" text PRIMARY KEY NOT NULL,
  "templateId" text NOT NULL,
  "productType" text NOT NULL,
  "productId" text NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "signed_agreement" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "subscriptionId" text,
  "templateId" text NOT NULL,
  "templateVersion" text NOT NULL,
  "productType" text NOT NULL,
  "productId" text NOT NULL,
  "documentHash" text NOT NULL,
  "consentText" text NOT NULL,
  "documentSnapshot" text NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "signedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "agreement_template_sku" ADD CONSTRAINT "agreement_template_sku_templateId_agreement_template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."agreement_template"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "signed_agreement" ADD CONSTRAINT "signed_agreement_templateId_agreement_template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."agreement_template"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "agreement_template_sku_product_idx" ON "agreement_template_sku" ("productType", "productId");
CREATE INDEX IF NOT EXISTS "signed_agreement_user_product_idx" ON "signed_agreement" ("userId", "productType", "productId");
CREATE INDEX IF NOT EXISTS "signed_agreement_subscription_idx" ON "signed_agreement" ("subscriptionId");
