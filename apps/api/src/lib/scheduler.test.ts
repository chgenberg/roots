import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tester för schemaläggaren.
 *
 * Det som faktiskt kan gå fel här är slot-låset: kör jobbet en gång per
 * intervall i hela klustret, eller en gång per replik? Redis mockas så att
 * `SET NX` beter sig som på riktigt (första anroparen får "OK", övriga null).
 */

const redisSet = vi.fn();
const captureException = vi.fn();

vi.mock("./redis", () => ({ redis: { set: (...args: unknown[]) => redisSet(...args) } }));
vi.mock("./sentry", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

async function importFresh() {
  vi.resetModules();
  return await import("./scheduler");
}

describe("scheduler", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    redisSet.mockReset();
    captureException.mockReset();
    // Undanta test-kortslutningen i startScheduler.
    process.env.NODE_ENV = "development";
    delete process.env.SCHEDULER_DISABLED;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("kör jobbet när slotten är ledig", async () => {
    redisSet.mockResolvedValue("OK");
    const run = vi.fn().mockResolvedValue({ purged: 2 });
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run });
    startScheduler();

    await vi.advanceTimersByTimeAsync(11_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("hoppar över när en annan replik redan tagit slotten", async () => {
    redisSet.mockResolvedValue(null);
    const run = vi.fn();
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run });
    startScheduler();

    await vi.advanceTimersByTimeAsync(11_000);

    expect(run).not.toHaveBeenCalled();
  });

  it("sätter lås-TTL till intervallet, så antalet repliker inte ändrar frekvensen", async () => {
    redisSet.mockResolvedValue("OK");
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({
      name: "deletion-purge",
      intervalMs: 6 * 60 * 60 * 1000,
      run: vi.fn().mockResolvedValue(undefined),
    });
    startScheduler();
    await vi.advanceTimersByTimeAsync(11_000);

    expect(redisSet).toHaveBeenCalledWith(
      "scheduler:slot:deletion-purge",
      expect.any(String),
      "EX",
      6 * 60 * 60,
      "NX"
    );
  });

  it("hoppar över körningen om Redis inte svarar, i stället för att köra olåst", async () => {
    redisSet.mockRejectedValue(new Error("ECONNREFUSED"));
    const run = vi.fn();
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run });
    startScheduler();

    await vi.advanceTimersByTimeAsync(11_000);

    expect(run).not.toHaveBeenCalled();
  });

  it("ett kastande jobb fäller inte schemaläggaren", async () => {
    redisSet.mockResolvedValue("OK");
    const boom = vi.fn().mockRejectedValue(new Error("purge failed"));
    const ok = vi.fn().mockResolvedValue(undefined);
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "boom", intervalMs: 60_000, run: boom });
    registerScheduledTask({ name: "ok", intervalMs: 60_000, run: ok });
    startScheduler();

    await vi.advanceTimersByTimeAsync(11_000);

    // Nästa jobb i listan ska ha körts trots att det första kastade.
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("larmar när Redis varit onåbart länge nog att jobbet missats", async () => {
    redisSet.mockRejectedValue(new Error("ECONNREFUSED"));
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run: vi.fn() });
    startScheduler();

    // 9 ticks: bara warn. Den 10:e ska larma.
    await vi.advanceTimersByTimeAsync(11_000 + 8 * 60_000);
    expect(captureException).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("nollställer felräknaren när Redis svarar igen", async () => {
    redisSet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    redisSet.mockResolvedValue("OK");
    const run = vi.fn().mockResolvedValue(undefined);
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run });
    startScheduler();

    await vi.advanceTimersByTimeAsync(11_000 + 60_000);

    expect(run).toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("SCHEDULER_DISABLED=true stänger av allt", async () => {
    redisSet.mockResolvedValue("OK");
    process.env.SCHEDULER_DISABLED = "true";
    const run = vi.fn();
    const { registerScheduledTask, startScheduler } = await importFresh();

    registerScheduledTask({ name: "t", intervalMs: 60_000, run });
    startScheduler();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(run).not.toHaveBeenCalled();
  });
});
