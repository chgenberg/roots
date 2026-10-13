-- Intresseanmälan: mobil, kundtyp, start/info och när policyn godkändes.
-- Nullbara så äldre e-postanmälningar ligger kvar orörda.
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "customer_type" varchar(32);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "intent" varchar(16);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "consent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
