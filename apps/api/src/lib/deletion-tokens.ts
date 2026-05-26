import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * MASTERPLAN_01 KC2.7 — signed tokens för "ångra radering"-länkar.
 *
 * Designval:
 *   - HMAC istället för JWT: vi behöver inte ett full claims-format,
 *     bara `(userId|expiresAt)`-signering. HMAC är 0-dep och passar.
 *   - Token-format: `${userId}.${expiresEpochSec}.${hexSig}`. Tre
 *     segment så det parsar säkert via String.split("."), inga
 *     URL-encoding-issues.
 *   - 14 dagars TTL: matchar scheduledDeletionAt-fönstret. Användaren
 *     kan klicka på länken i bekräftelse-mailen ända till dagen den
 *     raderas. (Worker:n nollar fälten på purge så token blir no-op
 *     mot redan-raderad användare.)
 *   - Secret: `DELETION_TOKEN_SECRET`-env eller `SESSION_SECRET`-
 *     fallback. I dev där SESSION_SECRET inte är satt: warna och
 *     använd en deterministisk dev-default så loopen funkar lokalt.
 *
 * Säkerhetsnot: token:en räcker för att ångra raderingen MEN ger
 * inte session-access. Användaren behöver fortfarande logga in för
 * att t.ex. ändra email. Worst-case om token läcks: någon ångrar en
 * radering som användaren vill ha kvar — vi loggar audit och skickar
 * mail vid ångring så användaren ser det och kan begära ny radering.
 */

const ONE_DAY_S = 60 * 60 * 24;
export const DELETION_TOKEN_TTL_S = 14 * ONE_DAY_S;

function getSecret(): string {
  return (
    process.env.DELETION_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    // Dev-default: stabil så samma server-restart inte ogiltigförklarar
    // tokens från senaste mail:et. Får ALDRIG användas i prod —
    // validate-env hindrar boot om secrets saknas där.
    "roots-deletion-dev-secret-do-not-use-in-prod"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issueDeletionCancelToken(
  userId: string,
  ttlSec: number = DELETION_TOKEN_TTL_S
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${expiresAt}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export interface VerifiedDeletionToken {
  userId: string;
  expiresAt: number;
}

export function verifyDeletionCancelToken(
  token: string
): VerifiedDeletionToken | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, providedSig] = parts;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (Date.now() / 1000 > expiresAt) return null;

  const expectedSig = sign(`${userId}.${expiresStr}`);
  // timing-safe compare för att inte läcka byte-by-byte timing.
  if (expectedSig.length !== providedSig.length) return null;
  const a = Buffer.from(expectedSig, "hex");
  const b = Buffer.from(providedSig, "hex");
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { userId, expiresAt };
}
