-- Minor-protection columns on users and public-profile privacy columns on sellers.
-- Additive only; no existing rows are modified. Safe to run on prod.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birth_year" integer,
  ADD COLUMN IF NOT EXISTS "guardian_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "guardian_consent_at" timestamp;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "users_guardian_idx" ON "users" ("guardian_user_id");
--> statement-breakpoint

ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "public_alias" varchar(80),
  ADD COLUMN IF NOT EXISTS "hide_from_leaderboard" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "personal_message" text;
