-- Återbetalning via Stripe från portalen, och flagga på utbetalningar som
-- behöver regleras för hand. Bara tillägg: nya kolumner har default eller är
-- nullable, så en äldre version av koden kan köra mot samma databas.
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "refunded_ore" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "refunded_shipping_ore" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_order_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "customer_orders"("id"),
  "request_id" varchar(64) NOT NULL,
  "amount_ore" integer NOT NULL,
  "shipping_ore" integer DEFAULT 0 NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(16) DEFAULT 'PENDING' NOT NULL,
  "stripe_refund_id" varchar(255),
  "failure_message" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "created_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_order_refunds_order_id_idx" ON "customer_order_refunds" ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_order_refunds_request_id_uniq" ON "customer_order_refunds" ("request_id");
--> statement-breakpoint
-- Högst ett oavslutat försök per order. Databasen håller regeln även om
-- låset i Redis skulle fallera.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_order_refunds_one_pending_uniq" ON "customer_order_refunds" ("order_id") WHERE "status" = 'PENDING';
--> statement-breakpoint
-- En återbetalning hos Stripe kan bara bokföras en gång.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_order_refunds_stripe_refund_uniq" ON "customer_order_refunds" ("stripe_refund_id") WHERE "stripe_refund_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "review_required_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "review_resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "review_resolved_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "review_note" text;
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "review_resolved_team_share_ore" integer;
