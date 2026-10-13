-- Intresseanmälans steg 2 och spårning. Steg 2 kopplar raden till en
-- lead i organizations så att säljare ser kontaktuppgifterna.
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "first_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "last_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "organisation" varchar(255);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "tracking" text;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_signups_organization_id_idx"
  ON "waitlist_signups" ("organization_id");
