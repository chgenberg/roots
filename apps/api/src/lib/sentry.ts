/**
 * Sentry initialisation wrapper (Sprint D+1 — Observability).
 *
 * Design goals:
 *   - **Opt-in by env**. No `SENTRY_DSN` set → every export here becomes
 *     a no-op. Critical so tests, local dev, and any deployment that
 *     hasn't been wired to a Sentry org just keeps working.
 *   - **Single source of truth**. Routes call `captureException(err)`
 *     instead of importing `@sentry/node` directly. That way the
 *     fail-open behaviour is enforced in one place and we can swap
 *     transports (DataDog, Honeycomb, …) without touching call sites.
 *   - **Safe to call before `validateEnvOrExit()`**. We init Sentry at
 *     the very top of `start()` so even crashes during env-validation
 *     get reported — but we never throw from `initSentry()` itself.
 *   - **PII off by default**. `sendDefaultPii: false` prevents IPs,
 *     cookies, and request bodies from being shipped. We add explicit
 *     `tags`/`extra` per error site when something useful needs to go.
 *
 * Versioning: pinned to @sentry/node v10 which uses the OpenTelemetry-
 * based runtime. The legacy v7 `Handlers.errorHandler()` middleware is
 * deprecated; we use `Sentry.captureException()` directly from a Hono
 * `onError` handler instead.
 */

import * as Sentry from "@sentry/node";
import { childLogger } from "./logger";

const log = childLogger("sentry");

let initialized = false;

/**
 * Call once at process boot. Subsequent calls are no-ops.
 * Reads `SENTRY_DSN` (required), `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`,
 * and `SENTRY_TRACES_SAMPLE_RATE` from env.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || dsn.trim() === "") {
    // Quiet in dev. validate-env.ts already warns at boot when the DSN
    // is missing in production.
    return;
  }

  try {
    const tracesSampleRate = Number(
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
    );
    Sentry.init({
      dsn,
      environment:
        process.env.SENTRY_ENVIRONMENT ||
        process.env.NODE_ENV ||
        "development",
      // SENTRY_RELEASE is typically `${gitSha}-${deployId}`; falls back
      // to a constant so multiple deploys without the var still group.
      release: process.env.SENTRY_RELEASE || "roots-api@unknown",
      tracesSampleRate: Number.isFinite(tracesSampleRate)
        ? tracesSampleRate
        : 0.1,
      sendDefaultPii: false,
      // We surface our own log lines via pino; Sentry's auto-breadcrumbs
      // for `console.*` would double the noise.
      integrations: (defaults) =>
        defaults.filter((i) => i.name !== "Console"),
    });
    initialized = true;
    log.info(
      { environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV },
      "Sentry initialised"
    );
  } catch (err) {
    // Refuse to crash the API just because telemetry failed to wire up.
    // The orchestrator-rollback story belongs to validate-env, not here.
    log.error({ err }, "Sentry init failed — continuing without telemetry");
  }
}

/**
 * Report an error. Becomes a no-op if Sentry was never initialised
 * (missing DSN or init failure).
 *
 * `context` is folded into `tags` (short, indexed strings — good for
 * filtering) and `extra` (free-form JSON — good for incident debug).
 */
export function captureException(
  err: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  if (!initialized) return;
  try {
    Sentry.withScope((scope) => {
      if (context?.tags) {
        for (const [k, v] of Object.entries(context.tags)) {
          scope.setTag(k, v);
        }
      }
      if (context?.extra) {
        for (const [k, v] of Object.entries(context.extra)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureException(err);
    });
  } catch (innerErr) {
    log.warn({ err: innerErr }, "Sentry captureException failed");
  }
}

/**
 * Flush queued events to Sentry's ingestion endpoint. Call from
 * SIGTERM/SIGINT handlers so we don't lose the last error when the
 * orchestrator pulls the plug.
 *
 * `timeoutMs` is honoured — we never block shutdown longer than that.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch (err) {
    log.warn({ err }, "Sentry flush failed");
  }
}

/** Test-only escape hatch — lets `validate-env.test`-style helpers reset state. */
export function __resetSentryForTests(): void {
  initialized = false;
}
