import { flags, isEnabled } from "../flags";
import { childLogger } from "../logger";
import type { Queue } from "./queue";
import { InMemoryQueue } from "./queue";
import { PgBossQueue } from "./pg-boss-queue";

export * from "./types";
export type { Queue, JobContext, JobHandler, EnqueueOptions } from "./queue";

const log = childLogger("jobs");

/**
 * Module-level singleton. The first call to `getQueue()` decides which
 * backend to use:
 *
 *   1. `flags.workersEnabled()` is `false` → returns a no-op queue that
 *      throws on enqueue (callers shouldn't be hitting it).
 *   2. `WORKERS_INMEMORY=true`  → in-memory queue (tests, dev).
 *   3. Otherwise → pg-boss queue against `DATABASE_URL`.
 *
 * `resetQueueForTests()` lets vitest reset the singleton between cases.
 */
let queue: Queue | null = null;

class DisabledQueue implements Queue {
  registerHandler(): void {
    /* no-op */
  }
  async enqueue(): Promise<string | null> {
    throw new Error(
      "[jobs] workers are disabled — set WORKERS_ENABLED=true to enqueue jobs"
    );
  }
  async start(): Promise<void> {
    /* no-op */
  }
  async stop(): Promise<void> {
    /* no-op */
  }
}

function buildQueue(): Queue {
  if (!flags.workersEnabled()) {
    log.info("workers disabled — using DisabledQueue");
    return new DisabledQueue();
  }
  if (isEnabled("WORKERS_INMEMORY")) {
    log.info("workers enabled (in-memory)");
    return new InMemoryQueue();
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[jobs] DATABASE_URL is required when WORKERS_ENABLED=true and WORKERS_INMEMORY is unset"
    );
  }
  log.info("workers enabled (pg-boss)");
  return new PgBossQueue(url);
}

export function getQueue(): Queue {
  if (!queue) queue = buildQueue();
  return queue;
}

/** @internal — Vitest helper. */
export function resetQueueForTests(next?: Queue): void {
  queue = next ?? null;
}

/**
 * Enqueue a typed job. Returns the job id or `null` if the backend chose
 * not to enqueue (e.g. duplicate singletonKey).
 */
export async function enqueueJob<
  N extends import("./types").JobName,
>(
  name: N,
  payload: import("./types").JobPayload<N>,
  options?: import("./queue").EnqueueOptions
): Promise<string | null> {
  return getQueue().enqueue(name, payload, options);
}

/** Register a handler for a job. Safe to call before or after `startWorkers()`. */
export function registerJobHandler<N extends import("./types").JobName>(
  name: N,
  handler: import("./queue").JobHandler<N>
): void {
  getQueue().registerHandler(name, handler);
}

/**
 * Start the worker pool. Returns immediately when workers are disabled, so
 * callers can always call this in their bootstrap path.
 */
export async function startWorkers(): Promise<void> {
  if (!flags.workersEnabled()) return;
  await getQueue().start();
}

/** Graceful shutdown helper for SIGTERM/SIGINT handlers. */
export async function stopWorkers(graceMs = 10_000): Promise<void> {
  if (!queue) return;
  await queue.stop(graceMs);
  queue = null;
}
