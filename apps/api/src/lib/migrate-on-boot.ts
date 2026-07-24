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
 * Vem som kör migrationerna bestäms av `role`, inte av miljön:
 *   role: "api"     → kör som standard. API:t äger schemat.
 *   role: "worker"  → hoppar över som standard, så schema-ägandet är
 *                     entydigt. Kan tvingas på med RUN_MIGRATIONS_ON_BOOT=true
 *                     för en worker-only-deploy (advisory-låset gör det säkert).
 *
 * Flaggan var tidigare av som standard för båda rollerna, med en kommentar om
 * att ops skulle slå på den "när de var klara". Det gjordes aldrig, och det
 * fanns inget pre-deploy-steg någon annanstans — så migrationer applicerades
 * i praktiken aldrig i produktion. API:t startade mot vilket schema som råkade
 * ligga i databasen, och `routes/auth.ts` sväljer dessutom schema-drift-fel
 * vid inloggning, så drift syntes som märkliga inloggningsfel i stället för
 * som ett tydligt krasch.
 */
export async function runBootMigrations(
  opts: { role: "api" | "worker" } = { role: "api" }
): Promise<void> {
  const defaultOn = opts.role === "api";
  if (!isEnabled("RUN_MIGRATIONS_ON_BOOT", defaultOn)) {
    log.debug({ role: opts.role }, "migrations on boot disabled — skipping");
    return;
  }
  if (!process.env.DATABASE_URL) {
    // Hellre krasch än tyst hoppa över: det här är precis läget där man mest
    // av allt vill att deployen rullas tillbaka.
    throw new Error(
      "migrationer ska köras vid start men DATABASE_URL saknas — vägrar starta"
    );
  }

  log.info("running pending database migrations…");
  try {
    // `??` fångar inte tom sträng, och en felstavning ger NaN. Båda är falsy i
    // migrate.ts:s `lockTimeoutMs > 0`-koll, vilket hade hoppat över SET
    // lock_timeout helt — då väntar starten för evigt i stället för att fela.
    const parsedTimeout = Number(process.env.MIGRATE_LOCK_TIMEOUT_MS);
    const lockTimeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : 60_000;

    const result = await runMigrations({ lockTimeoutMs });
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
