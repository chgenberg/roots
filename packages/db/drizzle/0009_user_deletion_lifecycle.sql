-- MASTERPLAN_01 KC2.7: GDPR account-deletion lifecycle.
--
-- Modell:
--   1. Användaren begär radering          → deletion_requested_at sätts
--                                          + scheduled_deletion_at = now()+14d
--   2. Inom 14 dagar kan användaren ångra → fälten nollas
--   3. Efter scheduled_deletion_at        → worker anonymiserar PII
--                                          + sätter deleted_at
--   4. Email/orgnr-historik bevaras anonymiserat så bokföring + audit
--      fortsätter fungera (krävs av bokföringslagen 7 år).
--
-- Alla tre kolumner är nullable så befintliga rader fortsätter
-- validera utan backfill.
--
-- Index på scheduled_deletion_at så worker-pollen är O(1).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp,
  ADD COLUMN IF NOT EXISTS "scheduled_deletion_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

CREATE INDEX IF NOT EXISTS "users_scheduled_deletion_at_idx"
  ON "users" ("scheduled_deletion_at")
  WHERE "scheduled_deletion_at" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx"
  ON "users" ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;
