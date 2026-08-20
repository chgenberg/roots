-- Migration 0020 — sätt STRIPE som default payment_method
--
-- Postgres tillåter inte att ett nytt enum-värde används i samma transaktion
-- som det skapades (0019). Defaulten sätts därför i en egen migration
-- efter att ADD VALUE är committad.

ALTER TABLE "customer_orders"
  ALTER COLUMN "payment_method" SET DEFAULT 'STRIPE';
