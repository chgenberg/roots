import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description").notNull().default(""),
  priceOre: integer("price_ore").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("SEK"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description").notNull().default(""),
  priceOre: integer("price_ore").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bundleProducts = pgTable("bundle_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id")
    .notNull()
    .references(() => bundles.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
});
