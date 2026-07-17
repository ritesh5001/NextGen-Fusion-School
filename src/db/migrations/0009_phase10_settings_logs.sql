-- Phase 10: SMTP + Report settings on institute_settings, and system_logs table

ALTER TABLE "institute_settings"
  ADD COLUMN IF NOT EXISTS "smtp_host" text,
  ADD COLUMN IF NOT EXISTS "smtp_port" integer,
  ADD COLUMN IF NOT EXISTS "smtp_username" text,
  ADD COLUMN IF NOT EXISTS "smtp_password" text,
  ADD COLUMN IF NOT EXISTS "smtp_from_email" text,
  ADD COLUMN IF NOT EXISTS "smtp_from_name" text,
  ADD COLUMN IF NOT EXISTS "smtp_secure" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "report_header" text,
  ADD COLUMN IF NOT EXISTS "report_footer" text,
  ADD COLUMN IF NOT EXISTS "report_logo_url" text,
  ADD COLUMN IF NOT EXISTS "report_signature_url" text,
  ADD COLUMN IF NOT EXISTS "report_principal_name" text;

CREATE TABLE IF NOT EXISTS "system_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "level" text NOT NULL DEFAULT 'info',
  "category" text NOT NULL DEFAULT 'system',
  "message" text NOT NULL,
  "metadata" text,
  "ip_address" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "system_logs_tenant_idx" ON "system_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "system_logs_created_idx" ON "system_logs"("created_at");
CREATE INDEX IF NOT EXISTS "system_logs_level_idx" ON "system_logs"("level");
