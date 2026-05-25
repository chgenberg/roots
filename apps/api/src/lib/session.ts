import { redis } from "./redis";
import type { Role } from "@roots/contracts";
import { childLogger } from "./logger";

const log = childLogger("session");

const SESSION_PREFIX = "sess:";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface SessionData {
  userId: string;
  role: Role;
  orgId: string | null;
  createdAt: number;
  /** In-memory demo login (no DB row); used by /me when userId is not in DB. */
  demoProfile?: { email: string; name: string; orgName: string };
}

// In-memory fallback for development when Redis is unavailable
const memoryStore = new Map<string, { data: string; expiresAt: number }>();

async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function createSession(data: SessionData): Promise<string> {
  const id = crypto.randomUUID();
  const json = JSON.stringify(data);

  if (await isRedisAvailable()) {
    await redis.set(`${SESSION_PREFIX}${id}`, json, "EX", SESSION_TTL);
    return id;
  }

  if (IS_PRODUCTION) {
    throw new Error("Redis is required in production");
  }

  memoryStore.set(id, { data: json, expiresAt: Date.now() + SESSION_TTL * 1000 });
  log.warn("Using in-memory session store (Redis unavailable)");
  return id;
}

export async function getSession(id: string): Promise<SessionData | null> {
  if (await isRedisAvailable()) {
    const raw = await redis.get(`${SESSION_PREFIX}${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      log.warn({ sessionId: id.slice(0, 8) }, "corrupt session data");
      return null;
    }
  }

  const entry = memoryStore.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(id);
    return null;
  }
  try {
    return JSON.parse(entry.data) as SessionData;
  } catch {
    return null;
  }
}

export async function destroySession(id: string): Promise<void> {
  if (await isRedisAvailable()) {
    await redis.del(`${SESSION_PREFIX}${id}`);
    return;
  }
  memoryStore.delete(id);
}

/**
 * MASTERPLAN_01 KC2.6: invalidate every other session for a given user
 * except `exceptSessionId`. Used by /v1/auth/change-password so that
 * changing the password actually kicks every other device out, which
 * matches what users expect from "Byt lösenord".
 *
 * Implementation note: Redis is single-key per session and we don't
 * maintain a user→sessions index (yet). For now we SCAN every
 * `sess:*` key, parse the JSON, and DEL the ones whose userId matches.
 * That's O(active sessions) which is fine while we have hundreds, not
 * millions. When we exceed ~10k active sessions, add a `sess-by-user:`
 * Redis set or move sessions to Postgres.
 */
export async function destroyUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  if (!userId) return 0;
  let removed = 0;

  if (await isRedisAvailable()) {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${SESSION_PREFIX}*`,
        "COUNT",
        500
      );
      cursor = next;
      for (const key of keys) {
        const id = key.startsWith(SESSION_PREFIX)
          ? key.slice(SESSION_PREFIX.length)
          : key;
        if (exceptSessionId && id === exceptSessionId) continue;
        const raw = await redis.get(key);
        if (!raw) continue;
        try {
          const data = JSON.parse(raw) as SessionData;
          if (data.userId === userId) {
            await redis.del(key);
            removed += 1;
          }
        } catch {
          // ignore corrupt entries
        }
      }
    } while (cursor !== "0");
    return removed;
  }

  for (const [id, entry] of memoryStore.entries()) {
    if (exceptSessionId && id === exceptSessionId) continue;
    try {
      const data = JSON.parse(entry.data) as SessionData;
      if (data.userId === userId) {
        memoryStore.delete(id);
        removed += 1;
      }
    } catch {
      // ignore
    }
  }
  return removed;
}

/**
 * MASTERPLAN_01 KC2.1: throw if `session` belongs to an in-memory demo
 * account. Use on endpoints that perform real state mutations (payouts,
 * Fortnox sync, settlement, account deletion, system settings).
 */
export function isDemoSession(session: SessionData | null | undefined): boolean {
  return Boolean(session?.demoProfile);
}

export async function refreshSession(id: string): Promise<void> {
  if (await isRedisAvailable()) {
    await redis.expire(`${SESSION_PREFIX}${id}`, SESSION_TTL);
    return;
  }
  const entry = memoryStore.get(id);
  if (entry) {
    entry.expiresAt = Date.now() + SESSION_TTL * 1000;
  }
}

export const SESSION_COOKIE_NAME = "rootsSessionId";

/** In production the web app and API are on different hosts; Lax would block cookies on cross-origin fetch. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: (IS_PRODUCTION ? "none" : "lax") as "none" | "lax",
  path: "/",
  maxAge: SESSION_TTL,
};
