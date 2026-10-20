-- Anonym besöksstatistik (sidvisningar och klick) för admin-sidan Trafik.
CREATE TABLE IF NOT EXISTS "traffic_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(16) NOT NULL,
  "path" varchar(300) NOT NULL,
  "label" varchar(160),
  "href" varchar(300),
  "source" varchar(120),
  "device" varchar(16),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traffic_events_created_at_idx"
  ON "traffic_events" ("created_at");
