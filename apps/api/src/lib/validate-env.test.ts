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
  OPENAI_API_KEY: "sk-real-key",
  RESEND_API_KEY: "re_real_key",
  KLARNA_WEBHOOK_SECRET: "real-klarna-webhook",
  FORTNOX_WEBHOOK_SECRET: "real-fortnox-webhook",
  SENTRY_DSN: "https://abc@sentry.io/1",
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
    delete env.RESEND_API_KEY;
    delete env.SENTRY_DSN;
    const r = checkEnv(env, true);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.recommendedMissing.length).toBeGreaterThanOrEqual(3);
    expect(r.recommendedMissing.join("\n")).toMatch(/OPENAI_API_KEY/);
    expect(r.recommendedMissing.join("\n")).toMatch(/RESEND_API_KEY/);
  });

  it("treats placeholder recommended vars same as missing for the warning list", () => {
    const env = {
      ...FULL_PROD_ENV,
      OPENAI_API_KEY: "sk-proj-REPLACE-ME",
    };
    const r = checkEnv(env, true);
    expect(r.recommendedMissing.join("\n")).toMatch(/OPENAI_API_KEY/);
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
