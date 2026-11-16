-- Inställningar för hela Roots (t.ex. fraktavgift vid hemleverans).
-- Ingen rad läggs in här: avgiften sätts av intern admin i portalen.
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
