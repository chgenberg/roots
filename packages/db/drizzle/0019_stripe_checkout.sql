-- Migration 0019 — Stripe ersätter Klarna som checkout
--
-- Historiska ordrar behåller payment_method = KLARNA och klarna_order_id.
-- Nya ordrar får STRIPE + stripe_checkout_session_id. Enumen utökas;
-- KLARNA tas inte bort så gamla rader fortsätter att läsas.

DO $$ BEGIN
  ALTER TYPE "customer_payment_method" ADD VALUE 'STRIPE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar(255);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_orders_stripe_session_idx"
  ON "customer_orders" ("stripe_checkout_session_id");
