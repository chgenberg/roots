import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Runs all pending Drizzle migrations against `DATABASE_URL`.
 *
 * Designed to be called at API/worker boot. Uses a dedicated short-lived
 * connection (not the long-lived pool in `./client.ts`) so the schema work
 * doesn't share state with request-handler traffic.
 *
 * Concurrency:
 *  - Wraps `migrate()` in a Postgres advisory lock so when multiple API or
 *    worker instances boot simultaneously, only one runs the migrator. The
 *    others wait on the lock, then `migrate()` is a no-op for them
 *    (drizzle compares against `__drizzle_migrations`).
 *  - Lock id derived from a constant string ("roots_migrator_v1") via the
 *    SQL `hashtext()` function to give every deployment the same id without
 *    risking collisions with random Postgres advisory consumers.
 *
 * Resolution order for the migrations folder:
 *   1. `migrationsFolder` argument (caller override, used in tests).
 *   2. `MIGRATIONS_FOLDER` env var (Docker can override).
 *   3. `<this file>/../drizzle` for `pnpm` / `tsx` dev mode.
 *   4. `<cwd>/drizzle` and `<cwd>/packages/db/drizzle` as final fallbacks.
 *
 * Returns the number of migrations applied during *this* run (drizzle's
 * internal count is not exposed; we approximate by polling
 * `__drizzle_migrations` before/after).
 */
export interface RunMigrationsOptions {
  databaseUrl?: string;
  migrationsFolder?: string;
  /** Identifier used for the advisory lock string. */
  lockId?: string;
  /** When true, throws after `lockTimeoutMs` if the lock is not acquired. */
  lockTimeoutMs?: number;
}

export interface RunMigrationsResult {
  applied: number;
  finalCount: number;
  durationMs: number;
}

const DEFAULT_LOCK_ID = "roots_migrator_v1";

export async function runMigrations(
  options: RunMigrationsOptions = {}
): Promise<RunMigrationsResult> {
  const url = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[migrate] DATABASE_URL is not set");
  }

  const folder = resolveMigrationsFolder(options.migrationsFolder);
  if (!existsSync(folder)) {
    throw new Error(`[migrate] migrations folder not found: ${folder}`);
  }

  const startedAt = Date.now();
  // Dedicated single-connection client so the advisory lock stays on the
  // same backend session. `max: 1` also avoids slot exhaustion during boot.
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  try {
    const lockId = options.lockId ?? DEFAULT_LOCK_ID;
    if (options.lockTimeoutMs && options.lockTimeoutMs > 0) {
      await sql.unsafe(`SET LOCAL lock_timeout = '${options.lockTimeoutMs}ms'`);
    }
    await sql.unsafe(`SELECT pg_advisory_lock(hashtext('${lockId}'))`);

    const before = await countMigrationsRows(sql);
    await migrate(db, { migrationsFolder: folder });
    const after = await countMigrationsRows(sql);

    await sql.unsafe(`SELECT pg_advisory_unlock(hashtext('${lockId}'))`);

    return {
      applied: Math.max(0, after - before),
      finalCount: after,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function countMigrationsRows(
  sql: ReturnType<typeof postgres>
): Promise<number> {
  try {
    const rows = await sql<
      { count: string }[]
    >`SELECT count(*) AS count FROM drizzle.__drizzle_migrations`;
    return Number(rows[0]?.count ?? 0);
  } catch {
    // Table doesn't exist yet on first-ever run — migrate() will create it.
    return 0;
  }
}

function resolveMigrationsFolder(override?: string): string {
  if (override) return resolve(override);
  if (process.env.MIGRATIONS_FOLDER) {
    return resolve(process.env.MIGRATIONS_FOLDER);
  }
  // Try the path relative to this source file (works in dev/tsx).
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidate = resolve(here, "..", "drizzle");
    if (existsSync(candidate)) return candidate;
  } catch {
    /* CJS bundle — no import.meta.url */
  }
  // Final fallbacks: cwd-relative for the Docker runtime stage.
  const cwd = process.cwd();
  for (const p of [
    resolve(cwd, "drizzle"),
    resolve(cwd, "packages/db/drizzle"),
    resolve(cwd, "dist/drizzle"),
  ]) {
    if (existsSync(p)) return p;
  }
  return resolve(cwd, "drizzle");
}
