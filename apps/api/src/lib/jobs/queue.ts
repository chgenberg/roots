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
  /**
   * Idempotensnyckel. En sändning med en nyckel som redan finns *i kö* är en
   * no-op och returnerar `null`. När jobbet börjat köras är nyckeln fri igen,
   * så ett nytt jobb kan köas medan det förra fortfarande arbetar.
   *
   * Utan nyckel dedupliceras aldrig — varje sändning blir ett eget jobb.
   */
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
 *  - Honours `singletonKey` — en dubblett medan jobbet ligger i kö returnerar
 *    `null`. Nyckeln släpps när jobbet *börjar* köras, inte när handlern är
 *    klar, eftersom pg-boss `stately`-index innehåller `state` och därför
 *    tillåter ett nytt köat jobb medan det förra är `active`. Skillde de sig
 *    hade testerna beskrivit ett annat beteende än produktionen.
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
      // Släpp slotten när jobbet lämnar kön, innan handlern kallas. pg-boss
      // gör samma sak: `stately`-indexet är på (name, state, singleton_key),
      // så ett nytt jobb får köas så snart det förra gått till `active`.
      if (job.singletonKey) this.singletons.delete(job.singletonKey);
      if (handler) {
        await handler({ name: job.name, payload: job.payload as any });
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
