import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // P3.19 (audit 2026-05-26): admin /admin/audit-log queries by
  // action, entity_type, created_at, user_id — alla saknade index.
  // Pre-push fix 2026-05-26: matcha SQL-migrationen 0011 som har
  // created_at DESC. Annars producerar drizzle-kit diff-migrationer
  // som vill ändra indexet i framtiden.
  (table) => [
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_entity_type_idx").on(table.entityType),
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_user_id_idx").on(table.userId),
  ]
);
