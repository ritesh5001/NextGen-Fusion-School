-- Phase 5: Fees, Accounts, Promotion

DO $$ BEGIN
  CREATE TYPE "fee_invoice_status" AS ENUM ('unpaid','partial','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "account_kind" AS ENUM ('income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_method" AS ENUM ('cash','bank','upi','card','cheque','online','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fee_heads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text,
  "description" text,
  "is_recurring" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "fee_heads_tenant_idx" ON "fee_heads" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_heads_tenant_name_uniq" ON "fee_heads" ("tenant_id","name");

CREATE TABLE IF NOT EXISTS "fee_structures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "fee_head_id" uuid NOT NULL REFERENCES "fee_heads"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "term" text,
  "due_day" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "fee_struct_tenant_idx" ON "fee_structures" ("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_struct_class_idx" ON "fee_structures" ("class_id");
CREATE INDEX IF NOT EXISTS "fee_struct_year_idx" ON "fee_structures" ("academic_year_id");

CREATE TABLE IF NOT EXISTS "fee_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_no" text NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE SET NULL,
  "issue_date" text NOT NULL,
  "due_date" text NOT NULL,
  "total_amount" integer NOT NULL DEFAULT 0,
  "paid_amount" integer NOT NULL DEFAULT 0,
  "status" "fee_invoice_status" NOT NULL DEFAULT 'unpaid',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_inv_no_uniq" ON "fee_invoices" ("tenant_id","invoice_no");
CREATE INDEX IF NOT EXISTS "fee_inv_tenant_idx" ON "fee_invoices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_inv_student_idx" ON "fee_invoices" ("student_id");
CREATE INDEX IF NOT EXISTS "fee_inv_status_idx" ON "fee_invoices" ("status");

CREATE TABLE IF NOT EXISTS "fee_invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id" uuid NOT NULL REFERENCES "fee_invoices"("id") ON DELETE CASCADE,
  "fee_head_id" uuid REFERENCES "fee_heads"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "amount" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "fee_inv_item_invoice_idx" ON "fee_invoice_items" ("invoice_id");

CREATE TABLE IF NOT EXISTS "fee_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id" uuid NOT NULL REFERENCES "fee_invoices"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "method" "payment_method" NOT NULL DEFAULT 'cash',
  "reference" text,
  "paid_on" text NOT NULL,
  "remarks" text,
  "is_cancelled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "fee_pay_invoice_idx" ON "fee_payments" ("invoice_id");
CREATE INDEX IF NOT EXISTS "fee_pay_tenant_idx" ON "fee_payments" ("tenant_id");

CREATE TABLE IF NOT EXISTS "account_heads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" "account_kind" NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "acc_heads_uniq" ON "account_heads" ("tenant_id","name");
CREATE INDEX IF NOT EXISTS "acc_heads_tenant_idx" ON "account_heads" ("tenant_id");

CREATE TABLE IF NOT EXISTS "account_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "account_head_id" uuid NOT NULL REFERENCES "account_heads"("id") ON DELETE RESTRICT,
  "kind" "account_kind" NOT NULL,
  "tx_date" text NOT NULL,
  "amount" integer NOT NULL,
  "description" text,
  "reference" text,
  "fee_payment_id" uuid REFERENCES "fee_payments"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "acc_tx_tenant_idx" ON "account_transactions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "acc_tx_head_idx" ON "account_transactions" ("account_head_id");
CREATE INDEX IF NOT EXISTS "acc_tx_date_idx" ON "account_transactions" ("tx_date");

CREATE TABLE IF NOT EXISTS "promotion_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "from_year_id" uuid REFERENCES "academic_years"("id") ON DELETE SET NULL,
  "to_year_id" uuid REFERENCES "academic_years"("id") ON DELETE SET NULL,
  "from_class_id" uuid,
  "from_section_id" uuid,
  "to_class_id" uuid,
  "to_section_id" uuid,
  "outcome" text NOT NULL,
  "performed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "promo_tenant_idx" ON "promotion_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "promo_student_idx" ON "promotion_logs" ("student_id");
