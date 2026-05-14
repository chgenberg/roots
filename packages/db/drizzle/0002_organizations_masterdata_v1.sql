-- Masterdata v1 (Fas 1) — organizations columns
-- See: docs/feedback-plans/01-master-data/03_organization_upgrade.txt
-- See: docs/feedback-plans/MASTER_IMPLEMENTATION_SYNTHESIS.txt §6, §14.2
--
-- Strictly additive, idempotent, zero data rewrite. All columns are NULLABLE so
-- existing inserts/selects work unchanged. Consumers must gate reads/writes on
-- these columns behind `flags.newOrgHierarchy(orgId)` until backfill + UI parity
-- is complete (synthesis §13.4 "expand/contract").
--
-- Safe to run on prod at any time. Safe to re-run.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "display_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "normalized_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "organization_type" varchar(40),
  ADD COLUMN IF NOT EXISTS "riksorganisation_id" uuid,
  ADD COLUMN IF NOT EXISTS "segment_id" uuid,
  ADD COLUMN IF NOT EXISTS "municipality" varchar(120),
  ADD COLUMN IF NOT EXISTS "region" varchar(120),
  ADD COLUMN IF NOT EXISTS "postal_code" varchar(16),
  ADD COLUMN IF NOT EXISTS "website" varchar(255),
  ADD COLUMN IF NOT EXISTS "crm_status" varchar(40),
  ADD COLUMN IF NOT EXISTS "lead_source" varchar(40),
  ADD COLUMN IF NOT EXISTS "potential_score" integer,
  ADD COLUMN IF NOT EXISTS "assigned_asm_user_id" uuid;
--> statement-breakpoint

-- Indexes are created CONCURRENTLY-free here since the table is small in dev/
-- staging; in prod, switch to `CREATE INDEX CONCURRENTLY` when running outside
-- a transaction (synthesis §14.2). Drizzle's migrator wraps statements in a
-- transaction by default; for the prod rollout, run this migration via psql
-- with `--set ON_ERROR_STOP=on` and split into per-index `CONCURRENTLY` calls.
CREATE INDEX IF NOT EXISTS "organizations_normalized_name_idx"
  ON "organizations" ("normalized_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_assigned_asm_user_id_idx"
  ON "organizations" ("assigned_asm_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_crm_status_idx"
  ON "organizations" ("crm_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_segment_id_idx"
  ON "organizations" ("segment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_riksorganisation_id_idx"
  ON "organizations" ("riksorganisation_id");
--> statement-breakpoint

-- assigned_asm_user_id → users(id), ON DELETE SET NULL so an ASM leaving the
-- platform doesn't cascade-orphan their org rows. Wrapped in a DO block so the
-- migration is idempotent (no IF NOT EXISTS on constraints in pg < 17).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'organizations_assigned_asm_user_id_fk'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_assigned_asm_user_id_fk"
      FOREIGN KEY ("assigned_asm_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END$$;
