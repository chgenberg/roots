import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signerade tokens för "glömt lösenord"-länkar.
 *
 * Samma HMAC-mönster som deletion-tokens, med en skillnad: signaturen
 * binder även användarens nuvarande passwordHash. Det gör token:en
 * engångs utan att vi behöver en tabell — så snart lösenordet bytts
 * (eller någon annan token lösts in) matchar signaturen inte längre.
 *
 * TTL är kort (60 min). En läckt länk i en vidarebefordrad mailkedja ska
 * inte vara ett permanent bakdörrslösenord.
 */

export const PASSWORD_RESET_TTL_S = 60 * 60;

class PasswordResetTokenConfigError extends Error {}

function getSecret(): string {
  const secret =
    process.env.PASSWORD_RESET_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new PasswordResetTokenConfigError(
      "Password reset token secret missing in production (set PASSWORD_RESET_TOKEN_SECRET or SESSION_SECRET, min 16 chars)."
    );
  }
  return "roots-password-reset-dev-secret-do-not-use-in-prod";
}

/** Kort fingeravtryck av hashen — aldrig hela hashen i en signerad payload. */
function fingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issuePasswordResetToken(
  userId: string,
  passwordHash: string,
  ttlSec: number = PASSWORD_RESET_TTL_S
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = sign(`${userId}.${expiresAt}.${fingerprint(passwordHash)}`);
  return `${userId}.${expiresAt}.${sig}`;
}

export interface ParsedPasswordResetToken {
  userId: string;
  expiresAt: number;
  signature: string;
}

/** Steg 1: parsa och kontrollera format + utgång utan DB-access. */
export function parsePasswordResetToken(
  token: unknown
): ParsedPasswordResetToken | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, signature] = parts;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (Date.now() / 1000 > expiresAt) return null;
  return { userId, expiresAt, signature };
}

/** Steg 2: verifiera signaturen mot användarens nuvarande passwordHash. */
export function verifyPasswordResetSignature(
  parsed: ParsedPasswordResetToken,
  passwordHash: string
): boolean {
  let expected: string;
  try {
    expected = sign(
      `${parsed.userId}.${parsed.expiresAt}.${fingerprint(passwordHash)}`
    );
  } catch {
    return false;
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.signature, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
