import { redis } from "../redis";
import { childLogger } from "../logger";
import { captureException } from "../sentry";
import { getEmailSender } from "../email";
import { checkReadiness } from "../health-checks";
import { getJobStatuses } from "./heartbeat";

const log = childLogger("alerts");

/**
 * Larm när något är fel — eller när något slutat höra av sig.
 *
 * Vi hade tre sätt att se att plattformen mådde bra, och inget av dem
 * väckte någon: `/readyz` som ingen pollade, Sentry som bara ser fel som
 * faktiskt kastas, och loggar som ingen läser om natten. Ett tystnat
 * cron-jobb eller en databas som slutat svara kunde alltså pågå till någon
 * råkade titta.
 *
 * Den här modulen kontrollerar tillståndet och skickar ett larm när något
 * inte stämmer. Den anropas från en cron-endpoint, alltså utifrån — en
 * process kan inte larma om att den själv är nere. Det yttersta skyddet mot
 * "hela API:et svarar inte" måste komma från en extern uppetidsvakt som
 * pollar `/readyz`; se docs/runbooks/monitoring.md.
 */

export interface AlertProblem {
  key: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
}

/**
 * Hur länge ett larm hålls tyst efter att det skickats.
 *
 * Utan den här spärren skickar en femminuterscron 288 mejl per dygn om en
 * databas ligger nere, och då slutar mottagaren läsa dem — vilket gör att
 * nästa riktiga larm också missas. Ett larm per problem var fjärde timme
 * räcker för att någon ska agera.
 */
const ALERT_COOLDOWN_S = 4 * 60 * 60;

async function shouldSend(key: string): Promise<boolean> {
  try {
    // NX + EX i ett anrop: två instanser som kör kontrollen samtidigt ska
    // inte kunna skicka samma larm två gånger.
    const set = await redis.set(`alert:sent:${key}`, "1", "EX", ALERT_COOLDOWN_S, "NX");
    return set === "OK";
  } catch (err) {
    // Kan vi inte nå Redis vet vi inte om larmet redan gått ut. Då skickar
    // vi: ett dubblerat larm är ett mindre problem än ett uteblivet.
    log.warn({ err, key }, "kunde inte kontrollera larm-spärr; skickar ändå");
    return true;
  }
}

/** Rensar spärren när problemet är borta, så nästa gång larmar direkt. */
async function clearSent(key: string): Promise<void> {
  try {
    await redis.del(`alert:sent:${key}`);
  } catch {
    /* spärren löper ut av sig själv */
  }
}

export async function collectProblems(): Promise<AlertProblem[]> {
  const problems: AlertProblem[] = [];

  const readiness = await checkReadiness();
  if (!readiness.db.ok) {
    problems.push({
      key: "db-down",
      severity: "critical",
      title: "Databasen svarar inte",
      detail:
        readiness.db.error ??
        "Ingen respons inom tidsgränsen. Ingen order kan tas emot och ingen kan logga in.",
    });
  }
  if (!readiness.redis.ok) {
    problems.push({
      key: "redis-down",
      severity: "critical",
      title: "Redis svarar inte",
      detail:
        readiness.redis.error ??
        "Sessioner, rate-limits och köer ligger här. Utan Redis kan ingen logga in.",
    });
  }

  for (const job of await getJobStatuses()) {
    if (!job.stale) continue;
    problems.push({
      key: `job-stale-${job.name}`,
      // Varning och inte kritiskt: ett tystnat retention-jobb är allvarligt,
      // men det stoppar inte försäljningen samma minut som en nedlagd databas.
      severity: "warning",
      title: `Jobbet ${job.name} har tystnat`,
      detail:
        (job.lastRunAt
          ? `Senaste körning ${job.lastRunAt} (${job.ageHours} h sedan, förväntat var ${job.intervalHours} h). `
          : "Jobbet har aldrig rapporterat en körning. Kontrollera att cron är konfigurerad. ") +
        job.description,
    });
  }

  return problems;
}

function renderEmail(problems: AlertProblem[]): { subject: string; html: string; text: string } {
  const critical = problems.filter((p) => p.severity === "critical");
  const subject = critical.length
    ? `[Roots] Kritiskt: ${critical[0].title}`
    : `[Roots] Varning: ${problems[0].title}`;

  const lines = problems.map(
    (p) =>
      `${p.severity === "critical" ? "KRITISKT" : "Varning"}: ${p.title}\n${p.detail}`
  );

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px;">
      <h2 style="margin: 0 0 16px;">Roots — driftlarm</h2>
      ${problems
        .map(
          (p) => `
        <div style="border-left: 3px solid ${
          p.severity === "critical" ? "#B42318" : "#B54708"
        }; padding: 8px 0 8px 12px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-weight: 600;">${p.title}</p>
          <p style="margin: 0; color: #475467; font-size: 14px;">${p.detail}</p>
        </div>`
        )
        .join("")}
      <p style="color: #667085; font-size: 13px;">
        Kontrollerat ${new Date().toISOString()}. Samma larm skickas inte igen
        inom fyra timmar. Se docs/runbooks/monitoring.md.
      </p>
    </div>`;

  return { subject, html, text: lines.join("\n\n") };
}

export interface AlertRunResult {
  checked: number;
  problems: AlertProblem[];
  sent: string[];
  suppressed: string[];
}

/**
 * Kontrollerar tillståndet och larmar om det som är nytt.
 *
 * Larmen går till både e-post och Sentry. E-post för att någon ska bli väckt,
 * Sentry för att larmet ska hamna i samma tidslinje som felen — annars går
 * det inte att se att databasen låg nere precis före de tvåhundra 500-svaren.
 */
export async function runMonitoringCheck(): Promise<AlertRunResult> {
  const problems = await collectProblems();
  const sent: string[] = [];
  const suppressed: string[] = [];

  // Problem som försvunnit: rensa spärren så att nästa förekomst larmar
  // direkt i stället för att tystas av en gammal spärr.
  const active = new Set(problems.map((p) => p.key));
  for (const key of ["db-down", "redis-down"]) {
    if (!active.has(key)) await clearSent(key);
  }
  for (const job of await getJobStatuses()) {
    if (!job.stale) await clearSent(`job-stale-${job.name}`);
  }

  const toSend: AlertProblem[] = [];
  for (const problem of problems) {
    if (await shouldSend(problem.key)) {
      toSend.push(problem);
      sent.push(problem.key);
    } else {
      suppressed.push(problem.key);
    }
  }

  if (toSend.length) {
    const recipient = process.env.ALERT_EMAIL;
    if (recipient) {
      const { subject, html, text } = renderEmail(toSend);
      try {
        await getEmailSender().sendEmail({ to: recipient, subject, html, text });
      } catch (err) {
        log.error({ err }, "kunde inte skicka larm-mejl");
      }
    } else {
      // Ingen mottagare konfigurerad är i sig något att veta om — annars
      // ser övervakningen ut att fungera medan larmen går ingenstans.
      log.error(
        { problems: toSend.map((p) => p.key) },
        "ALERT_EMAIL saknas — larmet loggas men skickas inte"
      );
    }

    for (const problem of toSend) {
      captureException(new Error(`[monitoring] ${problem.title}`), {
        tags: { source: "monitoring", severity: problem.severity },
        extra: { detail: problem.detail, key: problem.key },
      });
    }
  }

  if (problems.length) {
    log.warn({ problems, sent, suppressed }, "driftkontroll hittade problem");
  } else {
    log.info("driftkontroll: allt ser normalt ut");
  }

  return { checked: problems.length, problems, sent, suppressed };
}
