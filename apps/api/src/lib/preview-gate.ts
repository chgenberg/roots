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

const DEFAULT_PASSWORD = "Roots123%";

export function getPreviewPassword(): string {
  return process.env.SITE_PREVIEW_PASSWORD?.trim() || DEFAULT_PASSWORD;
}

export function getPreviewToken(password: string = getPreviewPassword()): string {
  return createHash("sha256")
    .update(`roots-preview-v1:${password}`)
    .digest("hex")
    .slice(0, 40);
}

export const PREVIEW_COOKIE_NAME = "roots_preview";

// 30-day rolling unlock. Long enough for an investor to bookmark the
// site and return without re-typing the password, short enough that
// rotating the password invalidates stale cookies within a month.
export const PREVIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
