import { serve } from "@hono/node-server";
import { app } from "./app";
import { childLogger } from "./lib/logger";
import { initBankIdAdapter } from "./lib/bankid/adapter";
import { runBootMigrations } from "./lib/migrate-on-boot";
import { startWorkers, stopWorkers } from "./lib/jobs";
import { flags } from "./lib/flags";

const log = childLogger("server");

const port = Number(process.env.PORT) || 4000;

async function start() {
  // Run pending schema migrations BEFORE we accept HTTP traffic. A failure
  // crashes the process so the orchestrator can roll back the deploy.
  // No-op when `RUN_MIGRATIONS_ON_BOOT` is off — schema is then assumed to
  // have been migrated out-of-band.
  await runBootMigrations();

  await initBankIdAdapter();

  // Connection-audit P1 #9: start the pg-boss client in producer mode so
  // `enqueueJob` from request handlers actually reaches the queue when
  // WORKERS_ENABLED is flipped on. The API process does NOT register any
  // handlers, so pg-boss never claims jobs here — that stays the worker
  // process's responsibility (see apps/api/src/workers/index.ts).
  if (flags.workersEnabled()) {
    try {
      await startWorkers();
      log.info("pg-boss producer connection ready");
    } catch (err) {
      log.error({ err }, "failed to start pg-boss producer — jobs will be dropped");
    }
  }

  serve({ fetch: app.fetch, port }, (info) => {
    log.info({ port: info.port }, `Roots API running on http://localhost:${info.port}`);
  });
}

async function shutdown(signal: string) {
  log.info({ signal }, "shutdown signal received");
  try {
    await stopWorkers(5_000);
  } catch (err) {
    log.error({ err }, "stopWorkers failed during shutdown");
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  log.error({ err }, "Failed to start server");
  process.exit(1);
});
