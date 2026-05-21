-- Pre-launch waitlist for the password gate.
-- Keeping one row per email (unique constraint) so the export to the
-- launch announcement mailing tool is dedupable without a GROUP BY.

CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255),
  "source" varchar(64) NOT NULL DEFAULT 'preview-gate',
  "ip_address" varchar(45),
  "user_agent" varchar(512),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "waitlist_signups_created_at_idx"
  ON "waitlist_signups" ("created_at");
