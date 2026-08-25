import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { users } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const reviewerThreads = pgTable(
  "reviewer_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull().default(""),
    status: varchar("status", { length: 32 }).notNull().default("gathering"),
    cursorPrompt: text("cursor_prompt").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("reviewer_threads_user_updated_idx").on(table.userId, table.updatedAt),
    index("reviewer_threads_status_updated_idx").on(table.status, table.updatedAt),
  ]
);

export const reviewerMessages = pgTable(
  "reviewer_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => reviewerThreads.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    body: text("body").notNull().default(""),
    imageUrls: text("image_urls").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("reviewer_messages_thread_created_idx").on(table.threadId, table.createdAt)]
);

export const reviewerMedia = pgTable(
  "reviewer_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    bytes: bytea("bytes").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("reviewer_media_user_idx").on(table.userId)]
);
