import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";

/**
 * Tvåfaktor för de roller som ser andras data.
 *
 * Filen har funnits sedan tidigt men importerades aldrig från någon route —
 * secret-genereringen och verifieringen låg som död kod medan en
 * INTERNAL_ADMIN kom in på bara ett lösenord. Ett läckt adminlösenord gav
 * alltså tillgång till samtliga föreningars försäljning och kunduppgifter.
 *
 * Tre saker behövdes utöver det som redan fanns:
 *
 *   1. En regel för VILKA roller som måste ha det. Att kräva TOTP av en
 *      15-åring som säljer tvål till sin mormor är fel avvägning; att inte
 *      kräva det av den som ser alla föreningar är också fel.
 *   2. Reservkoder. Utan dem är ett tappat mobilnummer en permanent
 *      utelåsning, och då blir lösningen i praktiken att någon stänger av
 *      MFA i databasen — vilket är sämre än att inte ha det.
 *   3. En kortlivad utmaning mellan lösenordssteget och koden, så att
 *      sessionen inte skapas förrän båda faktorerna är avklarade.
 */

const ISSUER = "Roots";

/**
 * Roller som kräver TOTP. Konfigurerbar för att vi ska kunna rulla ut
 * gradvis utan att låsa ut oss själva, men defaulten är de två roller som
 * ser data över organisationsgränser.
 */
const DEFAULT_MFA_ROLES = ["INTERNAL_ADMIN", "SALES_ADMIN"];

export function mfaRequiredRoles(): string[] {
  const raw = process.env.MFA_REQUIRED_ROLES;
  if (raw === undefined) return DEFAULT_MFA_ROLES;
  // Tom sträng stänger av kravet helt. Det är ett medvetet val någon får
  // göra i env, inte något som ska kunna ske av misstag genom en typo.
  return raw
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
}

export function mfaRequiredForRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return mfaRequiredRoles().includes(role);
}

export function generateMfaSecret(email: string): {
  secret: string;
  uri: string;
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyMfaToken(secret: string, token: string): boolean {
  // Koder skrivs ofta av med mellanslag ("123 456") när de läses från en
  // app, och en användare ska inte behöva förstå varför det spelar roll.
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;

  let totp: OTPAuth.TOTP;
  try {
    totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  } catch {
    // Trasig base32 i databasen ska bli ett nekat inlogg, inte en 500.
    return false;
  }

  // window: 1 tillåter föregående och nästa 30-sekundersfönster, vilket
  // täcker klockdrift i telefonen utan att öppna ett meningsfullt fönster
  // för gissning (rate-limiten gör grovjobbet där).
  const delta = totp.validate({ token: cleaned, window: 1 });
  return delta !== null;
}

/* ── Reservkoder ──────────────────────────────────────────────────────── */

export const BACKUP_CODE_COUNT = 8;

/**
 * Läsbara koder i grupper om fyra. Vi undviker tecken som förväxlas när de
 * skrivs av från en skärm eller ett papper (0/O, 1/I/L).
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let out = "";
    for (let j = 0; j < 8; j++) {
      out += CODE_ALPHABET[bytes[j] % CODE_ALPHABET.length];
    }
    codes.push(`${out.slice(0, 4)}-${out.slice(4)}`);
  }
  return codes;
}

function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Koderna lagras hashade. De är visserligen kortlivade i praktiken, men de
 * ÄR ett andra lösenord — en databasdump ska inte innehålla dem i klartext.
 * HMAC med serverhemligheten räcker och är billigare än argon2 för åtta
 * koder som verifieras i en loop.
 */
function hashBackupCode(code: string): string {
  return createHmac("sha256", getChallengeSecret())
    .update(`backup:${normalizeBackupCode(code)}`)
    .digest("hex");
}

export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes.map(hashBackupCode));
}

/**
 * Verifierar en reservkod och returnerar den återstående listan, så att
 * anroparen kan skriva tillbaka den. En kod som använts får inte fungera
 * igen; det är hela skillnaden mot ett andra lösenord.
 */
export function consumeBackupCode(
  stored: string | null | undefined,
  code: string
): { ok: boolean; remaining: string | null } {
  if (!stored) return { ok: false, remaining: null };
  let hashes: string[];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return { ok: false, remaining: null };
    hashes = parsed.filter((h): h is string => typeof h === "string");
  } catch {
    return { ok: false, remaining: null };
  }

  const candidate = hashBackupCode(code);
  const index = hashes.findIndex((h) => {
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(candidate, "hex");
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
  if (index === -1) return { ok: false, remaining: null };

  const remaining = hashes.filter((_, i) => i !== index);
  return { ok: true, remaining: JSON.stringify(remaining) };
}

export function countBackupCodes(stored: string | null | undefined): number {
  if (!stored) return 0;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/* ── Inloggningsutmaning ──────────────────────────────────────────────── */

/**
 * Mellan lösenordet och koden finns ett läge där användaren är delvis
 * autentiserad. Det får inte vara en session — då hade första faktorn
 * räckt. Istället en kortlivad signerad utmaning, samma mönster som
 * password-reset-tokens: ingen tabell, och signaturen binder tillståndet.
 */
export const MFA_CHALLENGE_TTL_S = 5 * 60;

class MfaConfigError extends Error {}

function getChallengeSecret(): string {
  const secret =
    process.env.MFA_CHALLENGE_SECRET ||
    process.env.PASSWORD_RESET_TOKEN_SECRET ||
    process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new MfaConfigError(
      "MFA challenge secret missing in production (set MFA_CHALLENGE_SECRET or SESSION_SECRET, min 16 chars)."
    );
  }
  return "roots-mfa-challenge-dev-secret-do-not-use-in-prod";
}

function sign(payload: string): string {
  return createHmac("sha256", getChallengeSecret()).update(payload).digest("hex");
}

export function issueMfaChallenge(
  userId: string,
  ttlSec: number = MFA_CHALLENGE_TTL_S
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  return `${userId}.${expiresAt}.${sign(`mfa.${userId}.${expiresAt}`)}`;
}

export function verifyMfaChallenge(token: unknown): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, signature] = parts;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (Date.now() / 1000 > expiresAt) return null;

  let expected: string;
  try {
    expected = sign(`mfa.${userId}.${expiresAt}`);
  } catch {
    return null;
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return null;
  try {
    return timingSafeEqual(a, b) ? userId : null;
  } catch {
    return null;
  }
}
