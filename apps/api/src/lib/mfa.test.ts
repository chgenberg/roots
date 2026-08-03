import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateMfaSecret,
  verifyMfaToken,
  mfaRequiredForRole,
  mfaRequiredRoles,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  countBackupCodes,
  issueMfaChallenge,
  verifyMfaChallenge,
} from "./mfa";

/** Giltig kod för en hemlighet, som en autentiseringsapp hade räknat ut. */
function currentCode(secret: string): string {
  return new OTPAuth.TOTP({
    issuer: "Roots",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.MFA_CHALLENGE_SECRET = "test-mfa-secret-that-is-long-enough";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("mfaRequiredForRole", () => {
  it("kräver tvåfaktor av de roller som ser över organisationsgränser", () => {
    delete process.env.MFA_REQUIRED_ROLES;
    expect(mfaRequiredForRole("INTERNAL_ADMIN")).toBe(true);
    expect(mfaRequiredForRole("SALES_ADMIN")).toBe(true);
  });

  it("kräver det inte av säljare, lagledare eller föreningsadmin", () => {
    delete process.env.MFA_REQUIRED_ROLES;
    // En 15-åring som säljer tvål till sin mormor ska inte behöva en
    // autentiseringsapp — det är fel avvägning, inte glömt.
    expect(mfaRequiredForRole("SELLER")).toBe(false);
    expect(mfaRequiredForRole("TEAM_LEADER")).toBe(false);
    expect(mfaRequiredForRole("ASSOCIATION_ADMIN")).toBe(false);
    expect(mfaRequiredForRole(null)).toBe(false);
  });

  it("går att konfigurera, och tom sträng stänger av kravet", () => {
    process.env.MFA_REQUIRED_ROLES = "ASSOCIATION_ADMIN";
    expect(mfaRequiredForRole("ASSOCIATION_ADMIN")).toBe(true);
    expect(mfaRequiredForRole("INTERNAL_ADMIN")).toBe(false);

    process.env.MFA_REQUIRED_ROLES = "";
    expect(mfaRequiredRoles()).toEqual([]);
    expect(mfaRequiredForRole("INTERNAL_ADMIN")).toBe(false);
  });
});

describe("verifyMfaToken", () => {
  it("godkänner en kod från appen", () => {
    const { secret } = generateMfaSecret("admin@roots.se");
    expect(verifyMfaToken(secret, currentCode(secret))).toBe(true);
  });

  it("tolererar mellanslag i koden", () => {
    const { secret } = generateMfaSecret("admin@roots.se");
    const code = currentCode(secret);
    // Koder läses av från en skärm och skrivs ofta "123 456". Användaren ska
    // inte behöva förstå varför det skulle spela roll.
    expect(verifyMfaToken(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe(
      true
    );
  });

  it("nekar fel kod, tom kod och fel format", () => {
    const { secret } = generateMfaSecret("admin@roots.se");
    const wrong = currentCode(secret) === "000000" ? "111111" : "000000";
    expect(verifyMfaToken(secret, wrong)).toBe(false);
    expect(verifyMfaToken(secret, "")).toBe(false);
    expect(verifyMfaToken(secret, "12345")).toBe(false);
    expect(verifyMfaToken(secret, "abcdef")).toBe(false);
  });

  it("blir ett nekat inlogg, inte en krasch, vid trasig hemlighet", () => {
    // En korrupt rad i databasen ska ge 401, inte 500.
    expect(verifyMfaToken("inte-base32!!", "123456")).toBe(false);
  });
});

describe("reservkoder", () => {
  it("genererar läsbara koder utan förväxlingsbara tecken", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      // 0/O och 1/I/L går inte att skilja på ett papper.
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("lagras hashade, aldrig i klartext", () => {
    const codes = generateBackupCodes();
    const stored = hashBackupCodes(codes);
    // En databasdump ska inte innehålla ett andra lösenord.
    for (const code of codes) {
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(code.replace("-", ""));
    }
    expect(countBackupCodes(stored)).toBe(8);
  });

  it("förbrukar en kod så den inte fungerar igen", () => {
    const codes = generateBackupCodes();
    let stored: string | null = hashBackupCodes(codes);

    const first = consumeBackupCode(stored, codes[0]);
    expect(first.ok).toBe(true);
    stored = first.remaining;
    expect(countBackupCodes(stored)).toBe(7);

    // Samma kod en andra gång: en avlyssnad kod får inte kunna spelas upp.
    expect(consumeBackupCode(stored, codes[0]).ok).toBe(false);
    // Men de övriga fungerar fortfarande.
    expect(consumeBackupCode(stored, codes[1]).ok).toBe(true);
  });

  it("bryr sig inte om bindestreck eller versaler", () => {
    const codes = generateBackupCodes();
    const stored = hashBackupCodes(codes);
    expect(consumeBackupCode(stored, codes[0].toLowerCase()).ok).toBe(true);
    expect(consumeBackupCode(stored, codes[0].replace("-", "")).ok).toBe(true);
    expect(consumeBackupCode(stored, codes[0].replace("-", " ")).ok).toBe(true);
  });

  it("nekar när det inte finns några koder", () => {
    expect(consumeBackupCode(null, "ABCD-2345").ok).toBe(false);
    expect(consumeBackupCode("inte-json", "ABCD-2345").ok).toBe(false);
    expect(countBackupCodes(null)).toBe(0);
  });
});

describe("inloggningsutmaning", () => {
  const userId = "11111111-2222-3333-4444-555555555555";

  it("bär användaren mellan lösenordet och koden", () => {
    expect(verifyMfaChallenge(issueMfaChallenge(userId))).toBe(userId);
  });

  it("går inte att pilla i", () => {
    const token = issueMfaChallenge(userId);
    const other = "99999999-2222-3333-4444-555555555555";
    // Byta ut användar-ID:t vore en väg att logga in som någon annan efter
    // att ha klarat sitt eget lösenordssteg.
    const tampered = token.replace(userId, other);
    expect(verifyMfaChallenge(tampered)).toBeNull();
  });

  it("går ut", () => {
    const expired = issueMfaChallenge(userId, -1);
    expect(verifyMfaChallenge(expired)).toBeNull();
  });

  it("nekar skräp", () => {
    expect(verifyMfaChallenge(undefined)).toBeNull();
    expect(verifyMfaChallenge("")).toBeNull();
    expect(verifyMfaChallenge("a.b.c")).toBeNull();
    expect(verifyMfaChallenge(`${userId}.9999999999`)).toBeNull();
  });

  it("går inte att verifiera med en annan hemlighet", () => {
    const token = issueMfaChallenge(userId);
    process.env.MFA_CHALLENGE_SECRET = "en-helt-annan-hemlighet-som-ar-lang";
    expect(verifyMfaChallenge(token)).toBeNull();
  });
});
