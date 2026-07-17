-- Phase 3: Teachers, Class↔Subject↔Teacher mapping, Attendance

CREATE TABLE IF NOT EXISTS "teachers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "employee_code" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text,
  "gender" gender,
  "dob" timestamptz,
  "phone" text,
  "email" text,
  "qualification" text,
  "designation" text,
  "joined_on" timestamptz,
  "address" text,
  "photo_url" text,
  "bio" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_tenant_code_uniq" ON "teachers"("tenant_id","employee_code");
CREATE INDEX IF NOT EXISTS "teachers_tenant_idx" ON "teachers"("tenant_id");

CREATE TABLE IF NOT EXISTS "class_subject_teachers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "section_id" uuid REFERENCES "sections"("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cst_unique" ON "class_subject_teachers"("class_id","section_id","subject_id","teacher_id");
CREATE INDEX IF NOT EXISTS "cst_tenant_idx" ON "class_subject_teachers"("tenant_id");
CREATE INDEX IF NOT EXISTS "cst_class_idx" ON "class_subject_teachers"("class_id");

DO $$ BEGIN
  CREATE TYPE "attendance_status" AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "student_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "section_id" uuid NOT NULL REFERENCES "sections"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "status" attendance_status NOT NULL,
  "note" text,
  "marked_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "stu_att_unique" ON "student_attendance"("student_id","date");
CREATE INDEX IF NOT EXISTS "stu_att_tenant_idx" ON "student_attendance"("tenant_id");
CREATE INDEX IF NOT EXISTS "stu_att_section_date_idx" ON "student_attendance"("section_id","date");

CREATE TABLE IF NOT EXISTS "employee_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "status" attendance_status NOT NULL,
  "check_in" text,
  "check_out" text,
  "note" text,
  "marked_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "emp_att_unique" ON "employee_attendance"("teacher_id","date");
CREATE INDEX IF NOT EXISTS "emp_att_tenant_idx" ON "employee_attendance"("tenant_id");
CREATE INDEX IF NOT EXISTS "emp_att_date_idx" ON "employee_attendance"("date");
