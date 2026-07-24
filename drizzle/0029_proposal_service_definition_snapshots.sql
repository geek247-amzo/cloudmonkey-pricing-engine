-- Backfill catalogue scope snapshots for proposals created before delegated admin routing
-- persisted service definitions and features.

UPDATE "proposal_item" AS pi
SET "productType" = 'plan',
    "productId" = sp.id,
    "planId" = sp.id,
    "bundleId" = NULL,
    "serviceDefinition" = sp."serviceDefinition",
    "features" = COALESCE(
      (
        SELECT json_agg(sf.content ORDER BY sf.id)::text
        FROM "service_feature" sf
        WHERE sf."planId" = sp.id
      ),
      '[]'
    )
FROM "service_plan" sp
WHERE COALESCE(pi."planId", pi."productId") = sp.id
  AND (pi."serviceDefinition" IS NULL OR btrim(pi."serviceDefinition") = '');

UPDATE "proposal_item" AS pi
SET "productType" = 'bundle',
    "productId" = b.id,
    "planId" = NULL,
    "bundleId" = b.id,
    "serviceDefinition" = b."serviceDefinition",
    "features" = COALESCE(
      (
        SELECT json_agg(bf.content ORDER BY bf.id)::text
        FROM "bundle_feature" bf
        WHERE bf."bundleId" = b.id
      ),
      '[]'
    )
FROM "bundle" b
WHERE COALESCE(pi."bundleId", pi."productId") = b.id
  AND (pi."serviceDefinition" IS NULL OR btrim(pi."serviceDefinition") = '');
