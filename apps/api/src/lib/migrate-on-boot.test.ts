import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for the boot-time migration runner.
 *
 * We mock `@roots/db.runMigrations` so the test never touches a real DB —
 * the contract we care about here is purely:
 *   - flag gating (`RUN_MIGRATIONS_ON_BOOT`)
 *   - DATABASE_URL guard
 *   - fail-fast behaviour (re-throws so orchestrator can roll back)
 */

const runMigrationsMock = vi.fn();

vi.mock("@roots/db", () => ({
  runMigrations: (...args: unknown[]) => runMigrationsMock(...args),
}));

async function importFresh() {
  vi.resetModules();
  return await import("./migrate-on-boot");
}

describe("runBootMigrations", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    runMigrationsMock.mockReset();
    runMigrationsMock.mockResolvedValue({
      applied: 0,
      finalCount: 4,
      durationMs: 12,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops when RUN_MIGRATIONS_ON_BOOT is unset", async () => {
    delete process.env.RUN_MIGRATIONS_ON_BOOT;
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations();

    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it("no-ops when RUN_MIGRATIONS_ON_BOOT is 'false'", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "false";
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations();

    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it("runs migrations when flag is truthy and DATABASE_URL is set", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "true";
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });

  it("skips (does not throw) when DATABASE_URL is missing even if flag is on", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "true";
    delete process.env.DATABASE_URL;
    const { runBootMigrations } = await importFresh();

    await expect(runBootMigrations()).resolves.toBeUndefined();
    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it("re-throws when the migrator fails so the boot sequence aborts", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "true";
    process.env.DATABASE_URL = "postgres://x";
    const boom = new Error("relation x already exists");
    runMigrationsMock.mockRejectedValueOnce(boom);
    const { runBootMigrations } = await importFresh();

    await expect(runBootMigrations()).rejects.toBe(boom);
  });

  it("forwards MIGRATE_LOCK_TIMEOUT_MS to the migrator", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "1";
    process.env.DATABASE_URL = "postgres://x";
    process.env.MIGRATE_LOCK_TIMEOUT_MS = "5000";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations();

    expect(runMigrationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ lockTimeoutMs: 5000 })
    );
  });
});
