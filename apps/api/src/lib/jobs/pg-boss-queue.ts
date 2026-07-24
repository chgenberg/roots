import { randomUUID } from "crypto";
import type { Queue, JobHandler, EnqueueOptions } from "./queue";
import { jobCatalog, ALL_JOB_NAMES, type JobName, type JobPayload } from "./types";
import { childLogger } from "../logger";

/**
 * pg-boss-backad kö. Paketet lazy-importeras så att miljöer utan Postgres
 * (eller utan beroendet installerat) inte betalar importkostnaden.
 *
 * Tre saker som pg-boss 10 kräver, och som saknades tidigare:
 *
 *  1. **Köer måste skapas explicit.** Från v10 ligger jobb i en partitionerad
 *     tabell som joinar mot `queue`-tabellen. `send()` mot en kö som inte
 *     skapats med `createQueue()` skriver ingen rad — och returnerar `null`,
 *     samma värde som en deduplicerad singleton. Jobb försvann alltså tyst.
 *  2. **`work()`-callbacken får en array**, inte ett jobb. Koden läste
 *     `job.data` på arrayen, vilket blev `undefined`, vilket fick Zod-
 *     valideringen att fälla *varje* jobb som "invalid payload".
 *  3. **Dedupliceringen beror på köns policy.** `singletonKey` gör ingenting
 *     under standardpolicyn. `stately` ger ett unikt index på
 *     `(name, state, COALESCE(singleton_key, ''))` för tillstånd till och med
 *     `active`, vilket är den deduplicering `EnqueueOptions.singletonKey`
 *     utlovar.
 *
 *     Fällan i `COALESCE(..., '')`: jobb *utan* nyckel får alla samma
 *     indexpost och deduplicerar därför mot varandra. Två nyckellösa
 *     sändningar till samma kö blev ett enda jobb — samma tysta förlust som
 *     punkt 1. Därför sätter `enqueue()` en slumpad nyckel när anroparen inte
 *     angett någon: då kolliderar nyckellösa jobb aldrig, och ett `null`-svar
 *     betyder entydigt "deduplicerat mot en uttrycklig nyckel".
 */

/** Minimal yta av pg-boss vi använder — undviker `any` på instansen. */
interface Boss {
  start(): Promise<unknown>;
  stop(opts: { graceful: boolean; timeout: number }): Promise<unknown>;
  on(event: "error", cb: (err: unknown) => void): void;
  createQueue(name: string, options?: Record<string, unknown>): Promise<unknown>;
  updateQueue(name: string, options?: Record<string, unknown>): Promise<unknown>;
  getQueue(name: string): Promise<{ policy?: string } | null>;
  send(
    name: string,
    data: unknown,
    options?: Record<string, unknown>
  ): Promise<string | null>;
  work(
    name: string,
    options: Record<string, unknown>,
    handler: (jobs: Array<{ id: string; data: unknown }>) => Promise<void>
  ): Promise<string>;
}

/** Jobb som misslyckats efter alla omförsök hamnar här i stället för att tappas. */
const DEAD_LETTER_QUEUE = "system.dead-letter";

export class PgBossQueue implements Queue {
  private log = childLogger("jobs.pg-boss");
  private boss: Boss | null = null;
  private handlers = new Map<JobName, JobHandler<JobName>>();
  /** Köer vi redan bekräftat finns, så vi inte anropar createQueue i onödan. */
  private ensured = new Set<string>();

  constructor(private readonly databaseUrl: string) {}

  registerHandler<N extends JobName>(name: N, handler: JobHandler<N>): void {
    this.handlers.set(name, handler as JobHandler<JobName>);
    // Om kön redan är startad: koppla på arbetaren direkt.
    if (this.boss) void this.attachWorker(name);
  }

  async start(): Promise<void> {
    // Importeras här så att modulen aldrig kastar i miljöer utan pg-boss.
    const { default: PgBoss } = await import("pg-boss");
    const boss = new PgBoss(this.databaseUrl) as unknown as Boss;
    this.boss = boss;
    boss.on("error", (err: unknown) => this.log.error({ err }, "boss error"));
    await boss.start();

    // Skapa varje kö i katalogen — inte bara de vi har handlers för. API-
    // processen registrerar inga handlers men *köar* jobb, och en send() mot
    // en kö som inte finns tappas tyst.
    await this.ensureQueues([DEAD_LETTER_QUEUE, ...ALL_JOB_NAMES]);

    // Kastar vidare: en worker-process som inte fick sina arbetare påkopplade
    // ska dö, inte logga "workers ready" och sedan stå tyst.
    for (const name of this.handlers.keys()) {
      await this.attachWorker(name, { rethrow: true });
    }

    this.log.info(
      { queues: ALL_JOB_NAMES.length, workers: Array.from(this.handlers.keys()) },
      "pg-boss started"
    );
  }

  private async ensureQueues(names: string[]): Promise<void> {
    if (!this.boss) return;
    for (const name of names) {
      if (this.ensured.has(name)) continue;
      // Dead-letter-kön har medvetet ingen egen dead letter — annars blir det
      // en kedja utan slut.
      const options: Record<string, unknown> =
        name === DEAD_LETTER_QUEUE
          ? { policy: "standard" }
          : {
              // Ger `singletonKey` den innebörd kö-kontraktet utlovar.
              policy: "stately",
              retryLimit: 3,
              retryDelay: 30,
              retryBackoff: true,
              deadLetter: DEAD_LETTER_QUEUE,
            };
      // Idempotent i pg-boss — men just därför: `createQueue` är
      // `INSERT ... ON CONFLICT DO NOTHING`, så en kö som redan finns behåller
      // sin gamla policy och vår `stately` ignoreras tyst. Då slutar
      // `singletonKey` deduplicera utan att något syns. Rätta till i stället.
      await this.boss.createQueue(name, options);
      const existing = await this.boss.getQueue(name);
      const wanted = options.policy as string;
      if (existing && existing.policy !== wanted) {
        this.log.warn(
          { name, from: existing.policy, to: wanted },
          "kön fanns med annan policy — uppdaterar"
        );
        await this.boss.updateQueue(name, options);
      }
      this.ensured.add(name);
    }
  }

  private async attachWorker(
    name: JobName,
    opts: { rethrow?: boolean } = {}
  ): Promise<void> {
    const boss = this.boss;
    if (!boss) return;
    const handler = this.handlers.get(name);
    if (!handler) return;
    try {
      await this.ensureQueues([name]);
      await boss.work(name, { batchSize: 1 }, async (jobs) => {
        // v10 levererar alltid en array, även med batchSize 1.
        for (const job of jobs) {
          const parsed = jobCatalog[name].safeParse(job.data);
          if (!parsed.success) {
            this.log.error(
              { name, jobId: job.id, issues: parsed.error.issues },
              "invalid payload from boss"
            );
            // Kastar → pg-boss försöker igen och skickar sedan till
            // dead-letter-kön. Bättre än att svälja tysta datafel.
            throw new Error(`invalid payload for ${name}`);
          }
          await handler({ name, payload: parsed.data as JobPayload<JobName> });
        }
      });
    } catch (err) {
      this.log.error({ err, name }, "failed to attach worker");
      if (opts.rethrow) throw err;
    }
  }

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: EnqueueOptions
  ): Promise<string | null> {
    if (!this.boss) {
      throw new Error("[jobs] pg-boss not started; call start() first");
    }
    const parsed = jobCatalog[name].safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `[jobs] invalid payload for ${name}: ${parsed.error.message}`
      );
    }

    // Om enqueue sker innan start() hunnit skapa köerna (eller för en kö som
    // lagts till efteråt) skapar vi den här — annars tappas jobbet.
    await this.ensureQueues([name]);

    // Utan nyckel: slumpa en, så att jobbet inte deduplicerar mot andra
    // nyckellösa jobb via COALESCE(singleton_key, '') i stately-indexet.
    const sendOptions: Record<string, unknown> = {
      singletonKey: options?.singletonKey ?? randomUUID(),
    };
    if (options?.startAfterIso) sendOptions.startAfter = options.startAfterIso;

    const id = await this.boss.send(name, parsed.data, sendOptions);

    if (id === null && !options?.singletonKey) {
      // Nyckeln var slumpad och kan alltså inte ha kolliderat. Något hindrade
      // insert:en, och den anropande koden tror annars att jobbet är köat.
      throw new Error(
        `[jobs] pg-boss accepted no job for ${name} — kön kunde inte skrivas till`
      );
    }
    return id ?? null;
  }

  async stop(graceMs = 10_000): Promise<void> {
    if (!this.boss) return;
    try {
      await this.boss.stop({ graceful: true, timeout: graceMs });
    } finally {
      this.boss = null;
      this.ensured.clear();
    }
  }
}
