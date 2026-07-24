-- Production go-live wallet allowances.
-- These values are the approved included-token allowances for the live product catalog.
-- All other plans and bundles remain at 0 unless explicitly set below.

BEGIN;

UPDATE "service_plan"
SET "includedTokenAllowanceTokens" = CASE id
  WHEN 'agent-marketing' THEN 1000000
  WHEN 'agent-sales' THEN 1000000
  WHEN 'agent-support' THEN 1000000
  WHEN 'agent-hr' THEN 1000000
  WHEN 'agent-finance' THEN 1000000
  WHEN 'agent-operations' THEN 1000000
  WHEN 'ci-starter' THEN 25000
  WHEN 'ci-growth' THEN 35000
  WHEN 'ci-managed' THEN 100000
  WHEN 'ai-asst-starter' THEN 40000
  WHEN 'ai-asst-growth' THEN 150000
  WHEN 'ai-asst-business' THEN 350000
  WHEN 'web-ai' THEN 5000
  WHEN 'vi-starter' THEN 400000
  WHEN 'vi-business' THEN 900000
  WHEN 'vi-enterprise' THEN 2750000
  ELSE "includedTokenAllowanceTokens"
END
WHERE id IN (
  'agent-marketing',
  'agent-sales',
  'agent-support',
  'agent-hr',
  'agent-finance',
  'agent-operations',
  'ci-starter',
  'ci-growth',
  'ci-managed',
  'ai-asst-starter',
  'ai-asst-growth',
  'ai-asst-business',
  'web-ai',
  'vi-starter',
  'vi-business',
  'vi-enterprise'
);

UPDATE "bundle"
SET "includedTokenAllowanceTokens" = CASE id
  WHEN 'bundle_build_launch' THEN 0
  WHEN 'bundle_voice_team' THEN 0
  WHEN 'bundle_managed_voice' THEN 0
  WHEN 'bundle_full_service_growth' THEN 1050000
  WHEN 'bundle-ai' THEN 40000
  WHEN 'bundle-business' THEN 0
  WHEN 'bundle-complete' THEN 40000
  WHEN 'bundle-connect' THEN 0
  WHEN 'bundle-start' THEN 0
  ELSE "includedTokenAllowanceTokens"
END
WHERE id IN (
  'bundle_build_launch',
  'bundle_voice_team',
  'bundle_managed_voice',
  'bundle_full_service_growth',
  'bundle-ai',
  'bundle-business',
  'bundle-complete',
  'bundle-connect',
  'bundle-start'
);

COMMIT;
