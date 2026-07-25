-- DPDP Act 2023: capture verifiable parental consent on admission applications.
ALTER TABLE "admission_applications"
  ADD COLUMN IF NOT EXISTS "parental_consent" boolean NOT NULL DEFAULT false;
ALTER TABLE "admission_applications"
  ADD COLUMN IF NOT EXISTS "consent_name" text;
ALTER TABLE "admission_applications"
  ADD COLUMN IF NOT EXISTS "consent_at" timestamp with time zone;
