import { redis } from "./redis";
import { childLogger } from "./logger";
import { isEnabled } from "./flags";
import { captureException } from "./sentry";

const log = childLogger("scheduler");

/**
 * Periodiska jobb som körs i API-processen.
 *
 * Varför här och inte i pg-boss? De schemalagda jobben vi har är få,
 * korta och måste bli av. pg-boss-vägen kräver att både
 * `WORKERS_ENABLED=true` och en separat worker-tjänst är på plats — och
 * precis den sortens "ops slår på det sen"-beroende är anledningen till att
 * GDPR-raderingen aldrig kördes. Endpointen
 * `POST /v1/internal/cron/deletion-purge` fanns, men ingen extern cron var
 * uppsatt, så användare som begärt radering låg kvar i klartext i databasen
 * efter att ångerfristen gått ut. Schemaläggaren startar därför med API:t och
 * kräver ingen konfiguration.
 *
 * Exakthet: ett jobb kör *högst en gång per intervall i hela klustret*, men
 * inte på en exakt tidpunkt. Låset är en Redis-nyckel med TTL = intervallet:
 * varje replik tickar ofta och försöker sätta nyckeln med `NX`. Först till
 * nyckeln kör; övriga hoppar över tills TTL:en gått ut. Det gör att antalet
 * repliker inte påverkar hur ofta jobbet körs, och att en omstart inte
 * återställer schemat.
 */

export interface ScheduledTask {
  /** Låsnyckel och loggnamn. Måste vara stabilt över deploys. */
  name: string;
  /** Minsta tid mellan två körningar i hela klustret. */
  intervalMs: number;
  run: () => Promise<unknown>;
}

/** Hur ofta vi tittar efter om ett jobb är moget att köras. */
const TICK_MS = 60_000;

const tasks: ScheduledTask[] = [];
let timer: NodeJS.Timeout | null = null;
let kickoff: NodeJS.Timeout | null = null;

export function registerScheduledTask(task: ScheduledTask): void {
  tasks.push(task);
}

/**
 * Hur många ticks i rad Redis får vara onåbart innan vi larmar. En tystnad
 * här betyder att jobbet inte körs alls, vilket är precis det fel
 * schemaläggaren finns för att undvika — så det får inte bara bli en warn.
 */
const REDIS_FAILURE_ALERT_THRESHOLD = 10;

/** task.name → antal ticks i rad där Redis inte svarade. */
const redisFailures = new Map<string, number>();

type SlotResult = "claimed" | "taken" | "unavailable";

/**
 * Försöker ta slotten för det här intervallet.
 *
 * "taken" = en annan replik hann före (normalt). "unavailable" = Redis svarar
 * inte; vi hoppar över hellre än att köra olåst och riskera två samtidiga
 * körningar.
 */
async function claimSlot(task: ScheduledTask): Promise<SlotResult> {
  const ttlSeconds = Math.max(1, Math.floor(task.intervalMs / 1000));
  try {
    const res = await redis.set(
      `scheduler:slot:${task.name}`,
      String(Date.now()),
      "EX",
      ttlSeconds,
      "NX"
    );
    redisFailures.delete(task.name);
    return res === "OK" ? "claimed" : "taken";
  } catch (err) {
    const count = (redisFailures.get(task.name) ?? 0) + 1;
    redisFailures.set(task.name, count);
    log.warn(
      { err, task: task.name, consecutive: count },
      "kunde inte nå Redis — hoppar över"
    );
    if (count === REDIS_FAILURE_ALERT_THRESHOLD) {
      captureException(err, {
        tags: { scheduler: task.name, reason: "redis-unavailable" },
      });
    }
    return "unavailable";
  }
}

async function tick(): Promise<void> {
  for (const task of tasks) {
    if ((await claimSlot(task)) !== "claimed") continue;
    const startedAt = Date.now();
    try {
      const result = await task.run();
      log.info(
        { task: task.name, durationMs: Date.now() - startedAt, result },
        "schemalagt jobb klart"
      );
    } catch (err) {
      // En trasig körning får aldrig fälla API:t. Slotten är redan tagen, så
      // nästa försök sker när TTL:en gått ut.
      log.error({ err, task: task.name }, "schemalagt jobb misslyckades");
      captureException(err, { tags: { scheduler: task.name } });
    }
  }
}

/**
 * Startar schemaläggaren. Anropas från serverns bootstrap.
 *
 * Av som standard i test (där tidtagare och Redis inte finns) och kan stängas
 * av i drift med `SCHEDULER_DISABLED=true` om jobben flyttas till extern cron.
 */
export function startScheduler(): void {
  if (timer) return;
  if (process.env.NODE_ENV === "test") return;
  if (isEnabled("SCHEDULER_DISABLED", false)) {
    log.warn("SCHEDULER_DISABLED=true — inga periodiska jobb körs");
    return;
  }
  if (tasks.length === 0) return;

  timer = setInterval(() => void tick(), TICK_MS);
  // Ska inte hålla processen vid liv vid shutdown.
  timer.unref();

  log.info(
    { tasks: tasks.map((t) => ({ name: t.name, intervalMs: t.intervalMs })) },
    "schemaläggare startad"
  );

  // Kör en första tick strax efter start så att en deploy inte behöver vänta
  // en hel tick innan en förfallen radering blir av. Redis-socketen är redan
  // öppnad av `connectRedis()` i bootstrap:en, så den här ticken kan faktiskt
  // ta sin slot — annars hade den alltid avvisats av det första kommandot.
  kickoff = setTimeout(() => void tick(), 10_000);
  kickoff.unref();
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  if (kickoff) clearTimeout(kickoff);
  timer = null;
  kickoff = null;
}

/** @internal — Vitest-hjälpare. */
export function resetScheduledTasksForTests(): void {
  stopScheduler();
  tasks.length = 0;
  redisFailures.clear();
}
