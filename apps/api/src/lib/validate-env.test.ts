import { describe, expect, it } from "vitest";
import { checkEnv } from "./validate-env";

/**
 * Tests target the pure `checkEnv` helper so we never have to mock
 * `process.exit` or `process.env`. The boot wrapper `validateEnvOrExit`
 * is a thin layer on top — covered by the integration smoke (boot
 * succeeds with a full env, fails on missing) rather than unit tests.
 */

const FULL_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://prod/roots",
  REDIS_URL: "rediss://prod:6380",
  CSRF_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
  CORS_ORIGIN: "https://roots.se",
  NEXT_PUBLIC_SITE_URL: "https://roots.se",
  // P1.8 (audit 2026-05-26): SESSION_SECRET är nu REQUIRED i prod
  // eftersom deletion-tokens.ts + order-view-tokens.ts faller tillbaka
  // till det när de mer specifika *_SECRET-varianterna saknas.
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  // P3.52 (audit 2026-05-26): INTERNAL_CRON_TOKEN är RECOMMENDED, inte
  // required. Sätter den ändå i baseline så att recommendedMissing-
  // testen får ett rent utfall.
  INTERNAL_CRON_TOKEN: "0123456789abcdef0123456789abcdef0123456789abcdef",
  OPENAI_API_KEY: "sk-real-key",
  RESEND_API_KEY: "re_real_key",
  // MASTERPLAN_01 KC8.1: dessa adderades till RECOMMENDED_IN_PROD och
  // måste därför finnas i full-env-baselinen för att testet ska räknas
  // som "alla recommended satta".
  KLARNA_USERNAME: "real-klarna-user",
  KLARNA_PASSWORD: "real-klarna-pass",
  KLARNA_WEBHOOK_SECRET: "real-klarna-webhook",
  FORTNOX_WEBHOOK_SECRET: "real-fortnox-webhook",
  // Audit 2.43: validator + runtime läser nu samma namn.
  FORTNOX_ACCESS_TOKEN: "real-fortnox-token",
  SENTRY_DSN: "https://abc@sentry.io/1",
  // P1.7: gaten är avstängd i baseline-testen så vi inte kräver
  // SITE_PREVIEW_PASSWORD i varje case.
  PREVIEW_GATE_DISABLED: "true",
};

describe("checkEnv (production)", () => {
  it("passes when every required + recommended var is set with a real value", () => {
    const r = checkEnv(FULL_PROD_ENV, true);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.placeholders).toEqual([]);
    expect(r.recommendedMissing).toEqual([]);
  });

  it("reports missing required vars and refuses to pass", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.DATABASE_URL;
    delete env.CSRF_SECRET;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.missing.join("\n")).toMatch(/DATABASE_URL/);
    expect(r.missing.join("\n")).toMatch(/CSRF_SECRET/);
  });

  it("rejects required vars that still hold a placeholder value", () => {
    const env = {
      ...FULL_PROD_ENV,
      CSRF_SECRET: "change-me-to-another-random-string",
    };
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.placeholders.join("\n")).toMatch(/CSRF_SECRET/);
  });

  it("rejects the dev-csrf-secret fallback specifically", () => {
    const env = { ...FULL_PROD_ENV, CSRF_SECRET: "dev-csrf-secret" };
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.placeholders.join("\n")).toMatch(/CSRF_SECRET/);
  });

  it("treats missing recommended vars as warnings (does not flip ok=false)", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.OPENAI_API_KEY;
    delete env.SENTRY_DSN;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.recommendedMissing.length).toBeGreaterThanOrEqual(2);
    expect(r.recommendedMissing.join("\n")).toMatch(/OPENAI_API_KEY/);
  });

  // Post-deploy fix 2026-05-26: RESEND_API_KEY är CONDITIONAL — required
  // när FEATURE_EMAIL_DISABLED inte är satt till "true". Tidigare var det
  // hårt REQUIRED vilket gjorde att staging-deploys utan mail-konfig
  // hamnade i boot-loop.
  it("rejects boot when RESEND_API_KEY is missing and email is not explicitly disabled", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.RESEND_API_KEY;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.conditionalMissing.join("\n")).toMatch(/RESEND_API_KEY/);
  });

  it("allows boot without RESEND_API_KEY when FEATURE_EMAIL_DISABLED=true", () => {
    const env: NodeJS.ProcessEnv = {
      ...FULL_PROD_ENV,
      FEATURE_EMAIL_DISABLED: "true",
    };
    delete env.RESEND_API_KEY;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.conditionalMissing.join("\n")).not.toMatch(/RESEND_API_KEY/);
  });

  // Post-deploy fix 2026-05-26: KLARNA_WEBHOOK_SECRET är CONDITIONAL —
  // required ENDAST när Klarna är aktivt (KLARNA_USERNAME satt).
  // Utan Klarna har vi inget att HMAC-verifiera.
  it("rejects boot when Klarna is active but KLARNA_WEBHOOK_SECRET is missing", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.KLARNA_WEBHOOK_SECRET;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.conditionalMissing.join("\n")).toMatch(/KLARNA_WEBHOOK_SECRET/);
  });

  it("allows boot without KLARNA_WEBHOOK_SECRET when Klarna is not configured (no KLARNA_USERNAME)", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.KLARNA_USERNAME;
    delete env.KLARNA_PASSWORD;
    delete env.KLARNA_WEBHOOK_SECRET;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.conditionalMissing.join("\n")).not.toMatch(/KLARNA_WEBHOOK_SECRET/);
  });

  it("treats placeholder recommended vars same as missing for the warning list", () => {
    const env = {
      ...FULL_PROD_ENV,
      OPENAI_API_KEY: "sk-proj-REPLACE-ME",
    };
    const r = checkEnv(env, true);
    expect(r.recommendedMissing.join("\n")).toMatch(/OPENAI_API_KEY/);
  });

  // P1.7 (audit 2026-05-26)
  it("requires SITE_PREVIEW_PASSWORD when the preview gate is not disabled", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.PREVIEW_GATE_DISABLED;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.conditionalMissing.join("\n")).toMatch(/SITE_PREVIEW_PASSWORD/);
  });

  it("does not require SITE_PREVIEW_PASSWORD when the gate is explicitly disabled", () => {
    const env: NodeJS.ProcessEnv = {
      ...FULL_PROD_ENV,
      PREVIEW_GATE_DISABLED: "true",
    };
    delete env.SITE_PREVIEW_PASSWORD;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.conditionalMissing.join("\n")).not.toMatch(/SITE_PREVIEW_PASSWORD/);
  });

  // P1.8 (audit 2026-05-26)
  it("rejects boot when SESSION_SECRET is missing (deletion + order-view tokens)", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.SESSION_SECRET;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(false);
    expect(r.missing.join("\n")).toMatch(/SESSION_SECRET/);
  });

  // P3.52 pre-push fix (audit 2026-05-26): INTERNAL_CRON_TOKEN är
  // RECOMMENDED (inte required) så att Railway inte hamnar i boot-loop
  // om token saknas. Cron-endpoints svarar 503 vid request istället.
  it("treats missing INTERNAL_CRON_TOKEN as a warning, not a boot failure", () => {
    const env = { ...FULL_PROD_ENV };
    delete env.INTERNAL_CRON_TOKEN;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.recommendedMissing.join("\n")).toMatch(/INTERNAL_CRON_TOKEN/);
  });

  // Audit 2.43
  it("flags Fortnox conditional misconfig under the correct env-var name", () => {
    const env: NodeJS.ProcessEnv = {
      ...FULL_PROD_ENV,
      FORTNOX_ENABLED: "true",
      FORTNOX_CLIENT_SECRET: "secret",
    };
    delete env.FORTNOX_ACCESS_TOKEN;
    const r = checkEnv(env, true);
    expect(r.conditionalMissing.join("\n")).toMatch(/FORTNOX_ACCESS_TOKEN/);
  });
});

describe("checkEnv (non-production)", () => {
  it("never returns ok=false even when required vars are missing", () => {
    const r = checkEnv({ NODE_ENV: "development" }, false);
    expect(r.ok).toBe(true);
    expect(r.missing.length).toBeGreaterThan(0);
    // Recommended-missing is not populated outside prod (dev should be
    // quiet about optional integrations).
    expect(r.recommendedMissing).toEqual([]);
  });

  it("ignores placeholder values in dev (so .env.example just works)", () => {
    const env = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost/roots",
      REDIS_URL: "redis://localhost:6379",
      CSRF_SECRET: "change-me-to-another-random-string",
      CORS_ORIGIN: "http://localhost:3004",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3004",
    };
    const r = checkEnv(env, false);
    expect(r.ok).toBe(true);
    expect(r.placeholders).toEqual([]);
  });
});
