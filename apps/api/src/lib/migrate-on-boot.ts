import { runMigrations } from "@roots/db";
import { childLogger } from "./logger";
import { isEnabled } from "./flags";

const log = childLogger("migrate-on-boot");

/**
 * Boot-time database migration runner.
 *
 * Behaviour:
 *  - When `RUN_MIGRATIONS_ON_BOOT` is **truthy** (default: false), runs all
 *    pending Drizzle migrations against `DATABASE_URL` *before* the HTTP
 *    server (or worker pool) starts accepting work.
 *  - Multi-instance safe — `runMigrations()` acquires a Postgres advisory
 *    lock so only one process runs migrations at a time. The others wait,
 *    then no-op once the lock is released.
 *  - Migration failures are **fatal**: re-throws so the process crashes and
 *    the orchestrator (Docker/Railway/Fly) marks the deploy bad. This is
 *    safer than starting a server against a schema-incompatible DB.
 *
 * Recommended rollout:
 *   API container env:    RUN_MIGRATIONS_ON_BOOT=true
 *   Worker container env: RUN_MIGRATIONS_ON_BOOT=false  (let API run them)
 *
 * Off by default so first-deploy of this change is non-blocking — toggle
 * the env var when ops is ready to hand schema control to the app process.
 */
export async function runBootMigrations(): Promise<void> {
  if (!isEnabled("RUN_MIGRATIONS_ON_BOOT", false)) {
    log.debug("RUN_MIGRATIONS_ON_BOOT is off — skipping");
    return;
  }
  if (!process.env.DATABASE_URL) {
    log.warn("RUN_MIGRATIONS_ON_BOOT is on but DATABASE_URL is missing — skipping");
    return;
  }

  log.info("running pending database migrations…");
  try {
    const result = await runMigrations({
      lockTimeoutMs: Number(process.env.MIGRATE_LOCK_TIMEOUT_MS ?? 60_000),
    });
    log.info(
      {
        applied: result.applied,
        finalCount: result.finalCount,
        durationMs: result.durationMs,
      },
      "migrations complete"
    );
  } catch (err) {
    log.error({ err }, "migrations failed — refusing to start");
    throw err;
  }
}
