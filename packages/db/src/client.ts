import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Utan DATABASE_URL byggde vi tidigare klienten på `undefined`. Då kastades
 * inget fel — istället försökte postgres-js ansluta mot en default-socket och
 * varje fråga låg och väntade tills anroparens timeout slog till. Symptomet
 * blev att t.ex. inloggning hängde i ~30 s utan ett enda felmeddelande, vilket
 * är betydligt svårare att felsöka än ett tydligt fel vid uppstart.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL saknas. Sätt den i miljön (lokalt: rot-.env, i produktion: " +
      "per tjänst) innan @roots/db importeras."
  );
}

const client = postgres(connectionString, {
  // Hänger hellre inte för evigt: en onåbar databas ska ge fel, inte tystnad.
  connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS) || 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
