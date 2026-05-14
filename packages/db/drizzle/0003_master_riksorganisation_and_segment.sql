-- Masterdata v1 — `master_riksorganisation` + `master_segment` tables and
-- FK wiring from `organizations.riksorganisation_id` / `organizations.segment_id`.
--
-- See: docs/feedback-plans/01-master-data/01_riksorganisation_table.txt
-- See: docs/feedback-plans/01-master-data/02_segment_table.txt
-- See: docs/feedback-plans/MASTER_IMPLEMENTATION_SYNTHESIS.txt §6, §14.2
--
-- Additive, idempotent. Safe to run on prod. Safe to re-run.
-- No existing code reads from these tables yet; FK columns on `organizations`
-- are nullable and have been there since migration 0002.

CREATE TABLE IF NOT EXISTS "master_riksorganisation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(64) NOT NULL,
  "type" varchar(50),
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "master_riksorganisation_name_unique" UNIQUE("name"),
  CONSTRAINT "master_riksorganisation_code_unique" UNIQUE("code")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "master_riksorganisation_active_sort_idx"
  ON "master_riksorganisation" ("active", "sort_order");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "master_segment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "riksorganisation_id" uuid NOT NULL
    REFERENCES "master_riksorganisation"("id") ON DELETE RESTRICT,
  "name" varchar(255) NOT NULL,
  "code" varchar(64) NOT NULL,
  "type" varchar(50),
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "master_segment_riks_name_uq"
  ON "master_segment" ("riksorganisation_id", "name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "master_segment_riks_code_uq"
  ON "master_segment" ("riksorganisation_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_segment_active_idx"
  ON "master_segment" ("active");
--> statement-breakpoint

-- Wire up FK from organizations to master_* now that the targets exist.
-- Idempotent via pg_constraint lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'organizations_riksorganisation_id_fk'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_riksorganisation_id_fk"
      FOREIGN KEY ("riksorganisation_id")
      REFERENCES "master_riksorganisation"("id")
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'organizations_segment_id_fk'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_segment_id_fk"
      FOREIGN KEY ("segment_id")
      REFERENCES "master_segment"("id")
      ON DELETE SET NULL;
  END IF;
END$$;
