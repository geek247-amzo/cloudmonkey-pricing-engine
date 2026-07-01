ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "trialDays" integer;

UPDATE "service_plan"
SET "trialDays" = 7
WHERE "id" IN ('web-ai', 'web-managed', 'ecom-starter', 'ecom-growth', 'ecom-pro');

UPDATE "service"
SET "description" = 'Cloud phone system with mobile, softphone, and voice intelligence options.'
WHERE "id" = 'pbx';

DELETE FROM "service_feature"
WHERE "planId" IN ('voice-analytics', 'voice-sentiment', 'voice-summary', 'voice-coach');

DELETE FROM "service_plan"
WHERE "id" IN ('voice-analytics', 'voice-sentiment', 'voice-summary', 'voice-coach');

DELETE FROM "service"
WHERE "id" = 'pbx-ai';
