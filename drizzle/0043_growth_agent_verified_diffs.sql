ALTER TABLE website_growth_proposal ADD COLUMN IF NOT EXISTS "modelClaimedDiffJson" text;
ALTER TABLE website_growth_proposal ADD COLUMN IF NOT EXISTS "verifiedDiffHash" text;
ALTER TABLE website_growth_proposal ADD COLUMN IF NOT EXISTS "approvedDiffHash" text;
