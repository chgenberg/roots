-- Anställda i ringen. Hands kör aldrig irreversible/deploy från de här raderna.
CREATE TABLE IF NOT EXISTS "conductor_desks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(80) NOT NULL,
  "name" varchar(80) NOT NULL,
  "blurb" text DEFAULT '' NOT NULL,
  "briefing" text DEFAULT '' NOT NULL,
  "refs_json" text DEFAULT '[]' NOT NULL,
  "accent" varchar(20) DEFAULT 'ink' NOT NULL,
  "portrait" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conductor_desks_key_unique"
  ON "conductor_desks" ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_desks_created_idx"
  ON "conductor_desks" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conductor_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "desk_id" uuid,
  "thread" varchar(20) DEFAULT 'desk' NOT NULL,
  "role" varchar(16) NOT NULL,
  "text" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_messages_desk_created_idx"
  ON "conductor_messages" ("desk_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_messages_thread_created_idx"
  ON "conductor_messages" ("thread", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conductor_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(80) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "trigger" varchar(80) NOT NULL,
  "filter_json" text DEFAULT '{}' NOT NULL,
  "action" varchar(40) NOT NULL,
  "action_json" text DEFAULT '{}' NOT NULL,
  "gate" varchar(20) DEFAULT 'none' NOT NULL,
  "approved_at" timestamp,
  "created_by" varchar(80) DEFAULT '' NOT NULL,
  "last_ran_at" timestamp,
  "cadence" varchar(20) DEFAULT 'always' NOT NULL,
  "last_looked_at" timestamp,
  "desk_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_rules_enabled_trigger_idx"
  ON "conductor_rules" ("enabled", "trigger");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_rules_desk_idx"
  ON "conductor_rules" ("desk_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conductor_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(240) NOT NULL,
  "rule_id" uuid NOT NULL,
  "entity_id" varchar(80) NOT NULL,
  "event" varchar(80) NOT NULL,
  "status" varchar(20) DEFAULT 'queued' NOT NULL,
  "payload" text DEFAULT '{}' NOT NULL,
  "ran_at" timestamp,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conductor_jobs_key_unique"
  ON "conductor_jobs" ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_jobs_status_created_idx"
  ON "conductor_jobs" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_jobs_rule_idx"
  ON "conductor_jobs" ("rule_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conductor_traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "desk_id" uuid,
  "desk_key" varchar(80) DEFAULT '' NOT NULL,
  "desk_name" varchar(80) DEFAULT '' NOT NULL,
  "model" varchar(80) DEFAULT '' NOT NULL,
  "tokens" integer DEFAULT 0 NOT NULL,
  "purpose" varchar(20) NOT NULL,
  "gate" varchar(20) DEFAULT 'none' NOT NULL,
  "outcome" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_traces_created_idx"
  ON "conductor_traces" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conductor_traces_desk_created_idx"
  ON "conductor_traces" ("desk_id", "created_at");
--> statement-breakpoint
ALTER TABLE "conductor_messages"
  ADD CONSTRAINT "conductor_messages_desk_id_conductor_desks_id_fk"
  FOREIGN KEY ("desk_id") REFERENCES "conductor_desks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conductor_rules"
  ADD CONSTRAINT "conductor_rules_desk_id_conductor_desks_id_fk"
  FOREIGN KEY ("desk_id") REFERENCES "conductor_desks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conductor_jobs"
  ADD CONSTRAINT "conductor_jobs_rule_id_conductor_rules_id_fk"
  FOREIGN KEY ("rule_id") REFERENCES "conductor_rules"("id") ON DELETE cascade ON UPDATE no action;
