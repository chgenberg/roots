import { redis } from "./redis";
import { childLogger } from "./logger";

const log = childLogger("rate-limit");
const IS_PROD = process.env.NODE_ENV === "production";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  /** True when the limit decision was a degraded-mode fallback (Redis down). */
  degraded?: boolean;
}

/**
 * MASTERPLAN_01 KC5.2: fail-CLOSED i prod.
 *
 * Tidigare: Redis-hick → `allowed: true` på allt → obegränsad public-chat,
 * hair-analysis och login. Kostnadsexplosion + möjlig brute-force.
 *
 * Nu:
 *   - prod: Redis-error → `allowed: false` med kort retryAfter (30 s).
 *     Logga en warn så ops ser. Klienten ser "tjänsten tillfälligt
 *     överbelastad" istället för obegränsad åtkomst.
 *   - dev: behåll fail-open så `pnpm dev` funkar utan Redis.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const redisKey = `rl:${key}`;

    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    const ttl = await redis.ttl(redisKey);

    return {
      allowed: current <= maxAttempts,
      remaining: Math.max(0, maxAttempts - current),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (err) {
    if (IS_PROD) {
      log.error(
        { err, key: key.slice(0, 60) },
        "rate-limit Redis lookup failed — failing closed"
      );
      return { allowed: false, remaining: 0, resetInSeconds: 30, degraded: true };
    }
    log.warn({ err, key: key.slice(0, 60) }, "rate-limit Redis unavailable — allowing in dev");
    return {
      allowed: true,
      remaining: maxAttempts,
      resetInSeconds: windowSeconds,
      degraded: true,
    };
  }
}

export async function loginRateLimit(
  ip: string,
  email: string
): Promise<RateLimitResult> {
  const key = `login:${ip}:${email}`;
  return checkRateLimit(key, 5, 15 * 60); // 5 attempts per 15 minutes
}

/**
 * MASTERPLAN_01 KC2.9: cap 5 registrations per hour per IP. Stops
 * trivial signup floods that would otherwise spam our email sender
 * (welcome emails ut till slumpmässiga adresser = bounce-rate ↑ =
 * Resend-domänen flaggas). Per-IP räcker som första lager; per-email
 * dedupe sker redan i `users`-tabellen via UNIQUE-constraint.
 */
export async function registrationRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `register:${ip}`;
  return checkRateLimit(key, 5, 60 * 60); // 5 per hour per IP
}

/**
 * Lösenordsbyte kräver nuvarande lösenord, vilket gör endpointen till ett
 * orakel för den som redan kapat en session. Utan tak kan den gissa fritt.
 */
export async function changePasswordRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return checkRateLimit(`chpw:${userId}`, 5, 15 * 60); // 5 per 15 min
}

/**
 * TOTP-försök. En sexsiffrig kod har en miljon möjliga värden och fönstret
 * ±1 gör tre av dem giltiga samtidigt, så utan tak är andra faktorn i
 * praktiken bara en fördröjning. Taket räknas per konto OCH per IP, så att
 * en angripare inte kan sprida gissningarna över många adresser.
 */
export async function mfaAttemptRateLimit(
  ip: string,
  userId: string
): Promise<RateLimitResult> {
  const perUser = await checkRateLimit(`mfa:user:${userId}`, 8, 15 * 60);
  if (!perUser.allowed) return perUser;
  return checkRateLimit(`mfa:ip:${ip}`, 30, 15 * 60);
}

/** Begäran om återställningslänk — per IP och per e-post. */
export async function passwordResetRequestRateLimit(
  ip: string,
  email: string
): Promise<RateLimitResult> {
  return checkRateLimit(`pwreset-req:${ip}:${email}`, 5, 60 * 60);
}

/** Inlösen av återställningstoken — bromsar token-gissning. */
export async function passwordResetConfirmRateLimit(
  ip: string
): Promise<RateLimitResult> {
  return checkRateLimit(`pwreset-confirm:${ip}`, 10, 60 * 60);
}

export async function aiRateLimit(userId: string): Promise<RateLimitResult> {
  const key = `ai:${userId}`;
  return checkRateLimit(key, 30, 60); // 30 requests per minute
}

/** Public hair-analysis endpoint — tight limit per IP */
export async function hairAnalysisIpRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `hair:${ip}`;
  return checkRateLimit(key, 15, 24 * 60 * 60); // 15 per 24h per IP
}

/**
 * Föreningskalkylatorns publika lead-capture. Den publika sidan är ogated
 * så en bot kan annars spamma in falska leads till säljaren. 10 per timme
 * per IP räcker gott för en legitim förening som testräknar ett par gånger.
 */
export async function calculatorLeadRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `calc-lead:${ip}`;
  return checkRateLimit(key, 10, 60 * 60); // 10 per hour per IP
}

/**
 * Scout fix 2026-05-26 (AI-CRIT-01): per-IP/per-user-budgetar räcker
 * inte mot distribuerad abuse (botnet med N IPs × 15 vision/dag =
 * okontrollerad OpenAI-faktura). Vi adderar ett GLOBALT dygnstak
 * per AI-yta som hard-stop på request-nivå. Konfigurerbart via env
 * så ops kan justera utan deploy.
 *
 *   AI_GLOBAL_CHAT_DAILY_CAP        (default 5 000)
 *   AI_GLOBAL_VISION_DAILY_CAP      (default 300)
 *
 * Taken sänktes 2026-08-03: 50 000 chattsvar och 2 000 vision-anrop per
 * dygn är inte ett kostnadstak för ett bolag av vår storlek, det är ett
 * teoretiskt maxtak. Ett dygn på taket ska kosta något vi kan bära utan
 * att bli förvånade. Höj medvetet när trafiken motiverar det.
 *
 * Bucket-key inkluderar UTC-datum så räknaren auto-rullar varje
 * midnatt utan att vi behöver ttl:a manuellt.
 */
function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function readCap(envName: string, defaultValue: number): number {
  const raw = process.env[envName];
  if (!raw) return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

export async function aiGlobalChatDailyCap(): Promise<RateLimitResult> {
  const cap = readCap("AI_GLOBAL_CHAT_DAILY_CAP", 5_000);
  const key = `ai-global:chat:${todayUtcKey()}`;
  return checkRateLimit(key, cap, 26 * 60 * 60); // TTL > 24h så vi inte tappar mätning vid DST/restart
}

export async function aiGlobalVisionDailyCap(): Promise<RateLimitResult> {
  const cap = readCap("AI_GLOBAL_VISION_DAILY_CAP", 300);
  const key = `ai-global:vision:${todayUtcKey()}`;
  return checkRateLimit(key, cap, 26 * 60 * 60);
}

/**
 * P2.42 (audit 2026-05-26): /v1/checkout/create var helt
 * unrate-limit:ad. En enkel skript-spam mot publika personal
 * shop-slugs kunde skapa tusentals PENDING-orders + Stripe-sessions
 * per minut → Stripe-quota brann + databasen växte med skräp.
 *
 * 60 försök per timme per IP ger gott om utrymme för normal
 * familje-shopping från samma WiFi men stoppar abuse.
 */
export async function checkoutCreateRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `checkout:${ip}`;
  return checkRateLimit(key, 60, 60 * 60); // 60 per hour per IP
}

/**
 * P2.41 (audit 2026-05-26): /v1/auth/cancel-deletion var
 * unrate-limit:ad. Eftersom endpointen tar en token i URLen kan en
 * angripare med token-leak bombardera oss för att höra "ja" eller
 * "nej" på olika kandidater. Dessutom kan en angripare som lärt sig
 * URL-format försöka brute-force HMAC:en via timing-bias. 10 per
 * 10 minuter per IP är generöst för en legitim användare.
 */
export async function deletionCancelRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `cancel-deletion:${ip}`;
  return checkRateLimit(key, 10, 10 * 60); // 10 per 10 min per IP
}

/**
 * P3.25 (audit 2026-05-26): BankID-endpoints var publika utan rate limit.
 * En angripare kunde spam:a auth/start/collect/cancel och bränna
 * provider-quotan.
 *
 * Pre-push fix 2026-05-26: tidigare delade /auth/start, /auth/collect
 * och /auth/cancel samma bucket (`bankid:{ip}` 30/5min). Normal
 * collect-polling kör var 2:e sekund → 30 polls = 60s, sedan blir
 * användarens egen autentisering rate-limited mitt i BankID-flödet.
 * Lös genom att skilja på endpoint-typ: start/cancel är dyra (kallar
 * provider) men ovanliga, collect är billig men frekvent.
 */
export async function bankidStartRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  // start + cancel räknas ihop: en användare som öppnar appen,
  // ångrar sig, försöker igen ska få några försök innan vi stoppar.
  const key = `bankid:start:${ip}`;
  return checkRateLimit(key, 20, 5 * 60); // 20 starts/cancels per 5 min per IP
}

export async function bankidCollectRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  // Collect poll:as var 2:e sekund och kan i BankID-flödet pågå
  // upp till 180s = max ~90 polls per försök. 300/5min ger ~3 fulla
  // försök parallellt utan att låsa ute legitima användare.
  const key = `bankid:collect:${ip}`;
  return checkRateLimit(key, 300, 5 * 60);
}

/** @deprecated använd bankidStartRateLimit eller bankidCollectRateLimit. */
export async function bankidRateLimit(ip: string): Promise<RateLimitResult> {
  return bankidStartRateLimit(ip);
}

/**
 * P3.26 (audit 2026-05-26): team-invite resend påstod "5/10 min" i
 * kommentar men hade ingen guard. Cap 5 per 10 min per invite-id.
 */
export async function teamInviteResendRateLimit(
  inviteId: string
): Promise<RateLimitResult> {
  const key = `team-invite-resend:${inviteId}`;
  return checkRateLimit(key, 5, 10 * 60);
}

/**
 * P3.59 (audit 2026-05-26): /v1/auth/delete-account verifierade
 * lösenord men hade ingen throttle utöver session-auth. Stulen session
 * → online password guessing. 5 försök per 15 min per user.
 */
export async function deleteAccountRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const key = `delete-account:${userId}`;
  return checkRateLimit(key, 5, 15 * 60);
}

/**
 * P3.60 (audit 2026-05-26): internal cron Bearer-validation returnerade
 * bara 401 utan throttling. Kort token → online guessing. 10 fel per
 * 15 min per IP innan vi failar closed på den IP:n.
 */
export async function internalCronFailRateLimit(
  ip: string
): Promise<RateLimitResult> {
  const key = `internal-cron-fail:${ip}`;
  return checkRateLimit(key, 10, 15 * 60);
}
