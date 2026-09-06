import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const orchestratorCards = pgTable(
  "orchestrator_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 180 }).notNull().unique(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body").notNull().default(""),
    status: varchar("status", { length: 20 }).notNull().default("inbox"),
    domainId: varchar("domain_id", { length: 40 }).notNull(),
    playbook: varchar("playbook", { length: 80 }).notNull().default(""),
    gate: varchar("gate", { length: 20 }).notNull().default("none"),
    filesJson: text("files_json").notNull().default("[]"),
    source: varchar("source", { length: 20 }).notNull().default("heartbeat"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("orchestrator_cards_status_updated_idx").on(
      table.status,
      table.updatedAt
    ),
    index("orchestrator_cards_gate_status_idx").on(table.gate, table.status),
    index("orchestrator_cards_source_status_idx").on(table.source, table.status),
  ]
);

export const orchestratorRuns = pgTable(
  "orchestrator_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 40 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    summary: text("summary").notNull().default(""),
    findings: integer("findings").notNull().default(0),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("orchestrator_runs_kind_started_idx").on(table.kind, table.startedAt),
  ]
);
