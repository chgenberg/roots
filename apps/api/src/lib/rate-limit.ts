import { redis } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

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
  } catch {
    return { allowed: true, remaining: maxAttempts, resetInSeconds: windowSeconds };
  }
}

export async function loginRateLimit(
  ip: string,
  email: string
): Promise<RateLimitResult> {
  const key = `login:${ip}:${email}`;
  return checkRateLimit(key, 5, 15 * 60); // 5 attempts per 15 minutes
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
