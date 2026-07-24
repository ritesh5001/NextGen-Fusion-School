-- Rename the plan tiers to Starter / Pro / Max so the tenant plan matches the
-- license key tiers (see src/lib/plans.ts). Idempotent: only renames a value
-- that still exists under its old name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'plan_tier' AND e.enumlabel = 'growth'
  ) THEN
    ALTER TYPE "plan_tier" RENAME VALUE 'growth' TO 'pro';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'plan_tier' AND e.enumlabel = 'premium'
  ) THEN
    ALTER TYPE "plan_tier" RENAME VALUE 'premium' TO 'max';
  END IF;
END$$;
