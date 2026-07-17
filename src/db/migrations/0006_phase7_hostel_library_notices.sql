-- Phase 7 — Hostel, Library, Notices, Calendar

CREATE TYPE "hostel_type" AS ENUM ('boys','girls','mixed');
CREATE TYPE "allocation_status" AS ENUM ('active','vacated');
CREATE TYPE "borrower_type" AS ENUM ('student','employee');
CREATE TYPE "issue_status" AS ENUM ('issued','returned','overdue','lost');
CREATE TYPE "event_type" AS ENUM ('holiday','exam','event','meeting','other');

CREATE TABLE "hostels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" "hostel_type" NOT NULL DEFAULT 'boys',
  "address" text,
  "warden_name" text,
  "warden_phone" text,
  "capacity" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "hostels_tenant_idx" ON "hostels"("tenant_id");

CREATE TABLE "hostel_rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "hostel_id" uuid NOT NULL REFERENCES "hostels"("id") ON DELETE CASCADE,
  "room_no" text NOT NULL,
  "floor" text,
  "capacity" integer NOT NULL DEFAULT 1,
  "monthly_rent" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "hostel_room_uniq" ON "hostel_rooms"("hostel_id","room_no");
CREATE INDEX "hostel_rooms_tenant_idx" ON "hostel_rooms"("tenant_id");

CREATE TABLE "hostel_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "room_id" uuid NOT NULL REFERENCES "hostel_rooms"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "allocated_on" text NOT NULL,
  "vacated_on" text,
  "status" "allocation_status" NOT NULL DEFAULT 'active',
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "hostel_alloc_tenant_idx" ON "hostel_allocations"("tenant_id");
CREATE INDEX "hostel_alloc_room_idx" ON "hostel_allocations"("room_id");
CREATE INDEX "hostel_alloc_student_idx" ON "hostel_allocations"("student_id");

CREATE TABLE "books" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "author" text,
  "isbn" text,
  "category" text,
  "publisher" text,
  "edition" text,
  "total_copies" integer NOT NULL DEFAULT 1,
  "available_copies" integer NOT NULL DEFAULT 1,
  "rack_no" text,
  "daily_fine" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "books_tenant_idx" ON "books"("tenant_id");
CREATE INDEX "books_title_idx" ON "books"("title");

CREATE TABLE "book_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "book_id" uuid NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
  "borrower_type" "borrower_type" NOT NULL,
  "student_id" uuid REFERENCES "students"("id") ON DELETE SET NULL,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "issued_on" text NOT NULL,
  "due_date" text NOT NULL,
  "returned_on" text,
  "fine_amount" integer NOT NULL DEFAULT 0,
  "fine_collected" integer NOT NULL DEFAULT 0,
  "status" "issue_status" NOT NULL DEFAULT 'issued',
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "book_issues_tenant_idx" ON "book_issues"("tenant_id");
CREATE INDEX "book_issues_book_idx" ON "book_issues"("book_id");
CREATE INDEX "book_issues_status_idx" ON "book_issues"("status");

CREATE TABLE "notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "audience" text NOT NULL DEFAULT 'all',
  "publish_from" text,
  "publish_to" text,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "is_published" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "notices_tenant_idx" ON "notices"("tenant_id");

CREATE TABLE "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "is_all_day" boolean NOT NULL DEFAULT true,
  "type" "event_type" NOT NULL DEFAULT 'event',
  "color" text,
  "location" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "cal_events_tenant_idx" ON "calendar_events"("tenant_id");
CREATE INDEX "cal_events_start_idx" ON "calendar_events"("start_date");
