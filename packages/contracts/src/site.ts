/**
 * En origin för Stripe-redirects, mejllänkar och SEO när env saknas.
 * roots.se är inte fallback.
 */
export const CANONICAL_SITE_ORIGIN = "https://roots.nu";
export const DEV_SITE_ORIGIN = "http://localhost:3004";

/** Samma cookie och hash-prefix på webben och API:t. Lösenordet sätts i env. */
export const PREVIEW_COOKIE_NAME = "roots_preview";
export const PREVIEW_TOKEN_PREFIX = "roots-preview-v1:";
export const PREVIEW_TOKEN_HEX_LENGTH = 40;

type EnvLike = Record<string, string | undefined>;

function readEnv(): EnvLike {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as EnvLike;
}

export function resolveCanonicalSiteUrl(env: EnvLike = readEnv()): string {
  const raw = (env.NEXT_PUBLIC_SITE_URL || env.SITE_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  if (env.NODE_ENV === "production") return CANONICAL_SITE_ORIGIN;
  return DEV_SITE_ORIGIN;
}
