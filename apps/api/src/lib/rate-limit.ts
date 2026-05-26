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

export async function aiRateLimit(userId: string): Promise<RateLimitResult> {
  const key = `ai:${userId}`;
  return checkRateLimit(key, 30, 60); // 30 requests per minute
}

/** Public hair-analysis endpoint — tight limit per IP */
export async function hairAnalysisIpRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `hair:${ip}`;
  return checkRateLimit(key, 15, 24 * 60 * 60); // 15 per 24h per IP
}
