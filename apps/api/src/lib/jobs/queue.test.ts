import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryQueue, type JobContext } from "./queue";
import {
  enqueueJob,
  registerJobHandler,
  resetQueueForTests,
  startWorkers,
  stopWorkers,
} from "./index";
import { singletonKey } from "./types";

/**
 * Unit tests for the jobs/queue abstraction. Exercise:
 *  - Payload validation against the Zod catalog.
 *  - Singleton-key dedup.
 *  - Flag-gated DisabledQueue.
 *  - The module-level singleton and reset helper.
 */

describe("InMemoryQueue", () => {
  it("validates payloads against the Zod catalog", async () => {
    const q = new InMemoryQueue();
    // @ts-expect-error — payload deliberately wrong shape
    await expect(q.enqueue("agent.organization-normalize", {})).rejects.toThrow(
      /invalid payload/
    );
  });

  it("invokes the registered handler on start()", async () => {
    const seen: JobContext<"agent.organization-normalize">[] = [];
    const q = new InMemoryQueue();
    q.registerHandler("agent.organization-normalize", (ctx) => {
      seen.push(ctx);
    });

    await q.enqueue("agent.organization-normalize", {
      organizationId: "00000000-0000-0000-0000-000000000001",
    });
    expect(q.inspectPending()).toHaveLength(1);

    await q.start();
    expect(q.inspectPending()).toHaveLength(0);
    expect(seen).toHaveLength(1);
    expect(seen[0].payload.organizationId).toBe(
      "00000000-0000-0000-0000-000000000001"
    );
  });

  it("deduplicates by singletonKey while the slot is active (matches pg-boss)", async () => {
    const q = new InMemoryQueue();
    const ranFor: string[] = [];
    // Hold the handler open until we release it so both enqueues happen
    // while the singleton slot is still occupied.
    let release!: () => void;
    const blocker = new Promise<void>((r) => {
      release = r;
    });
    q.registerHandler("agent.lead-score-refresh", async (ctx) => {
      ranFor.push(ctx.payload.organizationId ?? "all");
      await blocker;
    });

    const key = singletonKey("agent.lead-score-refresh", {
      org: "00000000-0000-0000-0000-000000000002",
    });

    // Enqueue without starting so the job stays pending.
    const id1 = await q.enqueue(
      "agent.lead-score-refresh",
      { organizationId: "00000000-0000-0000-0000-000000000002" },
      { singletonKey: key }
    );
    // Same key while pending → dropped, returns null.
    const id2 = await q.enqueue(
      "agent.lead-score-refresh",
      { organizationId: "00000000-0000-0000-0000-000000000002" },
      { singletonKey: key }
    );

    expect(typeof id1).toBe("string");
    expect(id2).toBeNull();

    // Drain — handler is blocked.
    const drained = q.start();
    // Give the drain loop a tick to start the handler.
    await Promise.resolve();
    release();
    await drained;

    expect(ranFor).toEqual(["00000000-0000-0000-0000-000000000002"]);

    // After the job has drained, the singleton slot is released and a new
    // enqueue with the same key produces a fresh id.
    const id3 = await q.enqueue(
      "agent.lead-score-refresh",
      { organizationId: "00000000-0000-0000-0000-000000000002" },
      { singletonKey: key }
    );
    expect(typeof id3).toBe("string");
    expect(id3).not.toBe(id1);
  });

  it("drops jobs with no registered handler", async () => {
    const q = new InMemoryQueue();
    await q.start();
    const id = await q.enqueue("agent.duplicate-sweep", {});
    expect(typeof id).toBe("string");
    expect(q.inspectPending()).toHaveLength(0);
  });
});

describe("singletonKey", () => {
  it("produces stable, order-independent keys", () => {
    const a = singletonKey("agent.lead-score-refresh", {
      org: "a",
      bucket: "warm",
    });
    const b = singletonKey("agent.lead-score-refresh", {
      bucket: "warm",
      org: "a",
    });
    expect(a).toBe(b);
  });

  it("omits empty/undefined parts", () => {
    const key = singletonKey("agent.lead-score-refresh", {
      org: "a",
      bucket: undefined,
      note: "",
    });
    expect(key).toBe("agent.lead-score-refresh|org=a");
  });
});

describe("module singleton (DisabledQueue / InMemoryQueue)", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    resetQueueForTests();
  });

  afterEach(() => {
    resetQueueForTests();
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
  });

  it("returns DisabledQueue when WORKERS_ENABLED is off", async () => {
    delete process.env.WORKERS_ENABLED;
    await expect(
      enqueueJob("agent.organization-normalize", {
        organizationId: "00000000-0000-0000-0000-000000000003",
      })
    ).rejects.toThrow(/workers are disabled/);
    // start/stop are silent no-ops in this mode
    await startWorkers();
    await stopWorkers();
  });

  it("routes through InMemoryQueue when WORKERS_INMEMORY is on", async () => {
    process.env.WORKERS_ENABLED = "true";
    process.env.WORKERS_INMEMORY = "true";

    const seen: string[] = [];
    registerJobHandler("agent.organization-normalize", (ctx) => {
      seen.push(ctx.payload.organizationId);
    });
    await startWorkers();
    const id = await enqueueJob("agent.organization-normalize", {
      organizationId: "00000000-0000-0000-0000-000000000004",
    });
    expect(typeof id).toBe("string");
    expect(seen).toEqual(["00000000-0000-0000-0000-000000000004"]);
    await stopWorkers();
  });
});
