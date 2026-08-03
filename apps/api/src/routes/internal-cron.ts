/**
 * MASTERPLAN_01 KC2.7 + KC8.7 — interna cron-endpoints.
 *
 * Trigg:as externt (Railway cron / GitHub Actions / synthetic-runner)
 * med `Authorization: Bearer ${INTERNAL_CRON_TOKEN}`. Token sätts i
 * env. Saknas den i prod → endpoint:en svarar 503 (fail-closed).
 *
 * Endpoints:
 *   POST /v1/internal/cron/deletion-purge     — anonymisera due users
 *   POST /v1/internal/cron/lead-retention     — radera utgångna leads
 *   POST /v1/internal/cron/monitoring-check   — larma om nedtid och tysta jobb
 *   GET  /v1/internal/cron/status             — tillståndet i klartext
 *
 * Loggar varje run i audit_logs så ops kan svara "när kördes purge
 * senast?" utan att gräva i pino-loggar.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { timingSafeEqual } from "crypto";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { purgeDueDeletions } from "../lib/deletion-purge";
import { purgeExpiredHairAnalysisLeads } from "../lib/lead-retention";
import { internalCronFailRateLimit } from "../lib/rate-limit";
import { recordJobRun, getJobStatuses } from "../lib/monitoring/heartbeat";
import { runMonitoringCheck } from "../lib/monitoring/alerts";
import { checkReadiness } from "../lib/health-checks";

const log = childLogger("internal-cron");

export const internalCron = new Hono();

// P4.12 (audit 2026-05-26): jämför inte med plain !== — gör timing-safe
// så att en angripare inte kan läcka token-prefix via response-tid.
function timingSafeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function authorize(
  c: Context
): Promise<{ ok: true } | { ok: false; status: 401 | 503 | 429 }> {
  const token = process.env.INTERNAL_CRON_TOKEN;
  if (!token) {
    // Saknas helt i prod → vi ska aldrig låta anonymous trigga
    // bakgrundsjobb. I dev/local utan token: returnera 503 så
    // testers märker att de behöver sätta den, men logga också
    // "skipped" istället för att accept:a.
    log.warn("INTERNAL_CRON_TOKEN not set — cron endpoint disabled");
    return { ok: false, status: 503 };
  }
  const header = c.req.header("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !timingSafeStrEqual(match[1], token)) {
    // P3.60 (audit 2026-05-26): tidigare fanns ingen IP-baserad throttle
    // på Bearer-token-validation. Kort token → online guessing. 10 fel
    // per 15 min per IP räcker för legitim cron-trigger som råkar miss:a
    // env-update men stänger fönstret för enumeration.
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await internalCronFailRateLimit(ip);
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.resetInSeconds));
      return { ok: false, status: 429 };
    }
    return { ok: false, status: 401 };
  }
  return { ok: true };
}

internalCron.post("/deletion-purge", async (c) => {
  const auth = await authorize(c);
  if (!auth.ok) {
    const message =
      auth.status === 503
        ? "Cron disabled"
        : auth.status === 429
          ? "Too many failed attempts"
          : "Unauthorized";
    return c.json({ error: message }, auth.status);
  }

  try {
    const result = await purgeDueDeletions();
    // Efter arbetet, inte före: hjärtslaget ska betyda "jobbet blev gjort",
    // inte "cron triggade".
    await recordJobRun("deletion-purge", { purged: result.purged });
    void auditLog({
      userId: null,
      action: "cron.deletion_purge",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        purged: result.purged,
        errors: result.errors,
      },
    });
    return c.json({ ok: true, ...result });
  } catch (err) {
    log.error({ err }, "deletion-purge cron failed");
    return c.json({ error: "purge failed" }, 500);
  }
});

/**
 * POST /v1/internal/cron/lead-retention — raderar håranalys-leads som
 * passerat retention-fönstret. Körs dagligen.
 */
internalCron.post("/lead-retention", async (c) => {
  const auth = await authorize(c);
  if (!auth.ok) {
    const message =
      auth.status === 503
        ? "Cron disabled"
        : auth.status === 429
          ? "Too many failed attempts"
          : "Unauthorized";
    return c.json({ error: message }, auth.status);
  }

  try {
    const result = await purgeExpiredHairAnalysisLeads();
    await recordJobRun("lead-retention", { deleted: result.deleted });
    void auditLog({
      userId: null,
      action: "cron.lead_retention",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        deleted: result.deleted,
        retentionDays: result.retentionDays,
      },
    });
    return c.json({ ok: true, ...result });
  } catch (err) {
    log.error({ err }, "lead-retention cron failed");
    return c.json({ error: "purge failed" }, 500);
  }
});

/**
 * POST /v1/internal/cron/monitoring-check — kontrollerar databas, Redis och
 * att de schemalagda jobben hört av sig, och larmar om något inte stämmer.
 *
 * Körs var femte minut. Att den triggas utifrån är själva poängen: en process
 * kan inte larma om att den själv ligger nere. Det sista steget — "hela API:et
 * svarar inte" — måste komma från en extern uppetidsvakt som pollar /readyz.
 * Se docs/runbooks/monitoring.md.
 */
internalCron.post("/monitoring-check", async (c) => {
  const auth = await authorize(c);
  if (!auth.ok) {
    const message =
      auth.status === 503
        ? "Cron disabled"
        : auth.status === 429
          ? "Too many failed attempts"
          : "Unauthorized";
    return c.json({ error: message }, auth.status);
  }

  try {
    const result = await runMonitoringCheck();
    // Loggas bara när något faktiskt larmades. En kontroll var femte minut
    // som alltid skriver till audit_logs gör loggen oläsbar.
    if (result.sent.length) {
      void auditLog({
        userId: null,
        action: "cron.monitoring_alert",
        meta: {
          ...requestContext((n) => c.req.header(n)),
          sent: result.sent,
          suppressed: result.suppressed,
        },
      });
    }
    return c.json({ ok: true, ...result });
  } catch (err) {
    log.error({ err }, "monitoring-check cron failed");
    return c.json({ error: "check failed" }, 500);
  }
});

/**
 * GET /v1/internal/cron/status — tillståndet i klartext, för en extern
 * uppetidsvakt eller för den som felsöker.
 *
 * Separat från /readyz eftersom /readyz är Railways healthcheck och därmed
 * publik. Jobbnamn och tidsstämplar hör inte där.
 */
internalCron.get("/status", async (c) => {
  const auth = await authorize(c);
  if (!auth.ok) {
    return c.json({ error: "Unauthorized" }, auth.status);
  }

  const [readiness, jobs] = await Promise.all([
    checkReadiness(),
    getJobStatuses(),
  ]);
  const staleJobs = jobs.filter((j) => j.stale);
  const ok = readiness.ok && staleJobs.length === 0;

  return c.json(
    {
      ok,
      db: readiness.db,
      redis: readiness.redis,
      jobs,
      checkedAt: new Date().toISOString(),
    },
    // 503 när något är fel, så en uppetidsvakt kan larma på statuskoden
    // utan att kunna tolka JSON.
    ok ? 200 : 503
  );
});
