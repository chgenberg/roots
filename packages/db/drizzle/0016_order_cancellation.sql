-- Migration 0016 — avbokning och återbetalning av kundordrar
--
-- Bakgrund: customer_order_status har haft CANCELLED och REFUNDED sedan
-- första migrationen, men ingen kodväg satte dem någonsin. En order kunde
-- alltså aldrig avbokas eller återbetalas i produkten — den enda vägen ut
-- var FAILED, som checkout sätter när betalningen inte gick igenom.
--
-- Det är ett problem av två skäl. Dels går det inte att rätta en
-- felregistrerad manuell order annat än direkt i databasen. Dels räknas
-- statusarna i REVENUE_ORDER_STATUSES som intäkt, så en order som kunden
-- fått pengarna tillbaka för fortsatte ligga kvar i lagets förtjänst och i
-- underlaget för utbetalning.
--
-- Kolumnerna här gör avbokningen spårbar: vem, när och varför. Utan skäl
-- går det inte att i efterhand skilja "kunden ångrade sig" från "säljaren
-- skrev fel belopp", och det är just den skillnaden en revisor frågar om.

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid;
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint

-- Befintliga rader lämnas orörda: ingen order har avbokats via produkten,
-- så det finns ingen historik att backfilla. FAILED-ordrar räknas inte som
-- avbokade — de nådde aldrig fram till en betalning.
