CREATE TABLE IF NOT EXISTS "proposal" (
  "id" text PRIMARY KEY NOT NULL,
  "leadId" text REFERENCES "lead"("id"),
  "customerUserId" text REFERENCES "user"("id"),
  "invoiceId" text REFERENCES "invoice"("id"),
  "proposalNumber" text,
  "publicToken" text UNIQUE,
  "title" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "customerName" text NOT NULL,
  "customerEmail" text NOT NULL,
  "customerCompany" text,
  "introduction" text,
  "executiveSummary" text,
  "terms" text,
  "currency" text DEFAULT 'ZAR' NOT NULL,
  "subtotal" integer DEFAULT 0 NOT NULL,
  "setupTotal" integer DEFAULT 0 NOT NULL,
  "recurringTotal" integer DEFAULT 0 NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "expiresAt" timestamp,
  "sentAt" timestamp,
  "approvedAt" timestamp,
  "convertedAt" timestamp,
  "approvalIp" text,
  "approvalUserAgent" text,
  "createdByUserId" text REFERENCES "user"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "proposal_item" (
  "id" text PRIMARY KEY NOT NULL,
  "proposalId" text NOT NULL REFERENCES "proposal"("id"),
  "productType" text DEFAULT 'plan' NOT NULL,
  "productId" text,
  "planId" text REFERENCES "service_plan"("id"),
  "bundleId" text REFERENCES "bundle"("id"),
  "name" text NOT NULL,
  "description" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unitPrice" integer DEFAULT 0 NOT NULL,
  "setupPrice" integer DEFAULT 0 NOT NULL,
  "recurring" boolean DEFAULT true NOT NULL,
  "interval" text DEFAULT 'month' NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "serviceDefinition" text,
  "features" text,
  "lineTotal" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "proposal_lead_idx" ON "proposal" ("leadId");
CREATE INDEX IF NOT EXISTS "proposal_customer_email_idx" ON "proposal" ("customerEmail");
CREATE INDEX IF NOT EXISTS "proposal_customer_user_idx" ON "proposal" ("customerUserId");
CREATE INDEX IF NOT EXISTS "proposal_status_idx" ON "proposal" ("status");
CREATE INDEX IF NOT EXISTS "proposal_item_proposal_idx" ON "proposal_item" ("proposalId");
