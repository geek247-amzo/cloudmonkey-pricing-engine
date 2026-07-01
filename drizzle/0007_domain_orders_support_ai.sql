ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;
ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "aiSessionId" text;
ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" timestamp;
ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "slaDueAt" timestamp;
ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "resolutionSummary" text;

CREATE TABLE IF NOT EXISTS "domain_order" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "domainName" text NOT NULL,
  "domainPlanId" text REFERENCES "service_plan"("id"),
  "addonPlanIds" text,
  "invoiceId" text REFERENCES "invoice"("id"),
  "subscriptionId" text REFERENCES "subscription"("id"),
  "status" text NOT NULL DEFAULT 'pending_payment',
  "providerResponse" text,
  "providerError" text,
  "registeredAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_chat_session" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "ticketId" text REFERENCES "support_ticket"("id"),
  "status" text NOT NULL DEFAULT 'open',
  "summary" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_chat_message" (
  "id" text PRIMARY KEY,
  "sessionId" text NOT NULL REFERENCES "support_chat_session"("id"),
  "userId" text REFERENCES "user"("id"),
  "role" text NOT NULL,
  "body" text NOT NULL,
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
