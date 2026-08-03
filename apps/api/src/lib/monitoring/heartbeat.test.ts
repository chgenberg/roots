import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("../redis", () => ({
  redis: {
    // NX måste efterliknas: koden skiljer på "jag satte märket nu" och "det
    // fanns redan", och utan skillnaden testar vi inte väntelogiken alls.
    set: vi.fn(async (key: string, value: string, ...rest: unknown[]) => {
      if (rest.includes("NX") && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  },
}));

import { recordJobRun, getJobStatuses, MONITORED_JOBS } from "./heartbeat";
import { redis } from "../redis";

describe("hjärtslag för schemalagda jobb", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("larmar inte direkt på ett jobb som ännu inte hunnit köra", async () => {
    // Läget strax efter en deploy. Ett jobb med sex timmars intervall har
    // rimligen inte kört, och att skrika då gör larmen till brus.
    const statuses = await getJobStatuses();

    expect(statuses).toHaveLength(MONITORED_JOBS.length);
    for (const status of statuses) {
      expect(status.stale).toBe(false);
      expect(status.lastRunAt).toBeNull();
    }
  });

  it("larmar på ett jobb som aldrig kört när det borde ha hunnit", async () => {
    const job = MONITORED_JOBS.find((j) => j.name === "deletion-purge")!;
    const waited = job.intervalHours + job.graceHours + 1;
    store.set(
      "heartbeat:first-seen:deletion-purge",
      String(Date.now() - waited * 60 * 60 * 1000)
    );

    const status = (await getJobStatuses()).find(
      (s) => s.name === "deletion-purge"
    );
    expect(status?.stale).toBe(true);
    expect(status?.lastRunAt).toBeNull();
  });

  it("nollställer väntetiden när jobbet väl kört", async () => {
    // Utan städningen skulle ett gammalt märke ligga kvar och larma direkt
    // efter att hjärtslagets TTL löpt ut, trots att jobbet just kört.
    store.set(
      "heartbeat:first-seen:lead-retention",
      String(Date.now() - 1000 * 60 * 60 * 100)
    );

    await recordJobRun("lead-retention");

    expect(store.has("heartbeat:first-seen:lead-retention")).toBe(false);
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

  it("larmar inte om jobben när det är Redis som inte svarar", async () => {
    // Utan hjärtslag OCH utan väntetid vet vi ingenting om jobben. Att larma
    // om dem då vore ett larm om Redis, och Redis övervakas för sig — annars
    // ger ett Redis-avbrott ett larm per jobb utöver det riktiga.
    vi.mocked(redis.get).mockRejectedValue(new Error("redis nere"));
    vi.mocked(redis.set).mockRejectedValue(new Error("redis nere"));

    const statuses = await getJobStatuses();
    expect(statuses.every((s) => !s.stale)).toBe(true);
  });
});
