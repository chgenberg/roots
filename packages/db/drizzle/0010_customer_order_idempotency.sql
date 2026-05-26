-- P2.13 + P2.17 (audit 2026-05-26): hård idempotens på
-- /v1/checkout/create samt server-sided dedup av
-- order-confirmation-mail över processgränser.
--
-- 1) idempotency_key + unique index så två POST /create med samma
--    nyckel inte spawnar två orders → vi UPSERT:ar i koden via
--    returning() och kollar att raden vi får tillbaka är vår egen.
-- 2) confirmation_email_sent_at — atomisk dedup. Tidigare lades en
--    in-memory Set per-instance; två API-replicas + race på
--    webhook/poll skickade dubbla mail.
--
-- Båda nullable så befintliga rader fortsätter validera utan backfill.

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120),
  ADD COLUMN IF NOT EXISTS "confirmation_email_sent_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_orders_idempotency_key_uniq"
  ON "customer_orders" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
