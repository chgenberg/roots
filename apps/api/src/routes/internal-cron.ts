/**
 * MASTERPLAN_01 KC2.7 + KC8.7 — interna cron-endpoints.
 *
 * Trigg:as externt (Railway cron / GitHub Actions / synthetic-runner)
 * med `Authorization: Bearer ${INTERNAL_CRON_TOKEN}`. Token sätts i
 * env. Saknas den i prod → endpoint:en svarar 503 (fail-closed).
 *
 * Endpoints:
 *   POST /v1/internal/cron/deletion-purge   — anonymisera due users
 *
 * Loggar varje run i audit_logs så ops kan svara "när kördes purge
 * senast?" utan att gräva i pino-loggar.
 */

import { Hono } from "hono";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { purgeDueDeletions } from "../lib/deletion-purge";

const log = childLogger("internal-cron");

export const internalCron = new Hono();

function authorize(c: any): { ok: true } | { ok: false; status: 401 | 503 } {
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
  if (!match || match[1] !== token) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}

internalCron.post("/deletion-purge", async (c) => {
  const auth = authorize(c);
  if (!auth.ok) {
    return c.json(
      { error: auth.status === 503 ? "Cron disabled" : "Unauthorized" },
      auth.status
    );
  }

  try {
    const result = await purgeDueDeletions();
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
