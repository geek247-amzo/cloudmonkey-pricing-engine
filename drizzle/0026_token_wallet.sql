ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "includedTokenAllowanceTokens" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "autoTopUpThresholdTokens" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "autoTopUpAmountTokens" integer DEFAULT 0 NOT NULL;

ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "includedTokenAllowanceTokens" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "autoTopUpThresholdTokens" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "autoTopUpAmountTokens" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "token_wallet" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "balanceTokens" integer DEFAULT 0 NOT NULL,
  "reservedTokens" integer DEFAULT 0 NOT NULL,
  "currencyCode" text,
  "unitLabel" text,
  "status" text DEFAULT 'active' NOT NULL,
  "autoTopUpEnabled" boolean DEFAULT false NOT NULL,
  "autoTopUpThresholdTokens" integer DEFAULT 0 NOT NULL,
  "autoTopUpAmountTokens" integer DEFAULT 0 NOT NULL,
  "lastLowBalanceAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_wallet_user_id_unique" ON "token_wallet" ("userId");

CREATE TABLE IF NOT EXISTS "token_wallet_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "walletId" text NOT NULL REFERENCES "token_wallet"("id"),
  "userId" text NOT NULL REFERENCES "user"("id"),
  "entryType" text NOT NULL,
  "direction" text NOT NULL,
  "amountTokens" integer NOT NULL,
  "balanceBeforeTokens" integer NOT NULL,
  "balanceAfterTokens" integer NOT NULL,
  "reservedBeforeTokens" integer NOT NULL,
  "reservedAfterTokens" integer NOT NULL,
  "featureKey" text,
  "sourceType" text NOT NULL,
  "sourceId" text,
  "idempotencyKey" text NOT NULL,
  "metadataJson" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_wallet_ledger_idempotency_unique" ON "token_wallet_ledger" ("idempotencyKey");

CREATE TABLE IF NOT EXISTS "token_wallet_reservation" (
  "id" text PRIMARY KEY NOT NULL,
  "walletId" text NOT NULL REFERENCES "token_wallet"("id"),
  "userId" text NOT NULL REFERENCES "user"("id"),
  "featureKey" text NOT NULL,
  "requestIdempotencyKey" text NOT NULL,
  "reservedTokens" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "sourceType" text,
  "sourceId" text,
  "metadataJson" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_wallet_reservation_wallet_request_unique" ON "token_wallet_reservation" ("walletId", "requestIdempotencyKey");

CREATE TABLE IF NOT EXISTS "token_feature_rate" (
  "featureKey" text PRIMARY KEY NOT NULL,
  "displayName" text NOT NULL,
  "baseTokenCost" integer DEFAULT 0 NOT NULL,
  "multiplierBps" integer DEFAULT 10000 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "token_topup_intent" (
  "id" text PRIMARY KEY NOT NULL,
  "walletId" text NOT NULL REFERENCES "token_wallet"("id"),
  "userId" text NOT NULL REFERENCES "user"("id"),
  "amountTokens" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "paystackReference" text NOT NULL,
  "paystackUrl" text,
  "paymentMethod" text DEFAULT 'gateway' NOT NULL,
  "metadataJson" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "paidAt" timestamp,
  "failedAt" timestamp,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_topup_intent_paystack_reference_unique" ON "token_topup_intent" ("paystackReference");

INSERT INTO "token_feature_rate" ("featureKey", "displayName", "baseTokenCost", "multiplierBps", "active", "notes")
VALUES
  ('website_design_preview', 'Website design preview generation', 100, 10000, true, 'Preview generation for AI website design concepts'),
  ('website_basic_build', 'Website basic runtime build', 150, 10000, true, 'Provisioning and runtime build steps for generated websites'),
  ('competitor_intelligence_scan', 'Competitor intelligence scan', 120, 10000, true, 'Competitor intelligence crawl and n8n scan orchestration')
ON CONFLICT ("featureKey") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "baseTokenCost" = EXCLUDED."baseTokenCost",
    "multiplierBps" = EXCLUDED."multiplierBps",
    "active" = EXCLUDED."active",
    "notes" = EXCLUDED."notes",
    "updatedAt" = now();
