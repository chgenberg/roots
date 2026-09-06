-- Agent-OS tavla och pulskörningar. Hands skriver aldrig irreversible/deploy
-- från de här raderna. Cursor-historik lever kvar i workboard.json.
CREATE TABLE IF NOT EXISTS "orchestrator_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(180) NOT NULL,
  "title" varchar(240) NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "status" varchar(20) DEFAULT 'inbox' NOT NULL,
  "domain_id" varchar(40) NOT NULL,
  "playbook" varchar(80) DEFAULT '' NOT NULL,
  "gate" varchar(20) DEFAULT 'none' NOT NULL,
  "files_json" text DEFAULT '[]' NOT NULL,
  "source" varchar(20) DEFAULT 'heartbeat' NOT NULL,
  "approved_at" timestamp,
  "rejected_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orchestrator_cards_key_unique"
  ON "orchestrator_cards" ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orchestrator_cards_status_updated_idx"
  ON "orchestrator_cards" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orchestrator_cards_gate_status_idx"
  ON "orchestrator_cards" ("gate", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orchestrator_cards_source_status_idx"
  ON "orchestrator_cards" ("source", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orchestrator_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(40) NOT NULL,
  "status" varchar(20) NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "findings" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orchestrator_runs_kind_started_idx"
  ON "orchestrator_runs" ("kind", "started_at");
