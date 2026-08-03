import { describe, it, expect, beforeEach, vi } from "vitest";

const cooldowns = new Map<string, string>();
const readiness = {
  ok: true,
  db: { ok: true, latencyMs: 1 },
  redis: { ok: true, latencyMs: 1 },
};
let jobStatuses: Array<{
  name: string;
  description: string;
  intervalHours: number;
  lastRunAt: string | null;
  ageHours: number | null;
  stale: boolean;
}> = [];

vi.mock("../redis", () => ({
  redis: {
    // NX-semantik: sätt bara om nyckeln inte finns, precis som Redis.
    set: vi.fn(async (key: string, value: string, ..._rest: unknown[]) => {
      if (cooldowns.has(key)) return null;
      cooldowns.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      cooldowns.delete(key);
      return 1;
    }),
  },
}));

// vi.hoisted eftersom vi.mock-fabrikerna lyfts ovanför modulens toppnivå och
// annars läser variablerna innan de finns.
const { sendEmail, captureException } = vi.hoisted(() => ({
  sendEmail: vi.fn(
    async (_message: {
      to: string;
      subject: string;
      html: string;
      text: string;
    }) => ({ id: "test" })
  ),
  captureException: vi.fn(),
}));

vi.mock("../email", () => ({ getEmailSender: () => ({ sendEmail }) }));
vi.mock("../sentry", () => ({ captureException }));

vi.mock("../health-checks", () => ({
  checkReadiness: async () => readiness,
}));

vi.mock("./heartbeat", () => ({
  getJobStatuses: async () => jobStatuses,
}));

import { runMonitoringCheck } from "./alerts";

const healthyJob = {
  name: "lead-retention",
  description: "Raderar gamla leads.",
  intervalHours: 24,
  lastRunAt: new Date().toISOString(),
  ageHours: 0.1,
  stale: false,
};

describe("driftlarm", () => {
  beforeEach(() => {
    cooldowns.clear();
    vi.clearAllMocks();
    process.env.ALERT_EMAIL = "drift@roots.test";
    readiness.ok = true;
    readiness.db = { ok: true, latencyMs: 1 };
    readiness.redis = { ok: true, latencyMs: 1 };
    jobStatuses = [healthyJob];
  });

  it("skickar inget när allt fungerar", async () => {
    const result = await runMonitoringCheck();

    expect(result.problems).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("larmar när databasen inte svarar", async () => {
    readiness.ok = false;
    readiness.db = { ok: false, error: "connection refused" } as never;

    const result = await runMonitoringCheck();

    expect(result.sent).toContain("db-down");
    expect(sendEmail).toHaveBeenCalledOnce();
    const message = sendEmail.mock.calls[0][0];
    expect(message.to).toBe("drift@roots.test");
    expect(message.subject).toContain("Kritiskt");
    expect(message.text).toContain("connection refused");
    // Larmet ska också hamna i Sentry, så det syns i samma tidslinje som felen.
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("larmar när ett jobb tystnat", async () => {
    jobStatuses = [{ ...healthyJob, stale: true, lastRunAt: null, ageHours: null }];

    const result = await runMonitoringCheck();

    expect(result.sent).toEqual(["job-stale-lead-retention"]);
    expect(sendEmail.mock.calls[0][0].text).toContain("aldrig rapporterat");
  });

  it("skickar inte samma larm två gånger i rad", async () => {
    readiness.ok = false;
    readiness.db = { ok: false, error: "nere" } as never;

    await runMonitoringCheck();
    const second = await runMonitoringCheck();

    expect(second.problems).toHaveLength(1);
    expect(second.sent).toEqual([]);
    expect(second.suppressed).toEqual(["db-down"]);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("larmar direkt igen efter att problemet varit borta", async () => {
    readiness.ok = false;
    readiness.db = { ok: false, error: "nere" } as never;
    await runMonitoringCheck();

    // Återställt: spärren ska rensas.
    readiness.ok = true;
    readiness.db = { ok: true, latencyMs: 1 };
    await runMonitoringCheck();

    // Nytt avbrott ska larma på en gång, inte tystas av den gamla spärren.
    readiness.ok = false;
    readiness.db = { ok: false, error: "nere igen" } as never;
    const third = await runMonitoringCheck();

    expect(third.sent).toEqual(["db-down"]);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("tappar inte larmet när ingen mottagare är konfigurerad", async () => {
    delete process.env.ALERT_EMAIL;
    readiness.ok = false;
    readiness.db = { ok: false, error: "nere" } as never;

    const result = await runMonitoringCheck();

    expect(result.sent).toContain("db-down");
    expect(sendEmail).not.toHaveBeenCalled();
    // Sentry är kvar som väg ut, så problemet syns någonstans.
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("larmar ändå om mejlet inte går fram", async () => {
    sendEmail.mockRejectedValueOnce(new Error("resend nere"));
    readiness.ok = false;
    readiness.db = { ok: false, error: "nere" } as never;

    await expect(runMonitoringCheck()).resolves.toMatchObject({
      sent: ["db-down"],
    });
    expect(captureException).toHaveBeenCalledOnce();
  });
});
