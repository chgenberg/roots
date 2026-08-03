-- Migration 0018 — godkännande innan en förening kan ta emot publika pengar
--
-- `organizations.verified` har funnits sedan 0001 med default false, men
-- lästes inte på ett enda ställe i koden. Från och med nu är den spärren
-- mellan "har registrerat sig" och "kan ta emot betalningar från
-- allmänheten" (se apps/api/src/lib/org-approval.ts).
--
-- Det gör backfillen nedan nödvändig, och den är hela anledningen till att
-- den här migrationen finns. Alla organisationer som existerar just nu har
-- kommit in antingen via seed eller via en säljare hos oss, alltså efter en
-- mänsklig kontakt. Skulle vi låta dem behålla verified = false stängs
-- kassan för befintliga kunder i samma deploy som spärren rullas ut — en
-- spärr som är tänkt att stoppa okänd part skulle i praktiken bara stoppa
-- de vi redan känner.
--
-- Nya självregistreringar får false och måste godkännas av en
-- INTERNAL_ADMIN via POST /v1/admin/organizations/:orgId/approve.

UPDATE "organizations"
SET "verified" = true
WHERE "verified" = false;
--> statement-breakpoint

-- Vem som godkände och när. Utan det går det inte att i efterhand svara på
-- frågan "vem släppte in den här föreningen", vilket är just det man vill
-- kunna svara på om en bluffkampanj ändå kommer igenom.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
--> statement-breakpoint

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "verified_by_user_id" uuid;
--> statement-breakpoint

-- Befintliga rader får verified_at = NULL: de godkändes aldrig genom
-- flödet, de fanns före det. Att sätta ett påhittat datum hade sett ut som
-- ett granskningsbeslut som ingen fattat.

CREATE INDEX IF NOT EXISTS "organizations_verified_idx"
  ON "organizations" ("verified");
