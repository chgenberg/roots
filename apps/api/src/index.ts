import { serve } from "@hono/node-server";
import { app } from "./app";
import { childLogger } from "./lib/logger";
import { initBankIdAdapter } from "./lib/bankid/adapter";
import { runBootMigrations } from "./lib/migrate-on-boot";
import { startWorkers, stopWorkers } from "./lib/jobs";
import { flags } from "./lib/flags";
import { validateEnvOrExit } from "./lib/validate-env";
import { initSentry, captureException, flushSentry } from "./lib/sentry";

const log = childLogger("server");

const port = Number(process.env.PORT) || 4000;

async function start() {
  // Sprint D+1 — Observability: initialise Sentry as the very first
  // thing so any error during env-validation, migrations, or worker
  // startup gets captured. No-op when SENTRY_DSN is unset, so dev and
  // tests are unaffected.
  initSentry();

  // Sprint D — Prod-konfig: validate env BEFORE we do anything that
  // touches the DB or Redis. If a required prod var is missing or still
  // holds an .env.example placeholder we exit(1) here so the orchestrator
  // rolls the deploy back. No DB queries get executed against the wrong
  // database, no Klarna webhooks get signed with the dev secret.
  validateEnvOrExit();

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
  // Sprint D+1: drain in-flight Sentry events before exiting. 2s cap
  // so orchestrators never see a stuck container.
  await flushSentry(2_000);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Sprint D+1: catch errors that escape every async boundary. Logging
// them was already done by pino's default behaviour; Sentry-reporting
// gives us alerting + grouping on top.
process.on("unhandledRejection", (reason) => {
  log.error({ err: reason }, "unhandledRejection");
  captureException(reason, { tags: { type: "unhandledRejection" } });
});
process.on("uncaughtException", (err) => {
  log.error({ err }, "uncaughtException");
  captureException(err, { tags: { type: "uncaughtException" } });
});

start().catch((err) => {
  log.error({ err }, "Failed to start server");
  captureException(err, { tags: { phase: "boot" } });
  // Best-effort flush so the boot failure shows up in Sentry even if
  // we exit immediately after.
  void flushSentry(1_500).finally(() => process.exit(1));
});
