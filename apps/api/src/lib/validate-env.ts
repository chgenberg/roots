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
  // P1.8 (audit 2026-05-26): SESSION_SECRET används idag som
  // fallback-HMAC i deletion-tokens.ts och order-view-tokens.ts. Om
  // varken DELETION_TOKEN_SECRET eller ORDER_VIEW_TOKEN_SECRET finns
  // ramlar koden tillbaka hit. Måste finnas i prod så vi inte minter
  // signaturer mot en hårdkodad dev-default.
  {
    name: "SESSION_SECRET",
    purpose: "HMAC base for deletion-cancel + order-view tokens (fallback when dedicated secrets saknas)",
  },
  // Scout fix 2026-05-26 (Integration CRIT-email): tidigare var
  // RESEND_API_KEY bara RECOMMENDED, vilket lät MockEmailSender köra i
  // prod med success:true men inga riktiga mail. Order-bekräftelser,
  // payout-mail, invites etc. försvann tyst. Vi gör nu nyckeln
  // obligatorisk så boot failar snabbt vid felkonfiguration. Behöver
  // staging-miljö skicka mail? sätt nyckeln; vill ni stänga av email
  // helt? lägg till FEATURE_EMAIL_DISABLED=true (vi har redan flag).
  {
    name: "RESEND_API_KEY",
    purpose: "Transactional email — utan denna failar order-bekräftelser, invites, payout-mail tyst",
  },
  // Scout fix 2026-05-26 (Integration HIGH-klarna-spoof): tidigare
  // accepterades prod-konfig med ENBART KLARNA_WEBHOOK_IPS. Om reverse
  // proxyn inte sanerar x-forwarded-for kan angripare spoofa Klarna-IP
  // och mark:a ordrar PAID. HMAC är vår defense-in-depth — kräv den i
  // prod, behåll IP som extra lager.
  {
    name: "KLARNA_WEBHOOK_SECRET",
    purpose: "HMAC-verifiering av Klarna webhooks (IP allowlist räcker inte ensam)",
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
    // Audit 2.43 (2026-05-26): runtime-koden i invoicing/index.ts
    // läser FORTNOX_ACCESS_TOKEN. Tidigare warnade vi på fel namn
    // (FORTNOX_TOKEN) vilket gjorde att Fortnox-onboarding glided
    // igenom validate-env men sedan föll tillbaka till NullProvider.
    name: "FORTNOX_ACCESS_TOKEN",
    purpose: "Bearer-token för Fortnox API. Om FORTNOX_ENABLED=true men token saknas degraderas vi tyst till NullProvider",
  },
  {
    name: "SENTRY_DSN",
    purpose: "Error tracking + alerting (no DSN → uncaught errors only land in stdout)",
  },
  // P3.52 (audit 2026-05-26): INTERNAL_CRON_TOKEN är RECOMMENDED, inte
  // REQUIRED. Anledning: vi vill INTE blockera API-boot på Railway om
  // ops råkar saknas variabel — då blir det boot-loop och hela sajten
  // går ner. Istället låter vi internal-cron.ts svara 503 vid
  // anropet (se internal-cron.ts authorize()), så att synthetic-checken
  // larmar utan att äta hela trafiken. Lägg till variabeln i Railway
  // INNAN ni schemalägger cron-jobben.
  {
    name: "INTERNAL_CRON_TOKEN",
    purpose: "Bearer-token för /v1/internal/cron/* — utan denna failar cron-jobben med 503 men API:t bootar fortfarande",
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
      // Audit 2.43: matchar invoicing/index.ts som läser
      // FORTNOX_ACCESS_TOKEN. Felaktig FORTNOX_TOKEN-validering
      // tidigare lät Fortnox bli silent NullProvider.
      { name: "FORTNOX_ACCESS_TOKEN", purpose: "Fortnox bearer-token" },
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

    // P1.7 (audit 2026-05-26): preview-gate-lösenord måste finnas i
    // prod om inte gaten explicit är avstängd via
    // PREVIEW_GATE_DISABLED=true. Annars defaultade vi tidigare till
    // ett hårdkodat lösenord vilket både gate:ade publika sajten
    // bakom ett gissningsbart secret och blockerade crawlers.
    const gateDisabled = env.PREVIEW_GATE_DISABLED?.trim().toLowerCase() === "true";
    if (!gateDisabled) {
      const pw = env.SITE_PREVIEW_PASSWORD;
      if (!pw || pw.trim() === "" || looksLikePlaceholder(pw)) {
        conditionalMissing.push(
          "SITE_PREVIEW_PASSWORD (Lösenord till pre-launch-gaten) — krävs när PREVIEW_GATE_DISABLED inte är 'true'"
        );
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
