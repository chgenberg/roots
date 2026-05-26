/**
 * Helpers for the pre-launch password gate.
 *
 * Why the gate exists at all: the site is still in pre-launch and we
 * don't want random visitors crawling it before we're ready to talk
 * publicly. A simple shared-secret password lets us hand the URL to
 * investors / partners without exposing it to the open web.
 *
 * The cookie value is a hash of the password rather than the password
 * itself so:
 *   1. The cleartext password never travels over the wire after the
 *      initial /unlock POST (HTTPS-only in prod).
 *   2. Even if someone reads the cookie they only see a hash; they
 *      can't reuse it on another deployment with a different password.
 *   3. Both the API (which sets the cookie) and the Next.js middleware
 *      (which validates it) can compute the same token deterministically
 *      from the shared env var.
 */

import { createHash } from "node:crypto";

/**
 * P1.7 (audit 2026-05-26): gaten får inte längre använda ett
 * hårdkodat fallback-lösenord. Tidigare versionen defaultade till
 * `Roots123%` vilket innebar att en prod-deploy där
 * SITE_PREVIEW_PASSWORD råkat ut för att inte sättas gate:ade hela
 * publika sajten bakom ett gissningsbart shared secret — och
 * blockerade SEO/crawlers helt.
 *
 * Nya regler:
 *   - Saknas SITE_PREVIEW_PASSWORD och PREVIEW_GATE_DISABLED !== "true"
 *     → konfiguration är ogiltig och vi vägrar utfärda en token.
 *   - Sätt PREVIEW_GATE_DISABLED=true för att stänga av gaten helt
 *     (post-launch). validate-env tillåter då att lösenordet saknas.
 */
class PreviewGateConfigError extends Error {}

export function isPreviewGateDisabled(): boolean {
  return process.env.PREVIEW_GATE_DISABLED === "true";
}

export function getPreviewPassword(): string {
  const raw = process.env.SITE_PREVIEW_PASSWORD?.trim();
  if (raw && raw.length > 0) return raw;

  throw new PreviewGateConfigError(
    "SITE_PREVIEW_PASSWORD is not set. Set it to enable the preview gate or set PREVIEW_GATE_DISABLED=true to remove the gate."
  );
}

export function getPreviewToken(password?: string): string {
  const pw = password ?? getPreviewPassword();
  return createHash("sha256")
    .update(`roots-preview-v1:${pw}`)
    .digest("hex")
    .slice(0, 40);
}

export const PREVIEW_COOKIE_NAME = "roots_preview";

// 30-day rolling unlock. Long enough for an investor to bookmark the
// site and return without re-typing the password, short enough that
// rotating the password invalidates stale cookies within a month.
export const PREVIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
