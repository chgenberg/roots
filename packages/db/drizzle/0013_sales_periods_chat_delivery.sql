-- Migration 0013 — Säljperioder, leveransspårning, betalmetod, chatt & manuella ordrar
--
-- Täcker säljarflödes-utökningen (2026-06):
--   1. Kampanjer får periodstyrning (allow_sales_outside_period) och ett
--      leveransdatum till klubben (delivery_date).
--   2. customer_orders får:
--        - selected_payment_method: faktisk Klarna-instrument (swish/card/…)
--        - counts_toward_stats: räknas ordern i topplistor/statistik?
--        - is_manual + placed_by_user_id: order lagd av säljaren själv
--        - shipped_at / delivered_at: leveransspårning
--   3. Ny tabell team_messages: in-app-chatt lagledare ↔ säljare.
--
-- Alla nya kolumner är NULL-bara eller har DEFAULT så befintliga rader
-- fortsätter fungera oförändrat. Inga enum-ändringar (Swish modelleras
-- som en sträng i selected_payment_method, inte ett nytt enum-värde).

-- 1) Kampanj-periodstyrning + leveransdatum
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "allow_sales_outside_period" boolean NOT NULL DEFAULT true;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "delivery_date" date;

-- 2) customer_orders-utökningar
ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "selected_payment_method" varchar(40);

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "counts_toward_stats" boolean NOT NULL DEFAULT true;

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "is_manual" boolean NOT NULL DEFAULT false;

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "placed_by_user_id" uuid;

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "shipped_at" timestamp;

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;

-- 3) team_messages — in-app-chatt
CREATE TABLE IF NOT EXISTS "team_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "team_id" uuid NOT NULL REFERENCES "teams"("id"),
  "sender_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "recipient_seller_id" uuid REFERENCES "sellers"("id"),
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_messages_team_id_idx"
  ON "team_messages" ("team_id");
CREATE INDEX IF NOT EXISTS "team_messages_recipient_seller_id_idx"
  ON "team_messages" ("recipient_seller_id");
CREATE INDEX IF NOT EXISTS "team_messages_team_created_idx"
  ON "team_messages" ("team_id", "created_at" DESC);
