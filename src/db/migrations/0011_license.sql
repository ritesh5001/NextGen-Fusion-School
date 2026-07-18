-- Phase 13: signed license key column on the single institution row
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "license_key" text;
