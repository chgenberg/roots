-- MASTERPLAN_01 KC1.5: payout PAID-metadata.
--
-- Tidigare hade payouts bara status-enum {PENDING, INVOICED, PAID} men
-- ingen kolumn för NÄR / AV VEM / MED VILKEN REFERENS övergången skedde.
-- Det gjorde det omöjligt att svara på en föreningens "när betalades vi?"
-- utan att gräva i audit_logs.
--
-- Alla tre kolumner är nullable så historiska rader fortsätter fungera —
-- inga backfill-jobb behövs. När PATCH /v1/payouts/:id/status flippar
-- till PAID skrivs alla tre samtidigt.

ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp,
  ADD COLUMN IF NOT EXISTS "paid_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "payment_reference" varchar(64);
