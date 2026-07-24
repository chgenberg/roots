-- Scout fix 2026-05-26 (Migration 0012)
--
-- Två integritets-/prestandapatches efter pre-prod scout-rundan:
--
--  1. sessions.user_id saknade FK-constraint till users.id sedan
--     0000-tabellen skapades. Idag är det ofarligt eftersom vi gör
--     soft-delete (deletedAt) av users — men en hard delete eller
--     manuell DELETE FROM users skulle lämna orphan-rader. Vi rensar
--     orphans försiktigt och lägger constraint med ON DELETE CASCADE
--     (en raderad användares sessioner ska försvinna med).
--
--  2. /admin/audit-log filtrerar via (action LIKE prefix) +
--     entity_type + created_at-range. 0011 lade single-column
--     indexes på dessa, vilket räcker för små tabeller — men när
--     audit_logs växer >100k rader behöver vi composite-index för
--     att slippa stora index-scan + heap-join. Vi lägger composite
--     (entity_type, created_at DESC) som täcker de vanligaste
--     filtreringarna och paginering.
--
-- ⚠️ Båda CREATE INDEX körs UTAN CONCURRENTLY (Drizzle wrap:ar
-- migration i transaction). Om audit_logs är stor i prod: kör
-- migrationen manuellt med CONCURRENTLY enligt 0011s instruktioner.

-- 1) sessions.user_id FK
-- Rensa eventuella orphans (sessions vars user_id inte längre finns)
-- innan vi lägger constraint, annars failar ALTER TABLE.
DELETE FROM "sessions"
WHERE "user_id" NOT IN (SELECT "id" FROM "users");

-- DO-block så att satsen är idempotent (constraints saknar IF NOT EXISTS före
-- pg 17). Samma mönster som 0002/0003. Utan skyddet failar hela migrations-
-- transaktionen med 42710 i en miljö där constraintet redan finns — t.ex. en
-- databas som provisionerats med `drizzle-kit push`, där schema/sessions.ts
-- redan deklarerar .references().
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sessions_user_id_fk'
  ) THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_user_id_fk"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE;
  END IF;
END$$;

-- 2) audit_logs composite index för admin-vyn
CREATE INDEX IF NOT EXISTS "audit_logs_entity_created_idx"
  ON "audit_logs" ("entity_type", "created_at" DESC);
