ALTER TABLE "service_plan"
  ADD COLUMN IF NOT EXISTS "billingFrequency" text DEFAULT 'month' NOT NULL;

ALTER TABLE "bundle"
  ADD COLUMN IF NOT EXISTS "billingFrequency" text DEFAULT 'month' NOT NULL;

UPDATE "service_plan"
SET "billingFrequency" = CASE
  WHEN "billingType" = 'once_off' THEN 'once_off'
  WHEN lower(coalesce("unit", '')) LIKE '%year%' THEN 'year'
  ELSE 'month'
END
WHERE "billingFrequency" IS NULL OR "billingFrequency" = 'month';

UPDATE "bundle"
SET "billingFrequency" = CASE
  WHEN "billingType" = 'once_off' THEN 'once_off'
  WHEN lower(coalesce("unit", '')) LIKE '%year%' THEN 'year'
  ELSE 'month'
END
WHERE "billingFrequency" IS NULL OR "billingFrequency" = 'month';
