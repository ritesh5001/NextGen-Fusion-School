-- Platform-level signing keypair used by the vendor deployment to issue
-- license keys directly from the admin panel. Single row (id = 1).
CREATE TABLE IF NOT EXISTS "platform_keys" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "private_key" text NOT NULL,
  "public_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "platform_keys_singleton" CHECK ("id" = 1)
);
