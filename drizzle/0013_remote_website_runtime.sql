ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "provisionerUrl" text;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "provisionerSecret" text;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "ingressHostname" text;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "ingressIp" text;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "dockerNetworkName" text DEFAULT 'cm_runtime' NOT NULL;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "proxyMode" text DEFAULT 'caddy' NOT NULL;
ALTER TABLE "website_runtime_server" ADD COLUMN IF NOT EXISTS "lastError" text;
