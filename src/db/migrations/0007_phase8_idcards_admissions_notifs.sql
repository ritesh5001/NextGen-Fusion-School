-- Phase 8 — ID Cards, Admissions, Notifications

CREATE TYPE "admission_status" AS ENUM ('pending','under_review','approved','rejected','enrolled');

CREATE TABLE "id_card_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "audience" text NOT NULL DEFAULT 'student',
  "orientation" text NOT NULL DEFAULT 'portrait',
  "width_mm" integer NOT NULL DEFAULT 54,
  "height_mm" integer NOT NULL DEFAULT 86,
  "accent_color" text NOT NULL DEFAULT '#10b981',
  "background_color" text NOT NULL DEFAULT '#ffffff',
  "text_color" text NOT NULL DEFAULT '#0a0a0a',
  "logo_url" text,
  "show_photo" boolean NOT NULL DEFAULT true,
  "show_qr" boolean NOT NULL DEFAULT true,
  "footer_text" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idcard_tpl_tenant_idx" ON "id_card_templates"("tenant_id");

CREATE TABLE "admission_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "application_no" text NOT NULL,
  "academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE SET NULL,
  "class_applied_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "first_name" text NOT NULL,
  "last_name" text,
  "gender" "gender",
  "dob" text,
  "guardian_name" text,
  "guardian_phone" text,
  "guardian_email" text,
  "address" text,
  "previous_school" text,
  "remarks" text,
  "status" "admission_status" NOT NULL DEFAULT 'pending',
  "review_note" text,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz,
  "enrolled_student_id" uuid REFERENCES "students"("id") ON DELETE SET NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "admission_no_uniq" ON "admission_applications"("tenant_id","application_no");
CREATE INDEX "admissions_tenant_idx" ON "admission_applications"("tenant_id");
CREATE INDEX "admissions_status_idx" ON "admission_applications"("status");

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text,
  "link" text,
  "category" text NOT NULL DEFAULT 'general',
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "notifs_user_idx" ON "notifications"("user_id");
CREATE INDEX "notifs_tenant_idx" ON "notifications"("tenant_id");
CREATE INDEX "notifs_read_idx" ON "notifications"("is_read");
