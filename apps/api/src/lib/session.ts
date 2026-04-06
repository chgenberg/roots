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
