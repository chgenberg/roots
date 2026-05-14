import type { Queue, JobHandler, EnqueueOptions } from "./queue";
import { jobCatalog, type JobName, type JobPayload } from "./types";
import { childLogger } from "../logger";

/**
 * pg-boss-backed queue. Lazy-imports the `pg-boss` package so dev/test
 * environments without a Postgres URL (or without the dep installed) don't
 * pay the import cost.
 *
 * Worker concurrency, retries, DLQ thresholds etc. follow the recommendations
 * in `docs/feedback-plans/04-ai-agents/07_agent_runtime_and_queue.txt`.
 * The defaults here are deliberately conservative; tighten per-job by passing
 * options to `registerHandler` in a future PR.
 */
export class PgBossQueue implements Queue {
  private log = childLogger("jobs.pg-boss");
  private boss: any = null;
  private handlers = new Map<JobName, JobHandler<any>>();

  constructor(private readonly databaseUrl: string) {}

  registerHandler<N extends JobName>(name: N, handler: JobHandler<N>): void {
    this.handlers.set(name, handler as JobHandler<any>);
    // If boss is already running, attach the worker now too.
    if (this.boss) {
      this.attachWorker(name);
    }
  }

  async start(): Promise<void> {
    // Imported here so the module never throws when pg-boss isn't installed
    // in a given environment (e.g. UI dev mode).
    const { default: PgBoss } = await import("pg-boss");
    this.boss = new PgBoss(this.databaseUrl);
    this.boss.on("error", (err: unknown) =>
      this.log.error({ err }, "boss error")
    );
    await this.boss.start();
    for (const name of this.handlers.keys()) {
      this.attachWorker(name);
    }
    this.log.info(
      { jobs: Array.from(this.handlers.keys()) },
      "pg-boss started"
    );
  }

  private attachWorker(name: JobName): void {
    if (!this.boss) return;
    const handler = this.handlers.get(name);
    if (!handler) return;
    this.boss
      .work(name, async (job: { data: unknown }) => {
        const schema = jobCatalog[name];
        const parsed = schema.safeParse(job.data);
        if (!parsed.success) {
          this.log.error(
            { name, issues: parsed.error.issues },
            "invalid payload from boss"
          );
          throw new Error(`invalid payload for ${name}`);
        }
        await handler({ name, payload: parsed.data as any });
      })
      .catch((err: unknown) =>
        this.log.error({ err, name }, "failed to attach worker")
      );
  }

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: EnqueueOptions
  ): Promise<string | null> {
    if (!this.boss) {
      throw new Error("[jobs] pg-boss not started; call start() first");
    }
    const schema = jobCatalog[name];
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `[jobs] invalid payload for ${name}: ${parsed.error.message}`
      );
    }
    const sendOptions: Record<string, unknown> = {};
    if (options?.singletonKey) sendOptions.singletonKey = options.singletonKey;
    if (options?.startAfterIso) sendOptions.startAfter = options.startAfterIso;

    const id = await this.boss.send(name, parsed.data, sendOptions);
    return id ?? null;
  }

  async stop(graceMs = 10_000): Promise<void> {
    if (!this.boss) return;
    try {
      await this.boss.stop({ graceful: true, timeout: graceMs });
    } finally {
      this.boss = null;
    }
  }
}
