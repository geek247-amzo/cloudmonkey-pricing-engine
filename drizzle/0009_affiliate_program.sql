CREATE TABLE IF NOT EXISTS "affiliate" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"fullName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"companyName" text,
	"website" text,
	"socialLinks" text,
	"affiliateType" text DEFAULT 'individual' NOT NULL,
	"expectedReferralMethod" text,
	"tier" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referralCode" text NOT NULL,
	"commissionType" text DEFAULT 'once_off' NOT NULL,
	"commissionRateBps" integer DEFAULT 1000 NOT NULL,
	"recurringDurationMonths" integer DEFAULT 1 NOT NULL,
	"payoutMethod" text DEFAULT 'manual_eft' NOT NULL,
	"payoutDetails" text,
	"termsAcceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"approvedAt" timestamp,
	"rejectedAt" timestamp,
	"suspendedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"notes" text
);

CREATE TABLE IF NOT EXISTS "affiliate_referral" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"referralCode" text NOT NULL,
	"visitorId" text,
	"leadId" text,
	"customerId" text,
	"sourceUrl" text,
	"landingPage" text,
	"ipAddress" text,
	"userAgent" text,
	"attributionType" text DEFAULT 'link' NOT NULL,
	"attributionModel" text DEFAULT 'last_click' NOT NULL,
	"status" text DEFAULT 'clicked' NOT NULL,
	"tierAtSignup" text,
	"commissionTypeAtSignup" text,
	"commissionRateBpsAtSignup" integer,
	"recurringDurationMonthsAtSignup" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"clickedAt" timestamp DEFAULT now() NOT NULL,
	"signedUpAt" timestamp,
	"convertedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "affiliate_commission" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"referralId" text,
	"customerId" text NOT NULL,
	"paymentId" text,
	"invoiceId" text,
	"subscriptionId" text,
	"commissionType" text NOT NULL,
	"commissionRateBps" integer NOT NULL,
	"commissionAmount" integer NOT NULL,
	"commissionMonthNumber" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"holdUntilDate" timestamp NOT NULL,
	"approvedAt" timestamp,
	"payableAt" timestamp,
	"paidAt" timestamp,
	"cancelledAt" timestamp,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"payoutPeriodStart" timestamp NOT NULL,
	"payoutPeriodEnd" timestamp NOT NULL,
	"totalAmount" integer NOT NULL,
	"payoutMethod" text DEFAULT 'manual_eft' NOT NULL,
	"payoutReference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"adminId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_fraud_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text,
	"referralId" text,
	"customerId" text,
	"flagType" text NOT NULL,
	"severity" text DEFAULT 'review' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detail" text NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);

DO $$ BEGIN
 ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_referralId_affiliate_referral_id_fk" FOREIGN KEY ("referralId") REFERENCES "public"."affiliate_referral"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_invoiceId_invoice_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_adminId_user_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_affiliateId_affiliate_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_referralId_affiliate_referral_id_fk" FOREIGN KEY ("referralId") REFERENCES "public"."affiliate_referral"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_fraud_flag" ADD CONSTRAINT "affiliate_fraud_flag_customerId_user_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_email_unique" ON "affiliate" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referral_code_unique" ON "affiliate" ("referralCode");
CREATE INDEX IF NOT EXISTS "affiliate_referral_code_idx" ON "affiliate_referral" ("referralCode");
CREATE INDEX IF NOT EXISTS "affiliate_referral_customer_idx" ON "affiliate_referral" ("customerId");
CREATE INDEX IF NOT EXISTS "affiliate_commission_affiliate_status_idx" ON "affiliate_commission" ("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "affiliate_commission_invoice_idx" ON "affiliate_commission" ("invoiceId");
