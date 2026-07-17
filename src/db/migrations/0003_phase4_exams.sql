-- Phase 4: Grade scales, Exams, Exam Subjects, Marks

CREATE TABLE IF NOT EXISTS "grade_scales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "grade_scales_tenant_idx" ON "grade_scales"("tenant_id");

CREATE TABLE IF NOT EXISTS "grades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "scale_id" uuid NOT NULL REFERENCES "grade_scales"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "min_percent" integer NOT NULL,
  "max_percent" integer NOT NULL,
  "gpa" text,
  "remark" text
);
CREATE INDEX IF NOT EXISTS "grades_scale_idx" ON "grades"("scale_id");
CREATE INDEX IF NOT EXISTS "grades_tenant_idx" ON "grades"("tenant_id");

CREATE TABLE IF NOT EXISTS "exams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE SET NULL,
  "grade_scale_id" uuid REFERENCES "grade_scales"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "term" text,
  "starts_on" text,
  "ends_on" text,
  "is_published" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "exams_tenant_idx" ON "exams"("tenant_id");

CREATE TABLE IF NOT EXISTS "exam_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "max_marks" integer NOT NULL DEFAULT 100,
  "pass_marks" integer NOT NULL DEFAULT 35,
  "exam_date" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_subjects_unique" ON "exam_subjects"("exam_id","class_id","subject_id");
CREATE INDEX IF NOT EXISTS "exam_subjects_tenant_idx" ON "exam_subjects"("tenant_id");
CREATE INDEX IF NOT EXISTS "exam_subjects_exam_idx" ON "exam_subjects"("exam_id");

CREATE TABLE IF NOT EXISTS "marks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "exam_subject_id" uuid NOT NULL REFERENCES "exam_subjects"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "marks_obtained" integer,
  "is_absent" boolean NOT NULL DEFAULT false,
  "remark" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "marks_unique" ON "marks"("exam_subject_id","student_id");
CREATE INDEX IF NOT EXISTS "marks_tenant_idx" ON "marks"("tenant_id");
CREATE INDEX IF NOT EXISTS "marks_student_idx" ON "marks"("student_id");
