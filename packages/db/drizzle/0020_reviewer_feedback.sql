-- Isolated feedback chat for feedback@roots.nu. Prompts land in the
-- INTERNAL_ADMIN inbox. Screenshots live in Postgres so Railway deploys
-- do not lose them on ephemeral disk.
CREATE TABLE IF NOT EXISTS "reviewer_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) DEFAULT '' NOT NULL,
  "status" varchar(32) DEFAULT 'gathering' NOT NULL,
  "cursor_prompt" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "reviewer_threads"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "image_urls" text DEFAULT '[]' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content_type" varchar(64) NOT NULL,
  "bytes" bytea NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_threads_user_updated_idx"
  ON "reviewer_threads" ("user_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_threads_status_updated_idx"
  ON "reviewer_threads" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_messages_thread_created_idx"
  ON "reviewer_messages" ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_media_user_idx"
  ON "reviewer_media" ("user_id");
