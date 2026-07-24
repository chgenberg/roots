import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for the boot-time migration runner.
 *
 * `@roots/db.runMigrations` mockas så att testet aldrig rör en riktig databas.
 * Kontraktet vi bryr oss om:
 *   - rollen avgör standardläget (api kör, worker hoppar över)
 *   - `RUN_MIGRATIONS_ON_BOOT` kan överstyra båda hållen
 *   - saknad DATABASE_URL kastar (deployen ska rullas tillbaka)
 *   - migreringsfel kastar vidare
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

  it("kör som standard i API-rollen — det är API:t som äger schemat", async () => {
    delete process.env.RUN_MIGRATIONS_ON_BOOT;
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations({ role: "api" });

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });

  it("kör som standard även utan explicit roll", async () => {
    delete process.env.RUN_MIGRATIONS_ON_BOOT;
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });

  it("hoppar över som standard i worker-rollen så schemaägandet är entydigt", async () => {
    delete process.env.RUN_MIGRATIONS_ON_BOOT;
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations({ role: "worker" });

    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it("RUN_MIGRATIONS_ON_BOOT=true tvingar på migrationer i worker-rollen", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "true";
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations({ role: "worker" });

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });

  it("RUN_MIGRATIONS_ON_BOOT=false stänger av migrationer även för API:t", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "false";
    process.env.DATABASE_URL = "postgres://x";
    const { runBootMigrations } = await importFresh();

    await runBootMigrations({ role: "api" });

    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it("kastar när DATABASE_URL saknas — hellre rullad deploy än okänt schema", async () => {
    process.env.RUN_MIGRATIONS_ON_BOOT = "true";
    delete process.env.DATABASE_URL;
    const { runBootMigrations } = await importFresh();

    await expect(runBootMigrations()).rejects.toThrow(/DATABASE_URL/);
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
