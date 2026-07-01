ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "subscriptionId" text REFERENCES "subscription"("id");
ALTER TABLE "website" ADD COLUMN IF NOT EXISTS "invoiceId" text REFERENCES "invoice"("id");

CREATE TABLE IF NOT EXISTS "website_approval_token" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL REFERENCES "website"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"tokenHash" text NOT NULL UNIQUE,
	"actionType" text NOT NULL,
	"targetId" text,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "website_review_request" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL REFERENCES "website"("id"),
	"userId" text NOT NULL REFERENCES "user"("id"),
	"type" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"targetId" text,
	"message" text,
	"response" text,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	"respondedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
