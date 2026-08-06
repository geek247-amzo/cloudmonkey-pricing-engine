INSERT INTO "bundle" (
  "id", "name", "priceZar", "setupPriceZar", "unit", "billingFrequency",
  "minimumTerm", "minimumTermMonths", "billingType", "isBundle", "sortOrder",
  "categoryNote", "serviceNote", "active", "highlighted", "badge"
)
VALUES
  ('bundle_advisory_5_remote', 'Advisory 5 · Remote', '300000', '0', '/month', 'month', '1 month', 1, 'recurring', true, 60, 'Advisory Bundles', 'Five remote strategic, product, technology or training hours per month, paid in advance.', true, false, null),
  ('bundle_advisory_10_remote', 'Advisory 10 · Remote', '600000', '0', '/month', 'month', '1 month', 1, 'recurring', true, 61, 'Advisory Bundles', 'Ten remote strategic, product, technology or training hours per month, paid in advance.', true, false, null),
  ('bundle_advisory_20_remote', 'Advisory 20 · Remote', '1200000', '0', '/month', 'month', '1 month', 1, 'recurring', true, 62, 'Advisory Bundles', 'Twenty remote hours per month for active fractional CTO and product leadership support.', true, false, null),
  ('bundle_advisory_10_onsite', 'On-Site 10', '1000000', '0', '/month', 'month', '1 month', 1, 'recurring', true, 63, 'Advisory Bundles', 'Ten on-site hours per month for operational workshops, implementation and team enablement.', true, false, null),
  ('bundle_advisory_10_hybrid', 'Hybrid 10', '800000', '0', '/month', 'month', '1 month', 1, 'recurring', true, 64, 'Advisory Bundles', 'Five remote and five on-site hours per month.', true, false, null)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "priceZar" = EXCLUDED."priceZar",
  "setupPriceZar" = EXCLUDED."setupPriceZar",
  "unit" = EXCLUDED."unit",
  "billingFrequency" = EXCLUDED."billingFrequency",
  "minimumTerm" = EXCLUDED."minimumTerm",
  "minimumTermMonths" = EXCLUDED."minimumTermMonths",
  "billingType" = EXCLUDED."billingType",
  "categoryNote" = EXCLUDED."categoryNote",
  "serviceNote" = EXCLUDED."serviceNote",
  "active" = true,
  "sortOrder" = EXCLUDED."sortOrder";

DELETE FROM "bundle_feature"
WHERE "bundleId" IN (
  'bundle_advisory_5_remote', 'bundle_advisory_10_remote',
  'bundle_advisory_20_remote', 'bundle_advisory_10_onsite',
  'bundle_advisory_10_hybrid'
);

INSERT INTO "bundle_feature" ("id", "bundleId", "content") VALUES
  ('bundlefeature_advisory_5_remote_1', 'bundle_advisory_5_remote', '5 remote hours'),
  ('bundlefeature_advisory_5_remote_2', 'bundle_advisory_5_remote', '30-minute billing increments'),
  ('bundlefeature_advisory_5_remote_3', 'bundle_advisory_5_remote', 'Priority list and session agenda'),
  ('bundlefeature_advisory_5_remote_4', 'bundle_advisory_5_remote', 'Usage and outcome reporting'),
  ('bundlefeature_advisory_10_remote_1', 'bundle_advisory_10_remote', '10 remote hours'),
  ('bundlefeature_advisory_10_remote_2', 'bundle_advisory_10_remote', '30-minute billing increments'),
  ('bundlefeature_advisory_10_remote_3', 'bundle_advisory_10_remote', 'Weekly product or process sessions'),
  ('bundlefeature_advisory_10_remote_4', 'bundle_advisory_10_remote', 'Usage and outcome reporting'),
  ('bundlefeature_advisory_20_remote_1', 'bundle_advisory_20_remote', '20 remote hours'),
  ('bundlefeature_advisory_20_remote_2', 'bundle_advisory_20_remote', 'Architecture and prioritisation'),
  ('bundlefeature_advisory_20_remote_3', 'bundle_advisory_20_remote', 'Fractional CTO guidance'),
  ('bundlefeature_advisory_20_remote_4', 'bundle_advisory_20_remote', 'Usage and outcome reporting'),
  ('bundlefeature_advisory_10_onsite_1', 'bundle_advisory_10_onsite', '10 on-site hours'),
  ('bundlefeature_advisory_10_onsite_2', 'bundle_advisory_10_onsite', 'Three-hour minimum per visit'),
  ('bundlefeature_advisory_10_onsite_3', 'bundle_advisory_10_onsite', 'Operational workshops'),
  ('bundlefeature_advisory_10_onsite_4', 'bundle_advisory_10_onsite', 'Implementation and team enablement'),
  ('bundlefeature_advisory_10_hybrid_1', 'bundle_advisory_10_hybrid', '5 remote hours'),
  ('bundlefeature_advisory_10_hybrid_2', 'bundle_advisory_10_hybrid', '5 on-site hours'),
  ('bundlefeature_advisory_10_hybrid_3', 'bundle_advisory_10_hybrid', 'Three-hour minimum per on-site visit'),
  ('bundlefeature_advisory_10_hybrid_4', 'bundle_advisory_10_hybrid', 'Usage and outcome reporting')
ON CONFLICT ("id") DO UPDATE SET "content" = EXCLUDED."content";
