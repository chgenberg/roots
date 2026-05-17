-- Connection-audit P1 #13: the Drizzle schema declares these indexes but
-- the auto-generated SQL never emitted them, so production has been
-- running full-table scans on every join path that touches user.org_id,
-- order.org_id, order.user_id, quote.org_id, quote.sales_rep_id and the
-- session expiry sweeper. We re-add them with IF NOT EXISTS so this is
-- safe to run against any environment, including the prod DB that may
-- already have them via a manual psql session.

CREATE INDEX IF NOT EXISTS "users_org_id_idx"
  ON "users" ("org_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "orders_org_id_idx"
  ON "orders" ("org_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "orders_user_id_idx"
  ON "orders" ("user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quotes_org_id_idx"
  ON "quotes" ("org_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quotes_sales_rep_id_idx"
  ON "quotes" ("sales_rep_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx"
  ON "sessions" ("expires_at");
