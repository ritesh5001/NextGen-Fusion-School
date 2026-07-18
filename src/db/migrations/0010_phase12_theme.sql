-- Phase 12: per-tenant theme customisation
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "theme_json" text;
