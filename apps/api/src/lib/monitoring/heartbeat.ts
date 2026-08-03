import { redis } from "../redis";
import { childLogger } from "../logger";

const log = childLogger("heartbeat");

/**
 * Dödmansgrepp för schemalagda jobb.
 *
 * Sentry fångar fel. Det den inte kan fånga är tystnad: ett cron-jobb som
 * slutar triggas ger inga fel alls, för ingen kod körs. Det är det farligaste
 * driftläget vi har, eftersom allt ser normalt ut. Om deletion-purge tystnar
 * behåller vi personuppgifter som en användare bett oss radera, och det är
 * ingen som märker förrän någon frågar.
 *
 * Varje jobb registrerar sin senaste lyckade körning här. En kontroll jämför
 * åldern mot det förväntade intervallet och larmar när ett jobb varit tyst
 * för länge. Poängen är att vi larmar på FRÅNVARO av något, vilket kräver att
 * vi vet vad vi förväntar oss.
 *
 * Redis och inte databasen: värdet är litet, skrivs ofta och behöver inte
 * överleva en flush — tappar vi det ser jobbet ut som aldrig kört, vilket
 * larmar en gång i onödan och sedan självläker. Det är rätt håll att fela på.
 */

export interface JobExpectation {
  /** Nyckel i Redis och i statussvaret. */
  name: string;
  /** Vad som går sönder om jobbet tystnar. Hamnar i larmet. */
  description: string;
  /** Hur ofta jobbet ska köra, i timmar. */
  intervalHours: number;
  /**
   * Hur länge efter förväntad körning vi väntar innan vi larmar. Ett dagligt
   * jobb som kör 03:00 kan glida en timme utan att något är fel; larmar vi på
   * minuten blir larmen brus och då slutar folk läsa dem.
   */
  graceHours: number;
}

export const MONITORED_JOBS: JobExpectation[] = [
  {
    name: "deletion-purge",
    description:
      "Anonymiserar konton vars raderingsfrist gått ut. Tystnar det behåller vi personuppgifter som någon bett oss radera.",
    // Matchar schemat i scheduled-tasks.ts. Ändras ett av dem måste det andra
    // ändras med, annars larmar vi antingen falskt eller för sent.
    intervalHours: 6,
    graceHours: 6,
  },
  {
    name: "lead-retention",
    description:
      "Raderar håranalys-leads som passerat lagringstiden. Samma sak: tystnad betyder att vi sparar personuppgifter längre än vi sagt.",
    intervalHours: 24,
    graceHours: 12,
  },
];

const KEY_PREFIX = "heartbeat:job:";
// TTL:n är generös så att en tystnad går att se länge efteråt. Utan TTL
// samlas nycklar för jobb vi tagit bort.
const HEARTBEAT_TTL_S = 60 * 60 * 24 * 30;

/**
 * När vi först saknade ett hjärtslag för ett jobb.
 *
 * Ett jobb med sex timmars intervall har rimligen inte kört strax efter en
 * deploy, och utan den här tidpunkten larmade vi "har aldrig kört" inom fem
 * minuter varje gång vi rullade ut. Det är brus, och brus lär folk att inte
 * läsa larmen — vilket gör hela dödmansgreppet meningslöst.
 *
 * Processens uppetid duger inte som referens: den nollställs vid varje deploy,
 * så ett jobb som verkligen slutat triggas skulle aldrig hinna bli tyst nog
 * när vi deployar ofta. Märket ligger därför i Redis och överlever omstarter.
 */
const FIRST_SEEN_PREFIX = "heartbeat:first-seen:";

/**
 * Registrerar en lyckad körning. Anropas efter att jobbet gjort sitt, inte
 * före — annars mäter vi att cron triggade, inte att arbetet blev gjort.
 */
export async function recordJobRun(
  name: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    await redis.set(
      `${KEY_PREFIX}${name}`,
      JSON.stringify({ at: new Date().toISOString(), ...meta }),
      "EX",
      HEARTBEAT_TTL_S
    );
    // Jobbet har kört; väntetiden räknas om från noll nästa gång hjärtslaget
    // hunnit gå ut. Utan städningen skulle ett gammalt märke göra att vi
    // larmade direkt efter att hjärtslagets TTL löpt ut.
    await redis.del(`${FIRST_SEEN_PREFIX}${name}`);
  } catch (err) {
    // Ett jobb ska aldrig fela på att hjärtslaget inte kunde skrivas. Vi
    // förlorar synligheten, inte arbetet.
    log.warn({ err, name }, "kunde inte spara hjärtslag");
  }
}

export interface JobStatus {
  name: string;
  description: string;
  intervalHours: number;
  lastRunAt: string | null;
  ageHours: number | null;
  /** Sant när jobbet varit tyst längre än intervall + tolerans. */
  stale: boolean;
  meta?: Record<string, unknown>;
}

/**
 * Har jobbet saknat hjärtslag längre än det borde ha behövt för att köra?
 *
 * Sätter märket första gången och svarar då nej: vid det tillfället vet vi
 * bara att jobbet inte kört än, inte att något är fel.
 *
 * Kan vi inte nå Redis svarar vi nej. Att larma om ett jobb när vi egentligen
 * inte vet något vore ett larm om Redis, och Redis övervakas för sig.
 */
async function missingLongEnough(job: JobExpectation): Promise<boolean> {
  const key = `${FIRST_SEEN_PREFIX}${job.name}`;
  const now = Date.now();
  try {
    const set = await redis.set(
      key,
      String(now),
      "EX",
      HEARTBEAT_TTL_S,
      "NX"
    );
    if (set === "OK") return false;

    const raw = await redis.get(key);
    const since = raw ? Number(raw) : NaN;
    if (!Number.isFinite(since)) return false;

    const waitedHours = (now - since) / (1000 * 60 * 60);
    return waitedHours > job.intervalHours + job.graceHours;
  } catch (err) {
    log.warn({ err, name: job.name }, "kunde inte läsa väntetid för jobb");
    return false;
  }
}

export async function getJobStatuses(): Promise<JobStatus[]> {
  const out: JobStatus[] = [];

  for (const job of MONITORED_JOBS) {
    let raw: string | null = null;
    try {
      raw = await redis.get(`${KEY_PREFIX}${job.name}`);
    } catch (err) {
      log.warn({ err, name: job.name }, "kunde inte läsa hjärtslag");
    }

    if (!raw) {
      // Aldrig körd är precis det problem vi letar efter — ofta en cron som
      // inte konfigurerats. Men det blir bara ett problem när jobbet HUNNIT
      // köra, så vi räknar från första gången vi saknade hjärtslaget.
      out.push({
        name: job.name,
        description: job.description,
        intervalHours: job.intervalHours,
        lastRunAt: null,
        ageHours: null,
        stale: await missingLongEnough(job),
      });
      continue;
    }

    let parsed: { at?: string } & Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* trasigt värde behandlas som saknat nedan */
    }

    const at = typeof parsed.at === "string" ? parsed.at : null;
    const ageHours = at
      ? (Date.now() - new Date(at).getTime()) / (1000 * 60 * 60)
      : null;
    const { at: _at, ...meta } = parsed;

    out.push({
      name: job.name,
      description: job.description,
      intervalHours: job.intervalHours,
      lastRunAt: at,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      stale:
        ageHours === null || ageHours > job.intervalHours + job.graceHours,
      meta: Object.keys(meta).length ? meta : undefined,
    });
  }

  return out;
}
