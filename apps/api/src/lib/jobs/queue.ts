import type { JobName, JobPayload } from "./types";
import { jobCatalog, singletonKey } from "./types";

/**
 * Queue abstraction shared by pg-boss and the in-memory test queue.
 *
 * A queue accepts typed payloads, validates against the Zod schema in
 * `jobCatalog`, and deduplicates by `singletonKey`. Implementations may run
 * synchronously (in-memory) or asynchronously (pg-boss).
 *
 * Handlers are registered globally on the queue so worker processes can
 * subscribe to one or more job names.
 */

export interface EnqueueOptions {
  /** Idempotency key — repeated sends with the same key are a no-op. */
  singletonKey?: string;
  /** Defer execution until this ISO timestamp. Optional. */
  startAfterIso?: string;
}

export interface JobContext<N extends JobName> {
  name: N;
  payload: JobPayload<N>;
}

export type JobHandler<N extends JobName> = (
  ctx: JobContext<N>
) => Promise<void> | void;

export interface Queue {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: EnqueueOptions
  ): Promise<string | null>;
  registerHandler<N extends JobName>(name: N, handler: JobHandler<N>): void;
  start(): Promise<void>;
  stop(graceMs?: number): Promise<void>;
}

/**
 * In-memory queue used for unit tests and for `WORKERS_INMEMORY=true` dev
 * environments where Postgres is not available. Behaviour mirrors pg-boss
 * closely enough for handler authoring:
 *  - Validates payload against the Zod schema.
 *  - Honours `singletonKey` — duplicate sends while the singleton is still
 *    pending return `null` (matching pg-boss's `send()` contract). Once the
 *    job has drained, the singleton slot is released and the next enqueue
 *    creates a new job.
 *  - Runs the handler synchronously on `start()` and on each `enqueue()`.
 */
export class InMemoryQueue implements Queue {
  private handlers = new Map<JobName, JobHandler<any>>();
  /** singletonKey → true while a job with that key is pending or running. */
  private singletons = new Set<string>();
  private started = false;
  private idCounter = 0;
  private pending: Array<{
    id: string;
    name: JobName;
    payload: unknown;
    singletonKey?: string;
  }> = [];

  registerHandler<N extends JobName>(name: N, handler: JobHandler<N>): void {
    this.handlers.set(name, handler as JobHandler<any>);
  }

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: EnqueueOptions
  ): Promise<string | null> {
    const schema = jobCatalog[name];
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `[jobs] invalid payload for ${name}: ${parsed.error.message}`
      );
    }

    if (options?.singletonKey && this.singletons.has(options.singletonKey)) {
      // Match pg-boss: a pending job with this singletonKey already exists.
      return null;
    }

    const id = `job_${++this.idCounter}`;
    if (options?.singletonKey) {
      this.singletons.add(options.singletonKey);
    }
    this.pending.push({
      id,
      name,
      payload: parsed.data,
      singletonKey: options?.singletonKey,
    });

    if (this.started) {
      await this.drain();
    }
    return id;
  }

  async start(): Promise<void> {
    this.started = true;
    await this.drain();
  }

  async stop(_graceMs?: number): Promise<void> {
    this.started = false;
  }

  /** Drains pending jobs in FIFO order. Errors propagate. */
  private async drain(): Promise<void> {
    while (this.pending.length > 0) {
      const job = this.pending.shift()!;
      const handler = this.handlers.get(job.name);
      try {
        if (handler) {
          await handler({ name: job.name, payload: job.payload as any });
        }
      } finally {
        // Release the singleton slot whether the handler succeeded, threw,
        // or no handler was registered. Matches pg-boss: once the job leaves
        // the active state, the next enqueue with the same key can run.
        if (job.singletonKey) this.singletons.delete(job.singletonKey);
      }
    }
  }

  // Test helpers
  /** @internal */
  inspectPending(): ReadonlyArray<{ id: string; name: JobName; payload: unknown }> {
    return [...this.pending];
  }
  /** @internal */
  inspectSingletons(): ReadonlySet<string> {
    return new Set(this.singletons);
  }
}

export { singletonKey };
