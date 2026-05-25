/**
 * Production env-validation (Sprint D — Prod-konfig).
 *
 * Runs once at API boot before we accept HTTP traffic. In `NODE_ENV=
 * production` it fails fast with a clear, single-line error if any
 * required variable is missing OR if it looks like the still-unrotated
 * dev placeholder. Outside of production it just logs warnings so
 * `pnpm dev` keeps working with the example values.
 *
 * Why a separate module:
 *   - Some env-vars are guarded individually (`csrf.ts` already throws
 *     on missing `CSRF_SECRET`), but those checks happen lazily on first
 *     use. We want the orchestrator to see the failure during boot so
 *     it can roll the deploy back BEFORE a single user request runs.
 *   - Centralised list = a single place to update when a new credential
 *     becomes mandatory.
 *
 * Categories:
 *   - REQUIRED:    boot fails (prod) / loud warning (dev)
 *   - RECOMMENDED: warn in prod, silent in dev (feature degrades cleanly)
 *   - PLACEHOLDER_PATTERNS: substrings that signal "this is the example
 *     value, please rotate me before going live"
 */

import { childLogger } from "./logger";

const log = childLogger("env");

interface EnvVar {
  name: string;
  /** Hint about what this controls — surfaces in the error message. */
  purpose: string;
}

/**
 * Variables WITHOUT which the API cannot safely serve a production
 * request. Refusing to boot is the right call:
 *   - `DATABASE_URL` — no DB, no anything.
 *   - `REDIS_URL` — sessions require Redis in prod (see session.ts).
 *   - `CSRF_SECRET` — mintable tokens without a secret = trivial CSRF.
 *   - `CORS_ORIGIN` — wrong CORS = either broken site or open API.
 *   - `NEXT_PUBLIC_SITE_URL` — used in Klarna redirect / email links.
 */
const REQUIRED_IN_PROD: ReadonlyArray<EnvVar> = [
  { name: "DATABASE_URL", purpose: "Postgres connection string" },
  { name: "REDIS_URL", purpose: "Redis connection (sessions, rate-limit)" },
  { name: "CSRF_SECRET", purpose: "HMAC secret for CSRF tokens" },
  { name: "CORS_ORIGIN", purpose: "Allowed browser origin for /v1/* calls" },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    purpose: "Canonical site URL used in payment redirects + emails",
  },
];

/**
 * Variables that gate optional integrations. Missing → feature is off,
 * not a boot failure. Logged once at startup so ops can see at a glance
 * what's been wired up in this environment.
 */
const RECOMMENDED_IN_PROD: ReadonlyArray<EnvVar> = [
  {
    name: "OPENAI_API_KEY",
    purpose: "Hair-analysis vision + Open Claw assistant (AI features off without it)",
  },
  {
    name: "RESEND_API_KEY",
    purpose: "Transactional email (welcome, invites, contact form) — falls back to no-op stub without it",
  },
  {
    name: "KLARNA_WEBHOOK_SECRET",
    purpose: "HMAC verification of Klarna payment webhooks (IP allowlist is the only fallback)",
  },
  // MASTERPLAN_01 KC8.1: utan dessa går inga riktiga betalningar genom
  // Klarna i prod. Saknas de bör vi varna högt vid boot så ops vet att
  // checkout är degraderad.
  {
    name: "KLARNA_USERNAME",
    purpose: "Basic-auth username mot Klarna Checkout API (utan denna kan inga sessions skapas)",
  },
  {
    name: "KLARNA_PASSWORD",
    purpose: "Basic-auth password mot Klarna Checkout API",
  },
  {
    name: "FORTNOX_WEBHOOK_SECRET",
    purpose: "HMAC verification of Fortnox invoice webhooks (no fallback)",
  },
  {
    name: "FORTNOX_TOKEN",
    purpose: "Bearer-token för Fortnox API. Om FORTNOX_ENABLED=true men token saknas degraderas vi tyst till NullProvider",
  },
  {
    name: "SENTRY_DSN",
    purpose: "Error tracking + alerting (no DSN → uncaught errors only land in stdout)",
  },
];

/**
 * MASTERPLAN_01 KC8.1: vissa optional integrationer måste fail-fast i
 * prod när de är explicit enabled men misconfigured. Annars degraderar
 * vi tyst (NullProvider, skip-webhook etc.) och fakturor skapas aldrig.
 */
interface ConditionalRequirement {
  enabledByEnv: string;
  enabledValue: string;
  requires: ReadonlyArray<EnvVar>;
}

const CONDITIONAL_REQUIREMENTS: ReadonlyArray<ConditionalRequirement> = [
  {
    enabledByEnv: "FORTNOX_ENABLED",
    enabledValue: "true",
    requires: [
      { name: "FORTNOX_TOKEN", purpose: "Fortnox bearer-token" },
      { name: "FORTNOX_CLIENT_SECRET", purpose: "Fortnox client secret" },
    ],
  },
];

/**
 * Strings that strongly suggest someone deployed `.env.example` without
 * rotating the placeholders. Case-insensitive substring match against
 * each REQUIRED var's value.
 */
const PLACEHOLDER_PATTERNS: ReadonlyArray<string> = [
  "change-me",
  "REPLACE-ME",
  "your-",
  "stub",
  "dev-csrf-secret",
];

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

interface ValidationReport {
  ok: boolean;
  missing: string[];
  placeholders: string[];
  recommendedMissing: string[];
  /** Vars som krävs pga en aktiverad feature (ex: FORTNOX_ENABLED=true). */
  conditionalMissing: string[];
}

/** Pure function so tests can drive it without touching `process.exit`. */
export function checkEnv(
  env: NodeJS.ProcessEnv,
  isProd: boolean
): ValidationReport {
  const missing: string[] = [];
  const placeholders: string[] = [];
  const recommendedMissing: string[] = [];
  const conditionalMissing: string[] = [];

  for (const v of REQUIRED_IN_PROD) {
    const raw = env[v.name];
    if (!raw || raw.trim() === "") {
      missing.push(`${v.name} (${v.purpose})`);
      continue;
    }
    if (isProd && looksLikePlaceholder(raw)) {
      placeholders.push(`${v.name} (${v.purpose})`);
    }
  }

  if (isProd) {
    for (const v of RECOMMENDED_IN_PROD) {
      const raw = env[v.name];
      if (!raw || raw.trim() === "" || looksLikePlaceholder(raw)) {
        recommendedMissing.push(`${v.name} (${v.purpose})`);
      }
    }

    for (const cr of CONDITIONAL_REQUIREMENTS) {
      const flagRaw = env[cr.enabledByEnv]?.trim().toLowerCase();
      if (flagRaw !== cr.enabledValue) continue;
      for (const v of cr.requires) {
        const raw = env[v.name];
        if (!raw || raw.trim() === "" || looksLikePlaceholder(raw)) {
          conditionalMissing.push(
            `${v.name} (${v.purpose}) — krävs när ${cr.enabledByEnv}=${cr.enabledValue}`
          );
        }
      }
    }
  }

  // In dev, REQUIRED is "soft": we log warnings but `ok` stays true so
  // `pnpm dev` doesn't break for first-time contributors who haven't
  // copied `.env.example` yet.
  const ok = isProd
    ? missing.length === 0 &&
      placeholders.length === 0 &&
      conditionalMissing.length === 0
    : true;
  return { ok, missing, placeholders, recommendedMissing, conditionalMissing };
}

/**
 * Boot-time entry point. Call once from `index.ts` before `serve()`.
 * Logs are line-oriented so Railway/Cloud Run console viewers don't wrap.
 */
export function validateEnvOrExit(): void {
  const isProd = process.env.NODE_ENV === "production";
  const report = checkEnv(process.env, isProd);

  if (report.recommendedMissing.length > 0) {
    log.warn(
      { recommendedMissing: report.recommendedMissing },
      `${report.recommendedMissing.length} recommended env-vars missing — related features are disabled`
    );
  }

  if (report.missing.length > 0) {
    if (isProd) {
      log.error(
        { missing: report.missing },
        "Required env-vars missing — refusing to start"
      );
      process.exit(1);
    } else {
      log.warn(
        { missing: report.missing },
        "Required env-vars missing (would refuse to start in production)"
      );
    }
  }

  if (report.placeholders.length > 0) {
    if (isProd) {
      log.error(
        { placeholders: report.placeholders },
        "Required env-vars contain dev placeholders — refusing to start"
      );
      process.exit(1);
    } else {
      log.warn(
        { placeholders: report.placeholders },
        "Env-vars contain dev placeholders (rotate before going live)"
      );
    }
  }

  // MASTERPLAN_01 KC8.1: conditional misconfig (t.ex. FORTNOX_ENABLED=true
  // utan token) ska fail-fast i prod, inte degradera tyst.
  if (report.conditionalMissing.length > 0) {
    if (isProd) {
      log.error(
        { conditionalMissing: report.conditionalMissing },
        "Activated integration is misconfigured — refusing to start"
      );
      process.exit(1);
    } else {
      log.warn(
        { conditionalMissing: report.conditionalMissing },
        "Activated integration is misconfigured (would refuse to start in production)"
      );
    }
  }

  if (report.ok && isProd) {
    log.info("env validation passed — all required production vars set");
  }
}
