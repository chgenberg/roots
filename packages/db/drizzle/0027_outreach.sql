-- Lead-mejlagenten: avsändare med mall, och föreningar att mejla.
CREATE TABLE IF NOT EXISTS "outreach_senders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" varchar(120) NOT NULL,
  "title" varchar(120) DEFAULT 'Föreningsrepresentant' NOT NULL,
  "phone" varchar(40),
  "email" varchar(255) NOT NULL,
  "subject_template" varchar(300) NOT NULL,
  "body_template" text NOT NULL,
  "daily_cap" integer DEFAULT 40 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sender_id" uuid NOT NULL REFERENCES "outreach_senders"("id") ON DELETE CASCADE,
  "org_name" varchar(200) NOT NULL,
  "contact_name" varchar(160),
  "email" varchar(255) NOT NULL,
  "website" varchar(300),
  "member_count" integer,
  "packages_per_member" integer DEFAULT 6 NOT NULL,
  "package_price_kr" integer DEFAULT 399 NOT NULL,
  "token" varchar(32) NOT NULL UNIQUE,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "subject_override" varchar(300),
  "body_override" text,
  "note" text,
  "approved_at" timestamp,
  "approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "sent_at" timestamp,
  "provider_id" varchar(120),
  "last_error" text,
  "proposal_open_count" integer DEFAULT 0 NOT NULL,
  "proposal_opened_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_leads_sender_email_idx"
  ON "outreach_leads" ("sender_id", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_leads_sender_status_idx"
  ON "outreach_leads" ("sender_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_leads_sent_at_idx"
  ON "outreach_leads" ("sent_at");
