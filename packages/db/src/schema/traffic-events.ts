/**
 * Anonym besöksstatistik för publika sidor: sidvisningar och klick.
 *
 * Inga cookies, ingen IP-adress, inget sessions- eller användar-id sparas —
 * en rad går inte att koppla till en person eller till andra rader. Därför
 * kräver insamlingen inget samtycke, till skillnad från GA4. Rader äldre än
 * 90 dagar raderas av `traffic-retention` i schemaläggaren.
 */

import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const trafficEvents = pgTable(
  "traffic_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "page" eller "click". */
    kind: varchar("kind", { length: 16 }).notNull(),
    /** Sökväg utan querysträng, t.ex. /produkter eller /shop/demo-noah. */
    path: varchar("path", { length: 300 }).notNull(),
    /** Klick: knappens eller länkens text. */
    label: varchar("label", { length: 160 }),
    /** Klick: målet — intern sökväg, extern värd + sökväg, tel: eller mailto:. */
    href: varchar("href", { length: 300 }),
    /** Sidvisning: utm_source eller hänvisande värd (bara domänen). */
    source: varchar("source", { length: 120 }),
    /** "mobile", "tablet" eller "desktop" utifrån skärmbredd. */
    device: varchar("device", { length: 16 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("traffic_events_created_at_idx").on(table.createdAt)]
);
