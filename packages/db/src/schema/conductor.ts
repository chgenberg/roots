import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const conductorDesks = pgTable(
  "conductor_desks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    blurb: text("blurb").notNull().default(""),
    briefing: text("briefing").notNull().default(""),
    refsJson: text("refs_json").notNull().default("[]"),
    accent: varchar("accent", { length: 20 }).notNull().default("ink"),
    portrait: integer("portrait"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("conductor_desks_created_idx").on(table.createdAt)]
);

export const conductorMessages = pgTable(
  "conductor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deskId: uuid("desk_id").references(() => conductorDesks.id, {
      onDelete: "cascade",
    }),
    thread: varchar("thread", { length: 20 }).notNull().default("desk"),
    role: varchar("role", { length: 16 }).notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conductor_messages_desk_created_idx").on(
      table.deskId,
      table.createdAt
    ),
    index("conductor_messages_thread_created_idx").on(
      table.thread,
      table.createdAt
    ),
  ]
);

export const conductorRules = pgTable(
  "conductor_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 80 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    trigger: varchar("trigger", { length: 80 }).notNull(),
    filterJson: text("filter_json").notNull().default("{}"),
    action: varchar("action", { length: 40 }).notNull(),
    actionJson: text("action_json").notNull().default("{}"),
    gate: varchar("gate", { length: 20 }).notNull().default("none"),
    approvedAt: timestamp("approved_at"),
    createdBy: varchar("created_by", { length: 80 }).notNull().default(""),
    lastRanAt: timestamp("last_ran_at"),
    cadence: varchar("cadence", { length: 20 }).notNull().default("always"),
    lastLookedAt: timestamp("last_looked_at"),
    deskId: uuid("desk_id").references(() => conductorDesks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("conductor_rules_enabled_trigger_idx").on(
      table.enabled,
      table.trigger
    ),
    index("conductor_rules_desk_idx").on(table.deskId),
  ]
);

export const conductorJobs = pgTable(
  "conductor_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 240 }).notNull().unique(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => conductorRules.id, { onDelete: "cascade" }),
    entityId: varchar("entity_id", { length: 80 }).notNull(),
    event: varchar("event", { length: 80 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    payload: text("payload").notNull().default("{}"),
    ranAt: timestamp("ran_at"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("conductor_jobs_status_created_idx").on(table.status, table.createdAt),
    index("conductor_jobs_rule_idx").on(table.ruleId),
  ]
);

export const conductorTraces = pgTable(
  "conductor_traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deskId: uuid("desk_id"),
    deskKey: varchar("desk_key", { length: 80 }).notNull().default(""),
    deskName: varchar("desk_name", { length: 80 }).notNull().default(""),
    model: varchar("model", { length: 80 }).notNull().default(""),
    tokens: integer("tokens").notNull().default(0),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    gate: varchar("gate", { length: 20 }).notNull().default("none"),
    outcome: varchar("outcome", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conductor_traces_created_idx").on(table.createdAt),
    index("conductor_traces_desk_created_idx").on(table.deskId, table.createdAt),
  ]
);
