-- P3.19–3.22 (audit 2026-05-26): saknade index på tabeller som
-- queries regelbundet i admin- och portal-vyer. Alla CREATE INDEX
-- är IF NOT EXISTS och CONCURRENTLY-säkra inte krävs i denna repo
-- (migration körs sekventiellt vid deploy), men vi använder
-- IF NOT EXISTS för att migrationen ska vara idempotent.
--
-- VARNING (pre-push audit 2026-05-26):
--   Drizzles migrator wrap:ar varje migration i en transaction, så
--   CREATE INDEX CONCURRENTLY går INTE att använda här (Postgres
--   förbjuder concurrent index inside transaction blocks). Vid första
--   deploy mot en audit_logs-tabell med många rader (>100k) blockerar
--   detta INSERT/UPDATE/DELETE på audit_logs i några sekunder upp till
--   ett par minuter beroende på HW. API kan boota med ~30s extra
--   migration-tid men incoming requests som loggar audit kommer att
--   blockera tills indexet är klart.
--
--   Om audit_logs är stor i prod när detta deployas:
--     1. Kör migrationen off-peak.
--     2. ELLER skapa indexen manuellt CONCURRENTLY först:
--          CREATE INDEX CONCURRENTLY "audit_logs_action_idx" ON ...;
--        så blir CREATE INDEX IF NOT EXISTS här en no-op.
--
-- 3.19: audit_logs filtreras på action + entity_type + created_at;
--       admin GET /admin/audit-log gör full-table-scan idag.
-- 3.20: order_lines.order_id används i /portal/statistics-joins men
--       saknar index (customer_order_lines har det).
-- 3.21: customer_orders filtreras ofta (org_id, status, created_at)
--       samtidigt — single-column index hjälper bara delvis.
-- 3.22: orders.invoice_status filtreras i /portal/income-queries.

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
  ON "audit_logs" ("action");

CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx"
  ON "audit_logs" ("entity_type");

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx"
  ON "audit_logs" ("user_id");

CREATE INDEX IF NOT EXISTS "order_lines_order_id_idx"
  ON "order_lines" ("order_id");

CREATE INDEX IF NOT EXISTS "customer_orders_org_status_created_idx"
  ON "customer_orders" ("org_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "orders_invoice_status_idx"
  ON "orders" ("invoice_status");
