-- Migration 0015 — pengavägen och samtycken
--
-- Bakgrund (platform-audit 2026-08-03): utan Klarna är den manuella
-- orderingången den enda vägen pengar rör sig, och den var samtidigt den
-- minst skyddade delen av systemet. Den här migrationen lägger grunden för:
--
--   1. Fryst marginal per order. Avräkningen räknade om team-andelen med
--      kampanjens NUVARANDE marginal, så en ändring i efterhand flyttade
--      pengar på redan gjord försäljning.
--   2. Verifiering av manuella ordrar. En manuell order skrevs som PAID
--      direkt och gick rakt in i avräkningen — ett kapat säljarkonto kunde
--      blåsa upp en riktig utbetalning.
--   3. Villkorsgodkännande på ordern. Kryssrutan i kassan fanns men sparades
--      aldrig, så vi kunde inte visa vad kunden godkände.
--   4. Målsmanssamtycke. Kolumnerna på users fanns sedan 0001 men saknade
--      fält för vem som samtyckt och när.
--   5. Retention på hair-analysis-leads (index för purge-jobbet).
--
-- Allt är additivt med DEFAULT/NULL så befintliga rader fortsätter fungera.

-- 1) Fryst marginal per order ─────────────────────────────────────────
ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "margin_percent_at_sale" integer;
--> statement-breakpoint

-- Backfill: befintliga ordrar får kampanjens nuvarande marginal, vilket är
-- exakt det avräkningen redan använder. Ingen historik ändras.
UPDATE "customer_orders" o
   SET "margin_percent_at_sale" = c."margin_percent"
  FROM "campaigns" c
 WHERE o."campaign_id" = c."id"
   AND o."margin_percent_at_sale" IS NULL;
--> statement-breakpoint

-- 2) Verifiering av manuella ordrar ───────────────────────────────────
ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "verified_by_user_id" uuid;
--> statement-breakpoint

-- Befintliga manuella ordrar räknades redan in i tidigare avräkningar.
-- Vi markerar dem som verifierade så att historiska summor inte förändras
-- retroaktivt av den nya regeln.
UPDATE "customer_orders"
   SET "verified_at" = "created_at"
 WHERE "is_manual" = true
   AND "verified_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_orders_settlement_idx"
  ON "customer_orders" ("campaign_id", "team_id", "status");
--> statement-breakpoint

-- 3) Villkorsgodkännande ──────────────────────────────────────────────
ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "terms_version" varchar(40);
--> statement-breakpoint

-- 4) Målsmanssamtycke ─────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "guardian_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "guardian_email" varchar(255),
  ADD COLUMN IF NOT EXISTS "guardian_consent_ip" varchar(45),
  ADD COLUMN IF NOT EXISTS "guardian_consent_version" varchar(40);
--> statement-breakpoint

-- 5) Retention på hair-analysis-leads ─────────────────────────────────
CREATE INDEX IF NOT EXISTS "hair_analysis_leads_created_at_idx"
  ON "hair_analysis_leads" ("created_at");
