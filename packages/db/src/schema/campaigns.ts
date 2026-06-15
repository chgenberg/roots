import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  date,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "ACTIVE",
  "ENDED",
  "SETTLED",
]);

export const campaignGoalTypeEnum = pgEnum("campaign_goal_type", [
  "AMOUNT",
  "PACKAGES",
]);

export const deliveryTypeEnum = pgEnum("delivery_type", [
  "BULK",
  "DIRECT",
  "BOTH",
]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description").notNull().default(""),
    story: text("story").notNull().default(""),
    status: campaignStatusEnum("status").notNull().default("DRAFT"),
    goalType: campaignGoalTypeEnum("goal_type").notNull().default("AMOUNT"),
    goalValue: integer("goal_value").notNull().default(0),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    // Säljperiod-styrning. När `allowSalesOutsidePeriod` är false blockeras
    // checkout helt utanför start/end (föreningens "man kan inte sälja
    // mellan perioderna"). När den är true accepteras ordrar utanför
    // perioden men flaggas `countsTowardStats=false` så de inte räknas i
    // topplistor/statistik ("försäljningen kan alltid pågå").
    allowSalesOutsidePeriod: boolean("allow_sales_outside_period")
      .notNull()
      .default(true),
    // Datum då de samlade produkterna skickas till klubben (BULK-leverans).
    // Visas i förenings-/säljkalendern. Nullable för äldre kampanjer.
    deliveryDate: date("delivery_date"),
    deliveryType: deliveryTypeEnum("delivery_type").notNull().default("BULK"),
    shippingThresholdOre: integer("shipping_threshold_ore").default(0),
    shippingFeeOre: integer("shipping_fee_ore").default(4900),
    marginPercent: integer("margin_percent").notNull().default(25),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("campaigns_org_id_idx").on(table.orgId),
    index("campaigns_status_idx").on(table.status),
  ]
);
