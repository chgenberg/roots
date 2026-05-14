import { serve } from "@hono/node-server";
import { app } from "./app";
import { childLogger } from "./lib/logger";
import { initBankIdAdapter } from "./lib/bankid/adapter";
import { runBootMigrations } from "./lib/migrate-on-boot";

const log = childLogger("server");

const port = Number(process.env.PORT) || 4000;

async function start() {
  // Run pending schema migrations BEFORE we accept HTTP traffic. A failure
  // crashes the process so the orchestrator can roll back the deploy.
  // No-op when `RUN_MIGRATIONS_ON_BOOT` is off — schema is then assumed to
  // have been migrated out-of-band.
  await runBootMigrations();

  await initBankIdAdapter();

  serve({ fetch: app.fetch, port }, (info) => {
    log.info({ port: info.port }, `Roots API running on http://localhost:${info.port}`);
  });
}

start().catch((err) => {
  log.error({ err }, "Failed to start server");
  process.exit(1);
});
