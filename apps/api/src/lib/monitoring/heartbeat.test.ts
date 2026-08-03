import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("../redis", () => ({
  redis: {
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
  },
}));

import { recordJobRun, getJobStatuses, MONITORED_JOBS } from "./heartbeat";
import { redis } from "../redis";

describe("hjärtslag för schemalagda jobb", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("räknar ett jobb som aldrig rapporterat som tystnat", async () => {
    const statuses = await getJobStatuses();

    expect(statuses).toHaveLength(MONITORED_JOBS.length);
    for (const status of statuses) {
      expect(status.stale).toBe(true);
      expect(status.lastRunAt).toBeNull();
    }
  });

  it("räknar ett jobb som just kört som friskt", async () => {
    await recordJobRun("lead-retention", { deleted: 3 });

    const status = (await getJobStatuses()).find(
      (s) => s.name === "lead-retention"
    );
    expect(status?.stale).toBe(false);
    expect(status?.ageHours).toBeLessThan(0.1);
    expect(status?.meta).toEqual({ deleted: 3 });
  });

  it("larmar först när tystnaden passerat intervall plus tolerans", async () => {
    const job = MONITORED_JOBS.find((j) => j.name === "lead-retention")!;
    const hoursAgo = (h: number) =>
      new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

    // Precis inom tolerans: sent men inte fel.
    store.set(
      "heartbeat:job:lead-retention",
      JSON.stringify({ at: hoursAgo(job.intervalHours + job.graceHours - 1) })
    );
    let status = (await getJobStatuses()).find(
      (s) => s.name === "lead-retention"
    );
    expect(status?.stale).toBe(false);

    // Strax utanför: nu ska det larma.
    store.set(
      "heartbeat:job:lead-retention",
      JSON.stringify({ at: hoursAgo(job.intervalHours + job.graceHours + 1) })
    );
    status = (await getJobStatuses()).find((s) => s.name === "lead-retention");
    expect(status?.stale).toBe(true);
  });

  it("behandlar ett trasigt värde som en tystnad istället för att krascha", async () => {
    store.set("heartbeat:job:lead-retention", "{inte json");

    const status = (await getJobStatuses()).find(
      (s) => s.name === "lead-retention"
    );
    expect(status?.stale).toBe(true);
    expect(status?.lastRunAt).toBeNull();
  });

  it("låter inte jobbet fela när hjärtslaget inte kan sparas", async () => {
    vi.mocked(redis.set).mockRejectedValueOnce(new Error("redis nere"));

    await expect(recordJobRun("lead-retention")).resolves.toBeUndefined();
  });

  it("räknar en tystnad som tystnad även om Redis inte svarar", async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error("redis nere"));

    const statuses = await getJobStatuses();
    expect(statuses.every((s) => s.stale)).toBe(true);
  });
});
