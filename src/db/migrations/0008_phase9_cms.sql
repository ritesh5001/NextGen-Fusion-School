-- Phase 9: Public Website / CMS

CREATE TABLE IF NOT EXISTS "site_meta" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "hero_title" text,
  "hero_subtitle" text,
  "hero_image_url" text,
  "about_html" text,
  "mission_html" text,
  "vision_html" text,
  "footer_text" text,
  "logo_url" text,
  "favicon_url" text,
  "contact_email" text,
  "contact_phone" text,
  "contact_address" text,
  "map_embed" text,
  "social_facebook" text,
  "social_instagram" text,
  "social_twitter" text,
  "social_youtube" text,
  "social_linkedin" text,
  "google_analytics_id" text,
  "language" text NOT NULL DEFAULT 'en',
  "is_published" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "site_sliders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "subtitle" text,
  "image_url" text NOT NULL,
  "cta_label" text,
  "cta_url" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "site_sliders_tenant_idx" ON "site_sliders" ("tenant_id");

CREATE TABLE IF NOT EXISTS "site_testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "author_role" text,
  "quote" text NOT NULL,
  "avatar_url" text,
  "rating" integer NOT NULL DEFAULT 5,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "site_testimonials_tenant_idx" ON "site_testimonials" ("tenant_id");

CREATE TABLE IF NOT EXISTS "site_gallery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text,
  "image_url" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "site_gallery_tenant_idx" ON "site_gallery" ("tenant_id");

CREATE TABLE IF NOT EXISTS "site_faqs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "site_faqs_tenant_idx" ON "site_faqs" ("tenant_id");

CREATE TABLE IF NOT EXISTS "site_timeline" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "year_label" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "site_timeline_tenant_idx" ON "site_timeline" ("tenant_id");

CREATE TABLE IF NOT EXISTS "contact_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "subject" text,
  "message" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "contact_messages_tenant_idx" ON "contact_messages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "contact_messages_read_idx" ON "contact_messages" ("is_read");

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_tenant_email_uniq" ON "newsletter_subscribers" ("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "newsletter_tenant_idx" ON "newsletter_subscribers" ("tenant_id");
