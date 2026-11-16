-- Från betald order till lagret: när ordern blev betald, avstämning mot
-- Stripe och sändningar till lagret. Bara tillägg (nullable kolumner och en
-- ny tabell), så en äldre version av koden kan köra mot samma databas.
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "sent_to_warehouse_at" timestamp;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "warehouse_batch_id" uuid;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "reconciled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "reconcile_status" varchar(24);
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD COLUMN IF NOT EXISTS "reconcile_note" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouse_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "number" serial NOT NULL,
  "order_count" integer DEFAULT 0 NOT NULL,
  "provider" varchar(32) DEFAULT 'manual-file' NOT NULL,
  "external_ref" varchar(255),
  "note" text,
  "created_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_orders_warehouse_batch_idx" ON "customer_orders" ("warehouse_batch_id");
--> statement-breakpoint
-- Befintliga betalda ordrar får tidpunkten från audit-loggen när den finns,
-- annars från när ordern skapades. Rör bara den nya kolumnen.
UPDATE "customer_orders" o
SET "paid_at" = COALESCE(
  (SELECT MIN(a."created_at") FROM "audit_logs" a
    WHERE a."action" = 'order.paid' AND a."entity_id" = o."id"),
  o."created_at"
)
WHERE o."paid_at" IS NULL
  AND o."status" IN ('PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'REFUNDED');
