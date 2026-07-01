ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "siteType" text DEFAULT 'website' NOT NULL;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "businessName" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "businessDescription" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "industry" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "temporaryDomain" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "primaryDomain" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "onboardingAnswers" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "requirementManifest" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "buildManifest" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "provisioningPlan" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "aiGenerationStatus" text DEFAULT 'not_started' NOT NULL;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "containerStatus" text DEFAULT 'not_provisioned' NOT NULL;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "runtimeServerId" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "baseRepo" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "selectedDesignOptionId" text;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "trialStartedAt" timestamp;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamp;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "graceEndsAt" timestamp;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp;
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "terminationScheduledAt" timestamp;

CREATE TABLE IF NOT EXISTS "website_runtime_server" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'vultr' NOT NULL,
	"providerInstanceId" text,
	"profileName" text DEFAULT 'geek247-compatible-docker-host' NOT NULL,
	"hostname" text,
	"publicIp" text,
	"privateIp" text,
	"region" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"cpuTotal" integer DEFAULT 0 NOT NULL,
	"memoryTotalMb" integer DEFAULT 0 NOT NULL,
	"diskTotalGb" integer DEFAULT 0 NOT NULL,
	"activeSiteCount" integer DEFAULT 0 NOT NULL,
	"maxSiteCount" integer DEFAULT 0 NOT NULL,
	"lastHealthCheckAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "website_store" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"siteType" text DEFAULT 'website' NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"timezone" text DEFAULT 'Africa/Johannesburg' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"paymentMode" text DEFAULT 'cloudmonkey_gateway' NOT NULL,
	"trialStartedAt" timestamp,
	"trialEndsAt" timestamp,
	"suspendedAt" timestamp,
	"terminationScheduledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "website_store_database" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"engine" text DEFAULT 'postgresql' NOT NULL,
	"version" text DEFAULT '16-alpine' NOT NULL,
	"host" text,
	"port" integer DEFAULT 5432 NOT NULL,
	"databaseName" text NOT NULL,
	"username" text NOT NULL,
	"passwordSecret" text NOT NULL,
	"connectionSecret" text NOT NULL,
	"containerName" text NOT NULL,
	"volumeName" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"backupStatus" text DEFAULT 'not_configured' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "website_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"domain" text NOT NULL,
	"type" text DEFAULT 'temporary' NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"dnsTarget" text,
	"sslStatus" text DEFAULT 'pending' NOT NULL,
	"isPrimary" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"verifiedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "website_design_option" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"userId" text NOT NULL,
	"styleLabel" text NOT NULL,
	"imageUrl" text,
	"thumbnailUrl" text,
	"designManifest" text,
	"promptVersion" text,
	"tokenCost" integer DEFAULT 0 NOT NULL,
	"imageCost" integer DEFAULT 0 NOT NULL,
	"selectedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "website_plugin_install" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"storeId" text,
	"userId" text NOT NULL,
	"pluginKey" text NOT NULL,
	"status" text DEFAULT 'installed' NOT NULL,
	"config" text,
	"installedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_product" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sku" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"compareAtPrice" integer,
	"costPrice" integer,
	"taxable" boolean DEFAULT true NOT NULL,
	"trackInventory" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_product_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"storeId" text NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"options" text,
	"price" integer DEFAULT 0 NOT NULL,
	"inventoryQuantity" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"weight" text,
	"status" text DEFAULT 'active' NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_inventory_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"productVariantId" text,
	"type" text NOT NULL,
	"quantityDelta" integer NOT NULL,
	"reason" text,
	"referenceType" text,
	"referenceId" text,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"marketingOptIn" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_order" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"customerId" text,
	"orderNumber" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paymentStatus" text DEFAULT 'pending' NOT NULL,
	"fulfillmentStatus" text DEFAULT 'unfulfilled' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"deliveryFee" integer DEFAULT 0 NOT NULL,
	"discountTotal" integer DEFAULT 0 NOT NULL,
	"taxTotal" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"source" text DEFAULT 'online' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text,
	"variantId" text,
	"title" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "store_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"storeId" text NOT NULL,
	"orderId" text,
	"provider" text DEFAULT 'cloudmonkey-paystack' NOT NULL,
	"providerReference" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"feeCloudmonkey" integer DEFAULT 0 NOT NULL,
	"feeProvider" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rawProviderStatus" text,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "website_store" ADD CONSTRAINT "website_store_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_store" ADD CONSTRAINT "website_store_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_store_database" ADD CONSTRAINT "website_store_database_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_domain" ADD CONSTRAINT "website_domain_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_domain" ADD CONSTRAINT "website_domain_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_design_option" ADD CONSTRAINT "website_design_option_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_design_option" ADD CONSTRAINT "website_design_option_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "website_plugin_install" ADD CONSTRAINT "website_plugin_install_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_product" ADD CONSTRAINT "store_product_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_product" ADD CONSTRAINT "store_product_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_product_variant" ADD CONSTRAINT "store_product_variant_productId_store_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."store_product"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_product_variant" ADD CONSTRAINT "store_product_variant_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_productVariantId_store_product_variant_id_fk" FOREIGN KEY ("productVariantId") REFERENCES "public"."store_product_variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_inventory_movement" ADD CONSTRAINT "store_inventory_movement_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_customer" ADD CONSTRAINT "store_customer_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_order" ADD CONSTRAINT "store_order_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_order" ADD CONSTRAINT "store_order_customerId_store_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."store_customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_orderId_store_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."store_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_productId_store_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."store_product"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_order_item" ADD CONSTRAINT "store_order_item_variantId_store_product_variant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."store_product_variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_storeId_website_store_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."website_store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_orderId_store_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."store_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "website_user_status_idx" ON "website" ("userId", "status");
CREATE INDEX IF NOT EXISTS "website_store_website_idx" ON "website_store" ("websiteId");
CREATE INDEX IF NOT EXISTS "website_store_user_idx" ON "website_store" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "website_store_database_store_unique" ON "website_store_database" ("storeId");
CREATE INDEX IF NOT EXISTS "website_domain_domain_idx" ON "website_domain" ("domain");
CREATE INDEX IF NOT EXISTS "store_product_store_idx" ON "store_product" ("storeId");
CREATE INDEX IF NOT EXISTS "store_order_store_status_idx" ON "store_order" ("storeId", "status");
CREATE INDEX IF NOT EXISTS "store_payment_store_status_idx" ON "store_payment" ("storeId", "status");
