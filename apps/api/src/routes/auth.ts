import { Hono } from "hono";
import type { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { hash, verify } from "@node-rs/argon2";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  users,
  organizations,
  teams,
  sellers,
  campaigns,
} from "@roots/db/schema";
import {
  createSession,
  destroySession,
  destroyUserSessions,
  getSession,
  isDemoSession,
  refreshSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_REFRESH_THRESHOLD_MS,
} from "../lib/session";
import type { SessionData } from "../lib/session";
import { getEmailSender } from "../lib/email";
import {
  welcomeEmail,
  deletionRequestEmail,
  deletionCancelledEmail,
  passwordResetEmail,
  guardianConsentNoticeEmail,
  withLocalePath,
} from "../lib/email/templates";
import {
  issueDeletionCancelToken,
  verifyDeletionCancelToken,
} from "../lib/deletion-tokens";
import {
  issuePasswordResetToken,
  parsePasswordResetToken,
  verifyPasswordResetSignature,
  PASSWORD_RESET_TTL_S,
} from "../lib/password-reset-tokens";
import {
  loginRateLimit,
  registrationRateLimit,
  deletionCancelRateLimit,
  deleteAccountRateLimit,
  changePasswordRateLimit,
  passwordResetRequestRateLimit,
  passwordResetConfirmRateLimit,
  mfaAttemptRateLimit,
} from "../lib/rate-limit";
import {
  generateMfaSecret,
  verifyMfaToken,
  mfaRequiredForRole,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  countBackupCodes,
  issueMfaChallenge,
  verifyMfaChallenge,
  BACKUP_CODE_COUNT,
} from "../lib/mfa";
import {
  GUARDIAN_CONSENT_AGE,
  GUARDIAN_CONSENT_VERSION,
} from "@roots/contracts";
import {
  resolveUiLocale,
  uiError,
  type UiLocale,
} from "../lib/ui-locale";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { scheduleOrgNormalize } from "../lib/jobs/schedule-org-normalize";
import { shopSlug as makeShopSlug } from "../lib/slug";

const log = childLogger("auth");

export const auth = new Hono();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Off by default in production; set ROOTS_ENABLE_DEMO_ACCOUNTS=true for staging demos.
 *
 * I produktion krävs dessutom ROOTS_DEMO_PASSWORD (≥12 tecken). Lösenorden
 * nedan står i klartext i ett publikt repo — kan de aktiveras i produktion
 * med bara en flagga så är INTERNAL_ADMIN ett felklick bort.
 */
const DEMO_PASSWORD_OVERRIDE = process.env.ROOTS_DEMO_PASSWORD?.trim() || null;
const DEMO_ACCOUNTS_ENABLED =
  !IS_PRODUCTION ||
  (process.env.ROOTS_ENABLE_DEMO_ACCOUNTS === "true" &&
    !!DEMO_PASSWORD_OVERRIDE &&
    DEMO_PASSWORD_OVERRIDE.length >= 12);

if (
  IS_PRODUCTION &&
  process.env.ROOTS_ENABLE_DEMO_ACCOUNTS === "true" &&
  !DEMO_ACCOUNTS_ENABLED
) {
  log.error(
    "ROOTS_ENABLE_DEMO_ACCOUNTS=true i produktion men ROOTS_DEMO_PASSWORD saknas eller är för kort — demo-konton förblir avstängda."
  );
}

const DEMO_PASSWORD = DEMO_PASSWORD_OVERRIDE ?? "Demo1234!";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// P3.16 (audit 2026-05-26): registration endpoints accepted arbitrarily
// weak passwords. Strategy doc + change-password lean toward ≥12 chars.
// Returns null on success, localised error message otherwise.
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
export function validatePassword(
  pw: unknown,
  locale: UiLocale = "sv"
): string | null {
  if (typeof pw !== "string") return uiError(locale, "passwordMissing");
  const trimmed = pw;
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return uiError(locale, "passwordTooShort");
  }
  if (trimmed.length > MAX_PASSWORD_LENGTH) {
    return uiError(locale, "passwordTooLong");
  }
  return null;
}

const DEMO_ACCOUNTS: Record<
  string,
  {
    password: string;
    role: string;
    name: string;
    nameEn: string;
    orgName: string;
    orgNameEn: string;
  }
> = DEMO_ACCOUNTS_ENABLED
  ? {
      "klubb@demo.se": {
        password: DEMO_PASSWORD,
        role: "CLUB_ADMIN",
        name: "Anna Klubbsson",
        nameEn: "Anna Clubson",
        orgName: "Demo Fotbollsklubb",
        orgNameEn: "Demo Football Club",
      },
      "salj@roots.se": {
        password: DEMO_PASSWORD,
        role: "SALES_REP",
        name: "Erik Säljare",
        nameEn: "Erik Seller",
        orgName: "Roots AB",
        orgNameEn: "Roots AB",
      },
      "admin@roots.se": {
        password: DEMO_PASSWORD,
        role: "INTERNAL_ADMIN",
        name: "Roots Admin",
        nameEn: "Roots Admin",
        orgName: "Roots AB",
        orgNameEn: "Roots AB",
      },
      // Sprint E1: fundraising-portal roles. The in-memory fallback
      // gives a successful login experience, but the actual
      // /forening + /lag dashboards require DB-seeded data
      // (`pnpm db:seed:demo`) — otherwise the API returns 403
      // (`Ingen organisation`) because session.orgId is null on the
      // in-memory path.
      "forening@demo-if.se": {
        password: DEMO_PASSWORD,
        role: "ASSOCIATION_ADMIN",
        name: "Karin Lindgren",
        nameEn: "Karin Lindgren",
        orgName: "Demo IF Sundsvall",
        orgNameEn: "Demo IF Sundsvall",
      },
      "lag@demo-if.se": {
        password: DEMO_PASSWORD,
        role: "TEAM_LEADER",
        name: "Mikael Berg",
        nameEn: "Mikael Berg",
        orgName: "Demo IF Sundsvall",
        orgNameEn: "Demo IF Sundsvall",
      },
    }
  : {};

function demoDisplay(demo: (typeof DEMO_ACCOUNTS)[string], locale: "sv" | "en") {
  return {
    name: locale === "en" ? demo.nameEn : demo.name,
    orgName: locale === "en" ? demo.orgNameEn : demo.orgName,
  };
}

/**
 * Slutför inloggningen när alla faktorer är avklarade.
 *
 * Bryts ut eftersom både lösenordssteget och kodsteget landar här. Låg
 * duplikationen kvar skulle de två vägarna förr eller senare glida ifrån
 * varandra — och den ena är den som har MFA.
 */
async function completeLogin(c: Context, user: typeof users.$inferSelect) {
  const sessionData: SessionData = {
    userId: user.id,
    role: user.role as SessionData["role"],
    orgId: user.orgId,
    createdAt: Date.now(),
  };

  let orgName: string | null = null;
  if (user.orgId) {
    try {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1);
      orgName = org?.name ?? null;
    } catch (err) {
      // Org lookup is best-effort — a stale schema shouldn't kill
      // an otherwise-valid login. We just present an empty orgName.
      log.warn({ err, userId: user.id }, "org lookup failed during login");
    }
  }

  // Connection-audit P0 #4: a Redis hiccup must not surface as a 500
  // on real accounts (the demo branch already returned 503; align them).
  let sessionId: string;
  try {
    sessionId = await createSession(sessionData);
  } catch (err) {
    log.error({ err, userId: user.id }, "createSession failed during DB login");
    return c.json(
      { error: uiError(resolveUiLocale(c), "sessionUnavailable") },
      503
    );
  }
  setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

  // En roll som kräver MFA men saknar den får logga in — annars låser vi ut
  // befintliga administratörer i samma sekund som kravet slås på. Istället
  // säger svaret att registreringen behövs, och guarden i mfa-required.ts
  // stänger de känsliga ytorna tills den är gjord.
  const enrollmentRequired =
    mfaRequiredForRole(user.role) && !user.mfaEnabledAt;

  void auditLog({
    userId: user.id,
    action: "auth.login.success",
    meta: {
      ...requestContext((n) => c.req.header(n)),
      role: user.role,
      mfa: user.mfaEnabledAt ? "verified" : enrollmentRequired ? "missing" : "n/a",
    },
  });

  return c.json({
    ok: true,
    mfaEnrollmentRequired: enrollmentRequired,
    user: {
      email: user.email,
      role: user.role,
      name: user.contactName || user.email,
      orgName: orgName || "",
    },
  });
}

auth.post("/login", async (c) => {
  let body: { email: string; password: string; locale?: string };
  try {
    body = await c.req.json<{ email: string; password: string; locale?: string }>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);

  if (!body.email || !body.password) {
    return c.json({ error: uiError(locale, "emailPasswordRequired") }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const password = body.password.trim();
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rl = await loginRateLimit(ip, email);
  if (!rl.allowed) {
    return c.json(
      { error: uiError(locale, "loginRateLimited") },
      429
    );
  }

  // Prefer DB users (seed/registration) so sessions use real userId + orgId.
  // A DB-side failure (schema drift, connectivity hiccup, etc.) must NOT
  // block the in-memory demo fallback below — otherwise a missing prod
  // column locks every operator out of the staging-demo flow. We log the
  // error and fall through; if neither path matches we still return 401.
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      // P2.9 (audit 2026-05-26): blockera DB-login för raderade
      // tombstone-användare explicit. passwordHash-sentinelet räcker
      // som indirekt skydd idag, men ett ändrat hash-format eller
      // partiell purge skulle annars kunna släppa förbi en
      // återautentisering mot ett anonymiserat konto.
      if (user.deletedAt) {
        void auditLog({
          userId: user.id,
          action: "auth.login.failed",
          meta: { ...requestContext((n) => c.req.header(n)), reason: "deleted_account" },
        });
        return c.json({ error: uiError(locale, "badCredentials") }, 401);
      }

      const valid = await verify(user.passwordHash, password);
      if (!valid) {
        void auditLog({
          userId: user.id,
          action: "auth.login.failed",
          meta: { ...requestContext((n) => c.req.header(n)), reason: "bad_password" },
        });
        return c.json({ error: uiError(locale, "badCredentials") }, 401);
      }

      // Andra faktorn. Sessionen får inte skapas här — då hade lösenordet
      // ensamt räckt, och hela poängen är att det inte ska göra det. Vi
      // svarar med en kortlivad utmaning istället.
      if (user.mfaEnabledAt && user.mfaSecret) {
        void auditLog({
          userId: user.id,
          action: "auth.login.mfa_challenged",
          meta: { ...requestContext((n) => c.req.header(n)), role: user.role },
        });
        return c.json({
          mfaRequired: true,
          challenge: issueMfaChallenge(user.id),
          backupCodesRemaining: countBackupCodes(user.mfaBackupCodes),
        });
      }

      return completeLogin(c, user);
    }
  } catch (err) {
    // I produktion failar vi CLOSED: ett DB-fel får inte innebära att
    // inloggningen faller igenom till in-memory-demokonton, för då kan en
    // databasincident förvandlas till "vem som helst med demolösenordet
    // loggar in som INTERNAL_ADMIN". Lokalt behåller vi fallthrough så att
    // `pnpm dev` fungerar innan migrationerna körts.
    log.error(
      { err, email: email.slice(0, 120) },
      "DB user lookup failed during login"
    );
    if (IS_PRODUCTION) {
      return c.json({ error: uiError(locale, "loginUnavailable") }, 503);
    }
    log.warn("faller tillbaka på demo-konton (icke-produktion)");
  }

  void auditLog({
    action: "auth.login.failed",
    meta: { ...requestContext((n) => c.req.header(n)), reason: "no_user", email: email.slice(0, 120) },
  });

  // Fallback: in-memory demo (local dev, or ROOTS_ENABLE_DEMO_ACCOUNTS on Railway)
  const demo = DEMO_ACCOUNTS[email];
  if (demo && demo.password === password) {
    const display = demoDisplay(demo, locale);
    const sessionData: SessionData = {
      userId: crypto.randomUUID(),
      role: demo.role as SessionData["role"],
      orgId: null,
      createdAt: Date.now(),
      demoProfile: { email, name: display.name, orgName: display.orgName },
    };

    try {
      const sessionId = await createSession(sessionData);
      setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    } catch {
      return c.json({ error: uiError(locale, "sessionUnavailable") }, 503);
    }

    return c.json({
      ok: true,
      user: {
        email,
        role: demo.role,
        name: display.name,
        orgName: display.orgName,
      },
    });
  }

  return c.json({ error: uiError(locale, "badCredentials") }, 401);
});

/**
 * Steg två i inloggningen: TOTP-koden eller en reservkod.
 *
 *   POST /v1/auth/login/mfa   { challenge, code }
 *
 * Utmaningen är signerad och lever i fem minuter. Den bär bara ett
 * användar-ID — den ger ingen behörighet i sig, så den kan inte användas
 * som en session om den läcker.
 */
auth.post("/login/mfa", async (c) => {
  let body: { challenge?: string; code?: string; locale?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);

  const userId = verifyMfaChallenge(body.challenge);
  if (!userId) {
    return c.json(
      { error: uiError(locale, "loginExpired") },
      401
    );
  }

  const code = (body.code ?? "").trim();
  if (!code) return c.json({ error: uiError(locale, "enterAppCode") }, 400);

  // Sex siffror är gissningsbart i tillräckligt många försök, så det här är
  // den enda spärren som gör andra faktorn värd något.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await mfaAttemptRateLimit(ip, userId);
  if (!rl.allowed) {
    void auditLog({
      userId,
      action: "auth.login.mfa_rate_limited",
      meta: requestContext((n) => c.req.header(n)),
    });
    return c.json(
      { error: uiError(locale, "rateLimitedShort") },
      429
    );
  }

  let user: typeof users.$inferSelect | undefined;
  try {
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  } catch (err) {
    log.error({ err, userId }, "DB lookup failed during MFA verification");
    return c.json({ error: uiError(locale, "loginUnavailable") }, 503);
  }

  if (!user || user.deletedAt || !user.mfaEnabledAt || !user.mfaSecret) {
    return c.json({ error: uiError(locale, "mfaNotEnabled") }, 400);
  }

  if (verifyMfaToken(user.mfaSecret, code)) {
    return completeLogin(c, user);
  }

  // Reservkod. Den förbrukas oavsett om inloggningen sedan lyckas, så en
  // avlyssnad kod inte kan spelas upp igen.
  const backup = consumeBackupCode(user.mfaBackupCodes, code);
  if (backup.ok) {
    try {
      await db
        .update(users)
        .set({ mfaBackupCodes: backup.remaining, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    } catch (err) {
      log.error({ err, userId }, "failed to consume MFA backup code");
      return c.json({ error: uiError(locale, "loginUnavailable") }, 503);
    }
    void auditLog({
      userId: user.id,
      action: "auth.login.mfa_backup_code_used",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        remaining: countBackupCodes(backup.remaining),
      },
    });
    return completeLogin(c, user);
  }

  void auditLog({
    userId: user.id,
    action: "auth.login.mfa_failed",
    meta: requestContext((n) => c.req.header(n)),
  });
  return c.json({ error: uiError(locale, "mfaInvalid") }, 401);
});

/**
 * Status för den inloggade användarens tvåfaktor.
 *
 *   GET /v1/auth/mfa
 */
auth.get("/mfa", async (c) => {
  const locale = resolveUiLocale(c);
  const session = await getSession(
    (c.req.header("cookie") || "").match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    )?.[1] ?? ""
  );
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) {
    return c.json({
      enabled: false,
      required: false,
      backupCodesRemaining: 0,
      demo: true,
    });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return c.json({ error: uiError(locale, "userNotFound") }, 404);

  return c.json({
    enabled: !!user.mfaEnabledAt,
    required: mfaRequiredForRole(user.role),
    enabledAt: user.mfaEnabledAt,
    backupCodesRemaining: countBackupCodes(user.mfaBackupCodes),
  });
});

/**
 * Påbörja registrering av en autentiseringsapp.
 *
 *   POST /v1/auth/mfa/setup   { password }              — första gången
 *   POST /v1/auth/mfa/setup   { password, code }        — byta till ny app
 *
 * Lösenordet krävs igen: en kapad session ska inte kunna byta ut andra
 * faktorn mot en angripares egen app. Är tvåfaktorn redan aktiv krävs
 * dessutom en kod från appen som gäller nu — se kommentaren nedan.
 */
auth.post("/mfa/setup", async (c) => {
  const currentSessionId =
    (c.req.header("cookie") || "").match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    )?.[1] ?? "";
  const session = await getSession(currentSessionId);
  if (!session) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "demoCannotChangeMfa") },
      403
    );
  }

  let body: { password?: string; code?: string; locale?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);
  if (!body.password) {
    return c.json({ error: uiError(locale, "enterYourPassword") }, 400);
  }

  const rl = await changePasswordRateLimit(session.userId);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimited") }, 429);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return c.json({ error: uiError(locale, "userNotFound") }, 404);

  if (!(await verify(user.passwordHash, body.password.trim()))) {
    void auditLog({
      userId: user.id,
      action: "auth.mfa.setup_bad_password",
      meta: requestContext((n) => c.req.header(n)),
    });
    return c.json({ error: uiError(locale, "wrongPassword") }, 401);
  }

  // Byta till en ny app på ett konto som redan har tvåfaktor kräver båda
  // faktorerna, precis som att stänga av den.
  //
  // Tidigare räckte lösenordet. En kapad session plus lösenordet kunde då byta
  // ut hemligheten mot angriparens egen app: offrets authenticator slutade
  // fungera, och angriparen kunde svara på inloggningsutmaningen. En
  // tillfällig sessionsstöld blev därmed varaktig kontroll över kontot.
  //
  // Att bara neka går inte — roller som kräver tvåfaktor får inte stänga av
  // den, så de skulle sakna varje väg till en ny telefon.
  const currentSecret = user.mfaEnabledAt ? user.mfaSecret : null;
  const isRebind = !!currentSecret;
  if (currentSecret) {
    const code = (body.code ?? "").trim();
    const validCode =
      verifyMfaToken(currentSecret, code) ||
      consumeBackupCode(user.mfaBackupCodes, code).ok;
    if (!validCode) {
      void auditLog({
        userId: user.id,
        action: "auth.mfa.rebind_bad_code",
        meta: requestContext((n) => c.req.header(n)),
      });
      return c.json(
        {
          error: code
            ? uiError(locale, "mfaCodeIncorrect")
            : uiError(locale, "mfaRebindNeedsCode"),
        },
        401
      );
    }
  }

  const { secret, uri } = generateMfaSecret(user.email);
  // Hemligheten sparas nu men aktiveras inte förrän en kod bekräftats.
  // Stänger användaren fliken mitt i är kontot orört.
  await db
    .update(users)
    .set(
      isRebind
        ? {
            // Vid byte nollställs aktiveringen: den gamla appen slutar gälla
            // direkt, och kontot står i samma läge som ett nyregistrerat
            // tills den nya appen bekräftats. Avbryter användaren mitt i kan
            // hon fortfarande logga in med lösenordet och göra om det —
            // `mfaPending` håller de känsliga ytorna stängda tills dess.
            // Reservkoderna hör till den gamla hemligheten och måste bort.
            mfaSecret: secret,
            mfaEnabledAt: null,
            mfaBackupCodes: null,
            updatedAt: new Date(),
          }
        : { mfaSecret: secret, updatedAt: new Date() }
    )
    .where(eq(users.id, user.id));

  if (isRebind) {
    // Ett byte av andra faktorn ska kicka alla andra enheter.
    let revokedCount = 0;
    try {
      revokedCount = await destroyUserSessions(user.id, currentSessionId);
    } catch (err) {
      log.warn(
        { err, userId: user.id },
        "kunde inte återkalla övriga sessioner vid byte av tvåfaktor-app"
      );
    }
    void auditLog({
      userId: user.id,
      action: "auth.mfa.rebind_started",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        revokedSessions: revokedCount,
      },
    });
  }

  return c.json({ ok: true, secret, uri, rebind: isRebind });
});

/**
 * Bekräfta och aktivera tvåfaktor.
 *
 *   POST /v1/auth/mfa/enable   { code }
 *
 * Reservkoderna visas en enda gång här. Att kunna hämta dem igen senare
 * skulle göra dem lika värdefulla för en angripare med en kapad session
 * som för användaren.
 */
auth.post("/mfa/enable", async (c) => {
  const currentSessionId =
    (c.req.header("cookie") || "").match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    )?.[1] ?? "";
  const session = await getSession(currentSessionId);
  if (!session) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "demoCannotChangeMfa") },
      403
    );
  }

  let body: { code?: string; locale?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await mfaAttemptRateLimit(ip, session.userId);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedWait") }, 429);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return c.json({ error: uiError(locale, "userNotFound") }, 404);
  if (!user.mfaSecret) {
    return c.json({ error: uiError(locale, "mfaScanQrFirst") }, 400);
  }
  if (user.mfaEnabledAt) {
    return c.json({ error: uiError(locale, "mfaAlreadyEnabled") }, 400);
  }
  if (!verifyMfaToken(user.mfaSecret, (body.code ?? "").trim())) {
    return c.json({ error: uiError(locale, "mfaInvalid") }, 401);
  }

  const codes = generateBackupCodes();
  await db
    .update(users)
    .set({
      mfaEnabledAt: new Date(),
      mfaBackupCodes: hashBackupCodes(codes),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Kicka alla andra sessioner, behåll den som just registrerade.
  //
  // Före aktiveringen kunde man logga in med bara lösenordet. Sådana
  // sessioner var begränsade av `mfaPending`, men flaggan räknas om mot
  // `mfaEnabledAt` vid varje sync — så i samma sekund som den riktiga
  // användaren blev klar öppnades de sessionerna helt, utan att någon
  // besvarat en inloggningsutmaning. Aktiveringen hade då stärkt skyddet för
  // framtida inloggningar men släppt in den som redan tagit sig in.
  //
  // Best-effort: hemligheten är redan sparad, och ett Redis-hicka här får
  // inte få aktiveringen att se ut som misslyckad.
  let revokedCount = 0;
  try {
    revokedCount = await destroyUserSessions(user.id, currentSessionId);
  } catch (err) {
    log.warn(
      { err, userId: user.id },
      "kunde inte återkalla övriga sessioner efter mfa-aktivering"
    );
  }

  void auditLog({
    userId: user.id,
    action: "auth.mfa.enabled",
    meta: {
      ...requestContext((n) => c.req.header(n)),
      role: user.role,
      revokedSessions: revokedCount,
    },
  });

  return c.json({ ok: true, backupCodes: codes, count: BACKUP_CODE_COUNT });
});

/**
 * Stäng av tvåfaktor.
 *
 *   POST /v1/auth/mfa/disable   { password, code }
 *
 * Kräver båda faktorerna. Annars vore avstängningen en väg runt kravet för
 * den som redan har lösenordet.
 */
auth.post("/mfa/disable", async (c) => {
  const session = await getSession(
    (c.req.header("cookie") || "").match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    )?.[1] ?? ""
  );
  if (!session) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }
  if (isDemoSession(session)) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "demoCannotChangeMfa") },
      403
    );
  }

  let body: { password?: string; code?: string; locale?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await mfaAttemptRateLimit(ip, session.userId);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedWait") }, 429);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return c.json({ error: uiError(locale, "userNotFound") }, 404);
  if (!user.mfaEnabledAt || !user.mfaSecret) {
    return c.json({ error: uiError(locale, "mfaNotEnabledShort") }, 400);
  }
  if (!body.password || !(await verify(user.passwordHash, body.password.trim()))) {
    return c.json({ error: uiError(locale, "wrongPassword") }, 401);
  }
  const code = (body.code ?? "").trim();
  const validCode =
    verifyMfaToken(user.mfaSecret, code) ||
    consumeBackupCode(user.mfaBackupCodes, code).ok;
  if (!validCode) {
    return c.json({ error: uiError(locale, "mfaCodeIncorrect") }, 401);
  }

  // Rollen kräver MFA: att stänga av den skulle bara flytta kontot till
  // "måste registrera igen", vilket är mer förvirrande än att neka.
  if (mfaRequiredForRole(user.role)) {
    return c.json({ error: uiError(locale, "mfaRoleRequires") }, 400);
  }

  await db
    .update(users)
    .set({
      mfaSecret: null,
      mfaEnabledAt: null,
      mfaBackupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  void auditLog({
    userId: user.id,
    action: "auth.mfa.disabled",
    meta: { ...requestContext((n) => c.req.header(n)), role: user.role },
  });

  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  if (match) {
    let userId: string | null = null;
    try {
      const session = await getSession(match[1]);
      userId = session?.userId ?? null;
    } catch {}
    try {
      await destroySession(match[1]);
    } catch {}
    void auditLog({
      userId,
      action: "auth.logout",
      meta: { ...requestContext((n) => c.req.header(n)) },
    });
  }

  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

// ── Change password (Sprint C — "Knapparna fungerar") ───────────────
//
// `POST /v1/auth/change-password` powers the "Byt lösenord"-knappen i
// /portal/installningar. Requirements:
//   - must be authenticated (DB-session, not demo-only)
//   - verify the current password against `users.passwordHash`
//   - enforce minimum complexity on the new password
//   - re-hash with the same argon2 parameters used at register/seed time
//   - invalidate other sessions? — out of scope for the MVP, noted as
//     a follow-up. The current session keeps working so the user
//     doesn't get bounced back to the login screen.
auth.post("/change-password", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }

  const currentSessionId = match[1];
  let session: SessionData | null = null;
  try {
    session = await getSession(currentSessionId);
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }
  if (!session) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }

  // Demo sessions don't have a DB row — their password lives in code,
  // so we can't rotate it. Reject explicitly so the UI can show a
  // friendly message instead of a generic 500.
  // Pre-push fix 2026-05-26: använd isDemoSession() så vi även
  // täcker DB-seedade demo-konton (P3.28), inte bara in-memory.
  if (!session.userId || isDemoSession(session)) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "demoCannotChangePassword") },
      400
    );
  }

  type Body = {
    currentPassword?: string;
    newPassword?: string;
    locale?: string;
  };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const current = (body.currentPassword ?? "").trim();
  const next = (body.newPassword ?? "").trim();

  if (!current || !next) {
    return c.json({ error: uiError(locale, "bothFieldsRequired") }, 400);
  }

  const chpwRl = await changePasswordRateLimit(session.userId);
  if (!chpwRl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }
  const pwErr = validatePassword(next, locale);
  if (pwErr) return c.json({ error: pwErr }, 400);
  if (next === current) {
    return c.json({ error: uiError(locale, "passwordSameAsOld") }, 400);
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

    // verify() throws if the stored hash isn't a valid argon2 string.
    // Invited members have a `invite-pending-…`-prefixed sentinel that
    // is not a valid hash; treat that as "no current password" and
    // refuse politely instead of 500.
    let valid: boolean;
    try {
      valid = await verify(user.passwordHash, current);
    } catch {
      return c.json({ error: uiError(locale, "passwordCannotVerify") }, 400);
    }
    if (!valid) {
      void auditLog({
        userId: user.id,
        action: "auth.change_password.failed",
        meta: { ...requestContext((n) => c.req.header(n)), reason: "bad_current" },
      });
      return c.json({ error: uiError(locale, "wrongCurrentPassword") }, 401);
    }

    const newHash = await hash(next, ARGON2_OPTIONS);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // MASTERPLAN_01 KC2.6: a password rotation must kick every other
    // device. Best-effort — a Redis hiccup here MUST NOT fail the
    // rotation since the hash has already been updated.
    let revokedCount = 0;
    try {
      revokedCount = await destroyUserSessions(user.id, currentSessionId);
    } catch (err) {
      log.warn({ err, userId: user.id }, "failed to revoke other sessions after password change");
    }

    void auditLog({
      userId: user.id,
      action: "auth.change_password.ok",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        revokedOtherSessions: revokedCount,
      },
    });

    return c.json({ ok: true, revokedOtherSessions: revokedCount });
  } catch (err) {
    log.error({ err, userId: session.userId }, "change-password failed");
    return c.json({ error: uiError(locale, "changePasswordFailed") }, 500);
  }
});

// ── Glömt lösenord ─────────────────────────────────────────────────
//
//   POST /v1/auth/forgot-password  — begär länk (svarar alltid ok)
//   POST /v1/auth/reset-password   — lös in token och sätt nytt lösenord
//
// Svaret på forgot-password är medvetet identiskt oavsett om kontot
// finns eller inte — annars blir endpointen en användarlista. Token:en
// är HMAC-signerad och bunden till nuvarande passwordHash, så den blir
// ogiltig i samma sekund lösenordet byts (engångsanvändning utan tabell).

const SITE_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://roots.se";

auth.post("/forgot-password", async (c) => {
  let body: { email?: string; locale?: string };
  try {
    body = await c.req.json<{ email?: string; locale?: string }>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const email = (body.email ?? "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return c.json({ error: uiError(locale, "enterValidEmail") }, 400);
  }

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await passwordResetRequestRateLimit(ip, email);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }

  const genericOk = { ok: true } as const;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || user.deletedAt) return c.json(genericOk);

    // Inbjudna konton har en `invite-pending-…`-sentinel istället för en
    // riktig hash. De ska gå via inbjudningslänken, inte återställning.
    if (!user.passwordHash || user.passwordHash.startsWith("invite-pending")) {
      return c.json(genericOk);
    }

    const token = issuePasswordResetToken(user.id, user.passwordHash);
    const resetUrl = `${SITE_BASE_URL}${withLocalePath("/aterstall-losenord", locale)}?token=${encodeURIComponent(token)}`;

    void auditLog({
      userId: user.id,
      action: "auth.password_reset.requested",
      meta: { ...requestContext((n) => c.req.header(n)) },
    });

    getEmailSender()
      .sendEmail({
        to: user.email,
        ...passwordResetEmail({
          name:
            user.contactName?.split(" ")[0] ||
            user.email.split("@")[0] ||
            (locale === "en" ? "there" : "där"),
          resetUrl,
          expiresInMinutes: Math.round(PASSWORD_RESET_TTL_S / 60),
          locale,
        }),
      })
      .catch((err) =>
        log.error({ err, userId: user.id }, "password reset email failed")
      );
  } catch (err) {
    // Ett DB- eller mailfel får inte avslöja något om kontot heller.
    log.error({ err }, "forgot-password failed");
  }

  return c.json(genericOk);
});

auth.post("/reset-password", async (c) => {
  let body: { token?: string; newPassword?: string; locale?: string };
  try {
    body = await c.req.json<{
      token?: string;
      newPassword?: string;
      locale?: string;
    }>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await passwordResetConfirmRateLimit(ip);
  if (!rl.allowed) {
    return c.json({ error: uiError(locale, "rateLimitedShort") }, 429);
  }

  const newPassword = (body.newPassword ?? "").trim();
  const pwErr = validatePassword(newPassword, locale);
  if (pwErr) return c.json({ error: pwErr }, 400);

  const parsed = parsePasswordResetToken(body.token);
  const invalid = {
    error: uiError(locale, "linkInvalidOrExpired"),
  } as const;
  if (!parsed) return c.json(invalid, 400);

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.userId))
      .limit(1);

    if (!user || user.deletedAt) return c.json(invalid, 400);
    if (!verifyPasswordResetSignature(parsed, user.passwordHash)) {
      void auditLog({
        userId: user.id,
        action: "auth.password_reset.failed",
        meta: {
          ...requestContext((n) => c.req.header(n)),
          reason: "bad_signature",
        },
      });
      return c.json(invalid, 400);
    }

    const newHash = await hash(newPassword, ARGON2_OPTIONS);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Den som återställer lösenordet kan ha blivit kapad. Kicka allt.
    let revokedCount = 0;
    try {
      revokedCount = await destroyUserSessions(user.id);
    } catch (err) {
      log.warn(
        { err, userId: user.id },
        "failed to revoke sessions after password reset"
      );
    }

    void auditLog({
      userId: user.id,
      action: "auth.password_reset.ok",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        revokedSessions: revokedCount,
      },
    });

    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "reset-password failed");
    return c.json({ error: uiError(locale, "resetPasswordFailed") }, 500);
  }
});

// ── KC2.7 — GDPR account-deletion ──────────────────────────────────
//
// 3-stegs flow:
//   POST /v1/auth/delete-account        — begär radering (password+confirm)
//   GET  /v1/auth/deletion-status       — current status (for portal UI)
//   POST /v1/auth/cancel-deletion       — ångra (inloggad ELLER token)
//
// Själva PII-anonymiseringen sker i en separat scheduled worker som
// poll:ar `scheduled_deletion_at <= now()` (se workers/deletion-purge.ts).
// På så sätt är request-endpoints helt stateless / non-blocking, och en
// crash i purge:n stoppar bara den användaren — inte begäran-flödet.

const DELETION_COOLDOWN_DAYS = 14;
const DELETION_COOLDOWN_MS = DELETION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

auth.post("/delete-account", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }

  const currentSessionId = match[1];
  let session: SessionData | null = null;
  try {
    session = await getSession(currentSessionId);
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }
  if (!session) {
    return c.json({ error: uiError(resolveUiLocale(c), "notLoggedIn") }, 401);
  }

  // Demo-sessions har ingen DB-rad; ingen att radera.
  // Pre-push fix 2026-05-26: täck även DB-seedade demo-konton (P3.28).
  if (!session.userId || isDemoSession(session)) {
    return c.json(
      { error: uiError(resolveUiLocale(c), "demoCannotDelete") },
      400
    );
  }

  // P3.59 (audit 2026-05-26): tidigare hade /delete-account ingen
  // throttle utöver session-auth. En stulen session kunde brute-force:a
  // användarens lösenord (svart-back-up för logout-konfirmation).
  // 5 försök per 15 min per user räcker för "fingrarna i munnen"-fel.
  const rl = await deleteAccountRateLimit(session.userId);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "rateLimitedShort") },
      429
    );
  }

  type Body = { password?: string; confirm?: string; locale?: string };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body.locale);

  const password = (body.password ?? "").trim();
  // Klient skickar "RADERA" som extra friction-step — minskar risken
  // för 1-click-deletion när användaren testar UI:t.
  const confirm = (body.confirm ?? "").trim();

  if (!password) {
    return c.json({ error: uiError(locale, "passwordRequired") }, 400);
  }
  // EN UI asks for DELETE; SV UI asks for RADERA — accept both.
  const confirmNorm = String(confirm ?? "").trim().toUpperCase();
  if (confirmNorm !== "RADERA" && confirmNorm !== "DELETE") {
    return c.json({ error: uiError(locale, "confirmDeleteWord") }, 400);
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

    // Redan begärt: returnera idempotent OK med scheduledAt. Användaren
    // ska inte få ett 409 som ser ut som en bugg.
    if (user.deletionRequestedAt && user.scheduledDeletionAt) {
      return c.json({
        ok: true,
        alreadyRequested: true,
        scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
      });
    }

    // Redan raderat: 410 Gone.
    if (user.deletedAt) {
      return c.json({ error: uiError(locale, "accountAlreadyDeleted") }, 410);
    }

    let valid: boolean;
    try {
      valid = await verify(user.passwordHash, password);
    } catch {
      return c.json({ error: uiError(locale, "passwordCannotVerify") }, 400);
    }
    if (!valid) {
      void auditLog({
        userId: user.id,
        action: "auth.delete_account.failed",
        meta: {
          ...requestContext((n) => c.req.header(n)),
          reason: "bad_password",
        },
      });
      return c.json({ error: uiError(locale, "wrongPassword") }, 401);
    }

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + DELETION_COOLDOWN_MS);

    await db
      .update(users)
      .set({
        deletionRequestedAt: now,
        scheduledDeletionAt: scheduledAt,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // Logga ut alla sessions (även current) så att kontot inte längre
    // kan användas under cooldown. Användaren kan dock fortfarande
    // logga in igen och då ses banner: "ditt konto är schemalagt
    // för radering om X dagar".
    try {
      await destroyUserSessions(user.id);
    } catch (err) {
      log.warn({ err, userId: user.id }, "failed to revoke sessions after deletion request");
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });

    void auditLog({
      userId: user.id,
      action: "auth.delete_account.requested",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        scheduledAt: scheduledAt.toISOString(),
        cooldownDays: DELETION_COOLDOWN_DAYS,
      },
    });

    // Fire-and-forget bekräftelse-mail. Innehåller signed cancel-token
    // så användaren kan ångra utan att behöva logga in.
    void (async () => {
      try {
        const token = issueDeletionCancelToken(user.id);
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.SITE_URL ||
          "https://roots.se";
        const cancelUrl = `${siteUrl}${withLocalePath("/konto/avbryt-radering", locale)}?token=${encodeURIComponent(token)}`;
        await getEmailSender().sendEmail({
          to: user.email,
          ...deletionRequestEmail({
            name:
              user.contactName?.split(" ")[0] ||
              user.email.split("@")[0] ||
              (locale === "en" ? "there" : "där"),
            scheduledDeletionAt: scheduledAt,
            cancelUrl,
            locale,
          }),
        });
      } catch (err) {
        log.error({ err, userId: user.id }, "deletion request email failed");
      }
    })();

    return c.json({
      ok: true,
      scheduledDeletionAt: scheduledAt.toISOString(),
      cooldownDays: DELETION_COOLDOWN_DAYS,
    });
  } catch (err) {
    log.error({ err, userId: session.userId }, "delete-account failed");
    return c.json({ error: uiError(locale, "deletionRequestFailed") }, 500);
  }
});

auth.get("/deletion-status", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return c.json({ status: "none" });

  try {
    const session = await getSession(match[1]);
    if (!session?.userId) return c.json({ status: "none" });

    const [user] = await db
      .select({
        deletionRequestedAt: users.deletionRequestedAt,
        scheduledDeletionAt: users.scheduledDeletionAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) return c.json({ status: "none" });
    if (user.deletedAt) return c.json({ status: "deleted" });
    if (user.scheduledDeletionAt) {
      return c.json({
        status: "scheduled",
        requestedAt: user.deletionRequestedAt?.toISOString() ?? null,
        scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
      });
    }
    return c.json({ status: "none" });
  } catch (err) {
    log.warn({ err }, "deletion-status failed");
    return c.json({ status: "unknown" });
  }
});

/**
 * Avbryt en pågående radering. Två paths:
 *   1. Inloggad ASSOCIATION_ADMIN/SELLER/… med samma userId.
 *   2. Anonym med valid signed `?token=` (från mailen). Detta gör att
 *      en användare som har tappat lösenordet ändå kan ångra (kritiskt
 *      när användaren råkar trigga delete från fel knapp och sedan
 *      blir utloggad).
 *
 * Bägge fall: nollar deletionRequestedAt + scheduledDeletionAt + skickar
 * bekräftelse-mail.
 */
auth.post("/cancel-deletion", async (c) => {
  // P2.41 (audit 2026-05-26): rate-limit:a endpointen så att en
  // angripare som fångat en deletion-cancel-länk inte kan göra
  // bulk-anrop med olika tokens för att brute-force HMAC eller
  // probeera vilka konton som är i raderingskö.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await deletionCancelRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "rateLimitedWaitMinutes") },
      429
    );
  }

  type Body = { token?: string; locale?: string };
  let body: Body = {};
  try {
    body = await c.req.json<Body>();
  } catch {
    // OK — tom body är giltigt när man försöker via session.
  }
  const locale = resolveUiLocale(c, body.locale);

  let targetUserId: string | null = null;
  let viaToken = false;

  if (body.token) {
    const verified = verifyDeletionCancelToken(body.token);
    if (!verified) {
      return c.json({ error: uiError(locale, "invalidOrExpiredLink") }, 400);
    }
    targetUserId = verified.userId;
    viaToken = true;
  } else {
    const cookie = c.req.header("cookie") || "";
    const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match) {
      return c.json({ error: uiError(locale, "notLoggedInPeriod") }, 401);
    }
    try {
      const session = await getSession(match[1]);
      if (!session?.userId) {
        return c.json({ error: uiError(locale, "notLoggedInPeriod") }, 401);
      }
      targetUserId = session.userId;
    } catch {
      return c.json({ error: uiError(locale, "notLoggedInPeriod") }, 401);
    }
  }

  if (!targetUserId) {
    return c.json({ error: uiError(locale, "notLoggedInPeriod") }, 401);
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!user) {
      return c.json({ error: uiError(locale, "userNotFoundPeriod") }, 404);
    }
    if (user.deletedAt) {
      return c.json(
        { error: uiError(locale, "accountAlreadyDeletedGone") },
        410
      );
    }
    if (!user.scheduledDeletionAt) {
      // Idempotent: redan ångrat / aldrig begärt.
      return c.json({ ok: true, alreadyCancelled: true });
    }

    await db
      .update(users)
      .set({
        deletionRequestedAt: null,
        scheduledDeletionAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    void auditLog({
      userId: user.id,
      action: "auth.delete_account.cancelled",
      meta: {
        ...requestContext((n) => c.req.header(n)),
        viaToken,
      },
    });

    void (async () => {
      try {
        await getEmailSender().sendEmail({
          to: user.email,
          ...deletionCancelledEmail({
            name:
              user.contactName?.split(" ")[0] ||
              user.email.split("@")[0] ||
              (locale === "en" ? "there" : "där"),
            locale,
          }),
        });
      } catch (err) {
        log.error({ err, userId: user.id }, "cancellation email failed");
      }
    })();

    return c.json({ ok: true });
  } catch (err) {
    log.error({ err, userId: targetUserId }, "cancel-deletion failed");
    return c.json({ error: uiError(locale, "cancelDeletionFailed") }, 500);
  }
});

auth.get("/me", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  if (!match) {
    return c.json({ user: null }, 200);
  }

  const sessionId = match[1];

  // Try Redis session first
  try {
    const session = await getSession(sessionId);
    if (session) {
      // MASTERPLAN_01 KC2.4: rolling-window-refresh. När sessionen har
      // använts mer än halva sin TTL, förläng både Redis-TTL och
      // browser-cookie:n så att aktiva användare inte loggas ut
      // mitt i ett köp efter 7 dagar. Best-effort: en Redis-hick får
      // inte blockera /me-svaret.
      const ageMs = Date.now() - (session.createdAt ?? 0);
      if (ageMs > SESSION_REFRESH_THRESHOLD_MS) {
        try {
          await refreshSession(sessionId);
          setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
        } catch (err) {
          log.warn({ err }, "session refresh failed (non-fatal)");
        }
      }

      let email = "";
      let name = "";
      let orgName = "";

      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (user) {
          email = user.email;
          name = user.contactName || user.email;

          if (user.orgId) {
            const [org] = await db
              .select()
              .from(organizations)
              .where(eq(organizations.id, user.orgId))
              .limit(1);
            orgName = org?.name ?? "";
          }
        } else if (session.demoProfile) {
          email = session.demoProfile.email;
          name = session.demoProfile.name;
          orgName = session.demoProfile.orgName;
        }
      } catch {}

      return c.json({
        user: {
          email,
          role: session.role,
          name,
          orgName,
          orgId: session.orgId,
          userId: session.userId,
          // Rollen kräver tvåfaktor men ingen app är registrerad. /me är en
          // av få endpoints som mfa-guarden släpper igenom, just för att
          // klienten ska kunna visa vägen ut istället för att bara få 403
          // på allt annat.
          mfaEnrollmentRequired: !!session.mfaPending,
        },
      });
    }
  } catch {}

  return c.json({ user: null }, 200);
});

auth.post("/register/association", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP innan vi rör DB
  // eller skickar welcome-email. Förhindrar trivial signup-flood.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "registrationRateLimited") },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body?.locale);

  const {
    orgName,
    orgNumber,
    nationalFederation,
    sportType,
    email,
    password,
    contactName,
    phone,
    addressLine1,
    city,
    postalCode,
  } = body;

  if (!orgName || !email || !password || !contactName) {
    return c.json({ error: uiError(locale, "requiredFieldsMustFill") }, 400);
  }

  const pwErr = validatePassword(password, locale);
  if (pwErr) return c.json({ error: pwErr }, 400);

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: uiError(locale, "emailAlreadyRegistered") }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    const { org, user } = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          orgNumber: orgNumber || null,
          type: "association",
          nationalFederation: nationalFederation || null,
          sportType: sportType || null,
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "ASSOCIATION_ADMIN",
          orgId: org.id,
          contactName,
          phone: phone || null,
          addressLine1: addressLine1 || null,
          city: city || null,
          postalCode: postalCode || null,
        })
        .returning();

      return { org, user };
    });

    // Enqueue AFTER tx commits — pg-boss runs on a separate connection and
    // cannot participate in the Drizzle transaction. If we enqueued inside
    // the tx and it rolled back, we'd schedule work for a non-existent org.
    scheduleOrgNormalize(org.id);

    const sessionData: SessionData = {
      userId: user.id,
      role: "ASSOCIATION_ADMIN",
      orgId: org.id,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: user.id,
      action: "auth.register.association",
      entityType: "organization",
      entityId: org.id,
      meta: { ...requestContext((n) => c.req.header(n)) },
    });

    getEmailSender()
      .sendEmail({
        to: user.email,
        ...welcomeEmail(contactName, "ASSOCIATION_ADMIN", locale),
      })
      .catch((e) => log.error({ err: e }, "Registration email failed"));

    return c.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.contactName,
        orgName: org.name,
        orgId: org.id,
        userId: user.id,
      },
    });
  } catch (err) {
    log.error({ err }, "Association registration failed");
    return c.json({ error: uiError(locale, "registrationFailed") }, 500);
  }
});

auth.post("/register/team-leader", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "registrationRateLimited") },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body?.locale);

  const {
    teamName,
    orgName,
    existingOrgId,
    email,
    password,
    contactName,
    phone,
    addressLine1,
    city,
    postalCode,
  } = body;

  if (!teamName || !email || !password || !contactName) {
    return c.json({ error: uiError(locale, "requiredFieldsMustFill") }, 400);
  }

  const pwErr = validatePassword(password, locale);
  if (pwErr) return c.json({ error: pwErr }, 400);

  // P2.5 (audit 2026-05-26): tidigare lät endpointen vem som helst
  // ansluta sin nya team-leader till en valfri existerande
  // organisations-UUID utan att äga den. Det betydde att en angripare
  // kunde gissa/läcka org-IDt och sätta sig själv som TEAM_LEADER
  // i en annan förening. Den enda legitima vägen in i en befintlig
  // förening är via team-invite (`/v1/association/team-invites/claim`).
  // Vi avvisar därför `existingOrgId` här explicit; klienten ska
  // använda invite-flödet i stället.
  if (existingOrgId !== undefined && existingOrgId !== null && existingOrgId !== "") {
    return c.json({ error: uiError(locale, "useTeamInvite") }, 400);
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: uiError(locale, "emailAlreadyRegistered") }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    let validatedOrgId: string | null = null;
    let resolvedOrgName = orgName || teamName;

    // Captured inside the tx and consumed AFTER commit. Must be `let` (and
    // declared outside the closure) so the enqueue call below the tx can see
    // whether a new org was actually created.
    let newlyCreatedOrgId: string | null = null;

    const txResult = await db.transaction(async (tx) => {
      let orgId: string | null = validatedOrgId;

      if (!orgId && orgName) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: orgName, type: "club" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
        newlyCreatedOrgId = org.id;
      } else if (!orgId) {
        const [org] = await tx
          .insert(organizations)
          .values({ name: teamName, type: "team" })
          .returning();
        orgId = org.id;
        resolvedOrgName = org.name;
        newlyCreatedOrgId = org.id;
      }

      const [user] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "TEAM_LEADER",
          orgId,
          contactName,
          phone: phone || null,
          addressLine1: addressLine1 || null,
          city: city || null,
          postalCode: postalCode || null,
        })
        .returning();

      let createdTeamId: string | null = null;

      const [activeCampaign] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.orgId, orgId!), eq(campaigns.status, "ACTIVE")))
        .orderBy(campaigns.createdAt)
        .limit(1);

      if (activeCampaign) {
        const inviteToken = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
        const [team] = await tx
          .insert(teams)
          .values({
            orgId: orgId!,
            campaignId: activeCampaign.id,
            leaderId: user.id,
            name: teamName,
            inviteToken,
          })
          .returning();
        createdTeamId = team.id;
      }

      return { orgId: orgId!, user, createdTeamId };
    });

    // Enqueue AFTER tx commits — see note in /register/association above.
    if (newlyCreatedOrgId) {
      scheduleOrgNormalize(newlyCreatedOrgId);
    }

    const sessionData: SessionData = {
      userId: txResult.user.id,
      role: "TEAM_LEADER",
      orgId: txResult.orgId,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: txResult.user.id,
      action: "auth.register.team_leader",
      entityType: "team",
      entityId: txResult.createdTeamId,
      meta: { ...requestContext((n) => c.req.header(n)), orgId: txResult.orgId },
    });

    getEmailSender()
      .sendEmail({
        to: txResult.user.email,
        ...welcomeEmail(contactName, "TEAM_LEADER", locale),
      })
      .catch((e) => log.error({ err: e }, "Team leader registration email failed"));

    return c.json({
      ok: true,
      user: {
        email: txResult.user.email,
        role: txResult.user.role,
        name: txResult.user.contactName,
        orgName: resolvedOrgName,
        orgId: txResult.orgId,
        userId: txResult.user.id,
      },
      teamName,
      teamId: txResult.createdTeamId,
    });
  } catch (err) {
    log.error({ err }, "Team leader registration failed");
    return c.json({ error: uiError(locale, "registrationFailed") }, 500);
  }
});

auth.post("/register/seller", async (c) => {
  // MASTERPLAN_01 KC2.9: cap 5 registrations/h/IP. Seller-flow är extra
  // intressant att skydda — invite-token gatekeepar typen men token kan
  // gå viralt och vi vill inte att en miljö som läcker den blir DOSad.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await registrationRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: uiError(resolveUiLocale(c), "registrationRateLimited") },
      429
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const locale = resolveUiLocale(c, body?.locale);

  const {
    inviteToken,
    email,
    password,
    displayName,
    phone,
    birthYear,
    guardianName,
    guardianEmail,
    guardianConsent,
  } = body;

  if (!inviteToken || !email || !password || !displayName) {
    return c.json({ error: uiError(locale, "requiredFieldsMustFill") }, 400);
  }

  const pwErr = validatePassword(password, locale);
  if (pwErr) return c.json({ error: pwErr }, 400);

  // Målsmanssamtycke. Kolumnerna har funnits sedan 0001 men samlades aldrig
  // in: en 13-åring kunde registrera sig, publicera en butik med sitt namn
  // och sälja en kosmetisk produkt utan att någon vuxen tillfrågats. Under
  // GDPR (art. 8) och för vår egen del måste samtycket finnas och kunna
  // visas i efterhand.
  const currentYear = new Date().getFullYear();
  const parsedBirthYear = Number(birthYear);
  if (
    !Number.isInteger(parsedBirthYear) ||
    parsedBirthYear < currentYear - 100 ||
    parsedBirthYear > currentYear
  ) {
    return c.json({ error: uiError(locale, "enterBirthYear") }, 400);
  }
  // Konservativt: vi jämför bara årtal, så den som fyller år senare i år
  // räknas som yngre. Det gör att gränsfallen hamnar på den säkra sidan.
  const approximateAge = currentYear - parsedBirthYear;
  const needsGuardian = approximateAge < GUARDIAN_CONSENT_AGE;

  const guardianNameTrimmed =
    typeof guardianName === "string" ? guardianName.trim() : "";
  const guardianEmailTrimmed =
    typeof guardianEmail === "string" ? guardianEmail.toLowerCase().trim() : "";

  if (needsGuardian) {
    if (guardianConsent !== true) {
      return c.json(
        {
          error: uiError(locale, "guardianConsentRequired"),
          requiresGuardianConsent: true,
        },
        400
      );
    }
    if (guardianNameTrimmed.length < 2) {
      return c.json(
        {
          error: uiError(locale, "enterGuardianName"),
          requiresGuardianConsent: true,
        },
        400
      );
    }
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmailTrimmed) ||
      guardianEmailTrimmed.length > 254
    ) {
      return c.json(
        {
          error: uiError(locale, "enterGuardianEmail"),
          requiresGuardianConsent: true,
        },
        400
      );
    }
    if (guardianEmailTrimmed === String(email).toLowerCase().trim()) {
      return c.json(
        {
          error: uiError(locale, "guardianEmailMustDiffer"),
          requiresGuardianConsent: true,
        },
        400
      );
    }
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.inviteToken, inviteToken))
      .limit(1);

    if (!team) {
      return c.json({ error: uiError(locale, "invalidInviteLink") }, 404);
    }

    // MASTERPLAN_01 KC3.4: token-rotation. Existerande rader har
    // inviteTokenExpiresAt = null + inviteTokenMaxUses = null vilket
    // är "backward-compatible" (samma evig+multi-use som tidigare).
    // Roterade tokens har konkreta värden — då måste vi validera.
    if (
      team.inviteTokenExpiresAt &&
      team.inviteTokenExpiresAt.getTime() < Date.now()
    ) {
      return c.json({ error: uiError(locale, "inviteLinkExpired") }, 410);
    }
    if (
      team.inviteTokenMaxUses !== null &&
      team.inviteTokenUseCount >= team.inviteTokenMaxUses
    ) {
      return c.json({ error: uiError(locale, "inviteLinkExhausted") }, 410);
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: uiError(locale, "emailAlreadyRegistered") }, 409);
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    // MASTERPLAN_01 KC3.5: swedish-aware slug. The previous regex stripped
    // every å/ä/ö which left e.g. "Åsa Söderström" with the slug "------".
    const shopSlug = makeShopSlug(displayName);

    // P2.20 (audit 2026-05-26): tidigare gjordes max_uses-checken med
    // ett läs-värde innan UPDATE — två concurrent requests på samma
    // token kunde båda passera checken och båda bump:a +1 så att
    // useCount > maxUses. Vi gör nu en konditional UPDATE som första
    // steg i transaktionen och rollbackar hela inserten om ingen rad
    // ändrades. Atomiska sql`+1` skyddar mot dubbelräkning av single
    // counter men inte mot att passera maxUses-gränsen.
    type RegistrationResult =
      | { ok: true; user: typeof users.$inferSelect }
      | { ok: false; reason: "invite_exhausted" };
    let result: RegistrationResult;
    try {
      result = await db.transaction<RegistrationResult>(async (tx) => {
        const updated = await tx
          .update(teams)
          .set({
            memberCount: sql`${teams.memberCount} + 1`,
            inviteTokenUseCount: sql`${teams.inviteTokenUseCount} + 1`,
          })
          .where(
            and(
              eq(teams.id, team.id),
              sql`(${teams.inviteTokenMaxUses} IS NULL OR ${teams.inviteTokenUseCount} < ${teams.inviteTokenMaxUses})`
            )
          )
          .returning({ id: teams.id });

        if (updated.length === 0) {
          throw new Error("InviteExhausted");
        }

        const [createdUser] = await tx
          .insert(users)
          .values({
            email: email.toLowerCase().trim(),
            passwordHash,
            role: "SELLER",
            orgId: team.orgId,
            contactName: displayName,
            phone: phone || null,
            birthYear: parsedBirthYear,
            guardianName: needsGuardian ? guardianNameTrimmed : null,
            guardianEmail: needsGuardian ? guardianEmailTrimmed : null,
            guardianConsentAt: needsGuardian ? new Date() : null,
            guardianConsentIp: needsGuardian ? ip : null,
            guardianConsentVersion: needsGuardian
              ? GUARDIAN_CONSENT_VERSION
              : null,
          })
          .returning();

        await tx.insert(sellers).values({
          userId: createdUser.id,
          teamId: team.id,
          campaignId: team.campaignId,
          shopSlug,
          displayName,
        });

        return { ok: true, user: createdUser };
      });
    } catch (err) {
      if ((err as Error)?.message === "InviteExhausted") {
        result = { ok: false, reason: "invite_exhausted" };
      } else {
        throw err;
      }
    }

    if (!result.ok) {
      return c.json({ error: uiError(locale, "inviteLinkExhausted") }, 410);
    }
    const user = result.user;

    const sessionData: SessionData = {
      userId: user.id,
      role: "SELLER",
      orgId: team.orgId,
      createdAt: Date.now(),
    };

    const sessionId = await createSession(sessionData);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    void auditLog({
      userId: user.id,
      action: "auth.register.seller",
      entityType: "user",
      entityId: user.id,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        teamId: team.id,
        shopSlug,
        birthYear: parsedBirthYear,
        guardianConsent: needsGuardian,
        guardianConsentVersion: needsGuardian ? GUARDIAN_CONSENT_VERSION : null,
      },
    });

    getEmailSender()
      .sendEmail({
        to: user.email,
        ...welcomeEmail(displayName, "SELLER", locale),
      })
      .catch((e) => log.error({ err: e }, "Seller registration email failed"));

    if (needsGuardian) {
      void (async () => {
        try {
          const [org] = await db
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, team.orgId))
            .limit(1);
          await getEmailSender().sendEmail({
            to: guardianEmailTrimmed,
            ...guardianConsentNoticeEmail({
              guardianName:
                guardianNameTrimmed.split(" ")[0] ||
                (locale === "en" ? "there" : "där"),
              sellerName: displayName,
              teamName: team.name,
              associationName:
                org?.name ?? (locale === "en" ? "the club" : "föreningen"),
              locale,
            }),
          });
        } catch (err) {
          log.error({ err, userId: user.id }, "guardian consent notice failed");
        }
      })();
    }

    return c.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.contactName,
        userId: user.id,
      },
      shopSlug,
    });
  } catch (err) {
    log.error({ err }, "Seller registration failed");
    return c.json({ error: uiError(locale, "registrationFailed") }, 500);
  }
});

auth.get("/organizations/search", async (c) => {
  const locale = resolveUiLocale(c);
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionId = match ? match[1] : null;
  if (!sessionId) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  let session: SessionData | null = null;
  try {
    session = await getSession(sessionId);
  } catch {}
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  // P2.6 (audit 2026-05-26): tidigare exponerade endpointen ett
  // cross-tenant-directory över alla organisationer för vilken
  // inloggad användare som helst (inkl SELLER/CLUB_MEMBER). Begränsa
  // till roller som faktiskt behöver söka — SALES_REP/SALES_ADMIN/
  // INTERNAL_ADMIN — och TEAM_LEADER (som kan vara på väg att
  // registrera ny förening eller verifiera namnkonflikt). Övriga
  // får 403.
  const ALLOWED_ROLES = new Set([
    "SALES_REP",
    "SALES_ADMIN",
    "INTERNAL_ADMIN",
    "TEAM_LEADER",
  ]);
  if (!ALLOWED_ROLES.has(session.role)) {
    return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  }

  const query = c.req.query("q") || "";
  if (query.length < 2) {
    return c.json({ organizations: [] });
  }

  const sanitized = query.replace(/[%_]/g, "");
  if (sanitized.length < 2) {
    return c.json({ organizations: [] });
  }

  try {
    const results = await db
      .select({ id: organizations.id, name: organizations.name, type: organizations.type })
      .from(organizations)
      .where(ilike(organizations.name, `%${sanitized}%`))
      .limit(10);

    return c.json({ organizations: results });
  } catch {
    return c.json({ organizations: [] });
  }
});
