-- Kontaktformuläret sparar varje meddelande, även när mejl är pausat.
CREATE TABLE IF NOT EXISTS "contact_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "subject" varchar(300) NOT NULL,
  "message" text NOT NULL,
  "locale" varchar(8) DEFAULT 'sv' NOT NULL,
  "emailed" boolean DEFAULT false NOT NULL,
  "handled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx"
  ON "contact_messages" ("created_at");
