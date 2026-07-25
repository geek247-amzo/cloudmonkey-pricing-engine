CREATE TABLE IF NOT EXISTS "platform_api_credential" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "label" text NOT NULL,
  "keyEncrypted" text NOT NULL,
  "keyLastFour" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastVerifiedAt" timestamp,
  "monthlySpendCap" integer
);
CREATE INDEX IF NOT EXISTS "platform_api_credential_provider_status_idx" ON "platform_api_credential" ("provider", "status");
CREATE TABLE IF NOT EXISTS "platform_api_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "credentialId" text,
  "userId" text,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "featureKey" text NOT NULL,
  "inputTokens" integer DEFAULT 0 NOT NULL,
  "outputTokens" integer DEFAULT 0 NOT NULL,
  "providerCostMicrousd" integer DEFAULT 0 NOT NULL,
  "chargedCostMicrousd" integer DEFAULT 0 NOT NULL,
  "chargedTokens" integer DEFAULT 0 NOT NULL,
  "metadataJson" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "platform_api_usage_credential_fk" FOREIGN KEY ("credentialId") REFERENCES "platform_api_credential"("id") ON DELETE set null,
  CONSTRAINT "platform_api_usage_user_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "platform_api_usage_provider_created_idx" ON "platform_api_usage" ("provider", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_api_usage_credential_created_idx" ON "platform_api_usage" ("credentialId", "createdAt");
