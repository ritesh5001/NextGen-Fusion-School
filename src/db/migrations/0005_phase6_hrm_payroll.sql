-- Phase 6 — HRM & Payroll

CREATE TYPE "leave_status" AS ENUM ('pending','approved','rejected','cancelled');
CREATE TYPE "component_kind" AS ENUM ('earning','deduction');
CREATE TYPE "payslip_status" AS ENUM ('draft','finalized','paid');

CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "employee_code" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text,
  "gender" "gender",
  "dob" timestamptz,
  "phone" text,
  "email" text,
  "designation" text,
  "department" text,
  "joined_on" timestamptz,
  "address" text,
  "photo_url" text,
  "bank_name" text,
  "bank_account_no" text,
  "bank_ifsc" text,
  "pan_no" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "employees_tenant_code_uniq" ON "employees"("tenant_id","employee_code");
CREATE INDEX "employees_tenant_idx" ON "employees"("tenant_id");

CREATE TABLE "leave_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text,
  "annual_quota" integer NOT NULL DEFAULT 0,
  "is_paid" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "leave_types_tenant_idx" ON "leave_types"("tenant_id");

CREATE TABLE "leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid REFERENCES "leave_types"("id") ON DELETE SET NULL,
  "from_date" text NOT NULL,
  "to_date" text NOT NULL,
  "days" integer NOT NULL DEFAULT 1,
  "reason" text,
  "status" "leave_status" NOT NULL DEFAULT 'pending',
  "decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamptz,
  "decision_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "leave_req_tenant_idx" ON "leave_requests"("tenant_id");
CREATE INDEX "leave_req_emp_idx" ON "leave_requests"("employee_id");

CREATE TABLE "hr_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "effective_from" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "hr_policies_tenant_idx" ON "hr_policies"("tenant_id");

CREATE TABLE "work_outside_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "log_date" text NOT NULL,
  "location" text,
  "purpose" text NOT NULL,
  "hours" integer,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "work_outside_tenant_idx" ON "work_outside_logs"("tenant_id");
CREATE INDEX "work_outside_emp_idx" ON "work_outside_logs"("employee_id");

CREATE TABLE "salary_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text,
  "kind" "component_kind" NOT NULL,
  "is_percentage" boolean NOT NULL DEFAULT false,
  "default_value" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "salary_comp_tenant_idx" ON "salary_components"("tenant_id");

CREATE TABLE "salary_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "salary_tpl_tenant_idx" ON "salary_templates"("tenant_id");

CREATE TABLE "salary_template_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "salary_templates"("id") ON DELETE CASCADE,
  "component_id" uuid NOT NULL REFERENCES "salary_components"("id") ON DELETE CASCADE,
  "value" integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "salary_tpl_comp_uniq" ON "salary_template_components"("template_id","component_id");

CREATE TABLE "employee_salary_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "template_id" uuid NOT NULL REFERENCES "salary_templates"("id") ON DELETE RESTRICT,
  "basic" integer NOT NULL DEFAULT 0,
  "effective_from" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "emp_sal_tenant_idx" ON "employee_salary_assignments"("tenant_id");
CREATE INDEX "emp_sal_emp_idx" ON "employee_salary_assignments"("employee_id");

CREATE TABLE "payslips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "period_year" integer NOT NULL,
  "period_month" integer NOT NULL,
  "basic" integer NOT NULL DEFAULT 0,
  "gross_earnings" integer NOT NULL DEFAULT 0,
  "total_deductions" integer NOT NULL DEFAULT 0,
  "net_pay" integer NOT NULL DEFAULT 0,
  "status" "payslip_status" NOT NULL DEFAULT 'draft',
  "paid_at" timestamptz,
  "paid_via" text,
  "reference" text,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "payslip_emp_period_uniq" ON "payslips"("tenant_id","employee_id","period_year","period_month");
CREATE INDEX "payslip_tenant_idx" ON "payslips"("tenant_id");
CREATE INDEX "payslip_period_idx" ON "payslips"("period_year","period_month");

CREATE TABLE "payslip_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payslip_id" uuid NOT NULL REFERENCES "payslips"("id") ON DELETE CASCADE,
  "component_id" uuid REFERENCES "salary_components"("id") ON DELETE SET NULL,
  "label" text NOT NULL,
  "kind" "component_kind" NOT NULL,
  "amount" integer NOT NULL DEFAULT 0
);
CREATE INDEX "payslip_items_slip_idx" ON "payslip_items"("payslip_id");
