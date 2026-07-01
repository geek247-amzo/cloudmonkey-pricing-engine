INSERT INTO "service" ("id", "categoryId", "name", "description", "note")
VALUES (
  'competitor-intelligence',
  'ai',
  'Competitor Intelligence',
  'Managed SEO, website, and competitor intelligence that shows what competitors do better and what to fix next.',
  NULL
)
ON CONFLICT ("id") DO UPDATE SET
  "categoryId" = EXCLUDED."categoryId",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "note" = EXCLUDED."note";

INSERT INTO "service_plan" ("id", "serviceId", "name", "tagline", "priceZar", "unit", "trialDays", "highlighted", "badge")
VALUES
  ('ci-starter', 'competitor-intelligence', 'Starter', 'Monthly competitor visibility report for one site.', '49900', '/month', NULL, false, NULL),
  ('ci-growth', 'competitor-intelligence', 'Growth', 'Weekly tracking, content gaps, and AI recommendations.', '99900', '/month', NULL, true, 'Recommended'),
  ('ci-managed', 'competitor-intelligence', 'Managed SEO', 'CloudMonkey executes the fixes and growth plan.', '250000', '/month', NULL, false, NULL)
ON CONFLICT ("id") DO UPDATE SET
  "serviceId" = EXCLUDED."serviceId",
  "name" = EXCLUDED."name",
  "tagline" = EXCLUDED."tagline",
  "priceZar" = EXCLUDED."priceZar",
  "unit" = EXCLUDED."unit",
  "trialDays" = EXCLUDED."trialDays",
  "highlighted" = EXCLUDED."highlighted",
  "badge" = EXCLUDED."badge";

DELETE FROM "service_feature"
WHERE "planId" IN ('ci-starter', 'ci-growth', 'ci-managed');

INSERT INTO "service_feature" ("id", "planId", "content")
VALUES
  ('ci-starter-site', 'ci-starter', '1 website'),
  ('ci-starter-competitors', 'ci-starter', '3 competitors'),
  ('ci-starter-report', 'ci-starter', 'Monthly AI report'),
  ('ci-starter-audit', 'ci-starter', 'SEO audit'),
  ('ci-starter-keywords', 'ci-starter', 'Keyword gap starter'),
  ('ci-growth-site', 'ci-growth', '1 website'),
  ('ci-growth-competitors', 'ci-growth', '5 competitors'),
  ('ci-growth-tracking', 'ci-growth', 'Weekly tracking'),
  ('ci-growth-content', 'ci-growth', 'Content gaps'),
  ('ci-growth-recommendations', 'ci-growth', 'AI recommendations'),
  ('ci-growth-pdf', 'ci-growth', 'PDF reports'),
  ('ci-managed-execution', 'ci-managed', 'CloudMonkey executes fixes'),
  ('ci-managed-content', 'ci-managed', 'Managed content plan'),
  ('ci-managed-local', 'ci-managed', 'Local SEO actions'),
  ('ci-managed-review', 'ci-managed', 'Monthly strategy review'),
  ('ci-managed-support', 'ci-managed', 'Priority support');
