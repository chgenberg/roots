import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { products } from "./products";

export const campaignProducts = pgTable(
  "campaign_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    customPriceOre: integer("custom_price_ore"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("campaign_products_campaign_product_idx").on(
      table.campaignId,
      table.productId
    ),
    index("campaign_products_campaign_id_idx").on(table.campaignId),
  ]
);
