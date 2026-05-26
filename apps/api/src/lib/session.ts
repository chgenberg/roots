import { redis } from "./redis";
import type { Role } from "@roots/contracts";
import { childLogger } from "./logger";
import { db } from "@roots/db";
import { users } from "@roots/db/schema";
import { eq } from "drizzle-orm";

const log = childLogger("session");

const SESSION_PREFIX = "sess:";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * P2.7 (audit 2026-05-26): in-process cache för fresh role/orgId.
 *
 * Tidigare snapshotades role+orgId vid login och lästes vidare ur
 * Redis tills sessionen expirerade — så en admin som downgrad:ade
 * eller flyttade en användare fick vänta upp till 7 dagar på att
 * den nya rollen slog igenom. En `users.deletedAt`-rensning gav
 * samma problem och behöll session-zombies.
 *
 * Vi syncar därför role + orgId + deletedAt från DB i `getSession`
 * men med en per-process TTL på 30 s så vi inte gör 1 DB-anrop
 * per request på heta routes. Det räcker för att rätta nya RBAC-
 * beslut inom samma minut.
 */
const USER_SYNC_TTL_MS = 30 * 1000;
const userSyncCache = new Map<
  string,
  {
    role: Role;
    orgId: string | null;
    deletedAt: Date | null;
    isDemoAccount: boolean;
    expiresAt: number;
  }
>();
function pruneUserSyncCache() {
  if (userSyncCache.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of userSyncCache) {
    if (v.expiresAt < now) userSyncCache.delete(k);
  }
}

// P3.28 (audit 2026-05-26): DB-seeded demo accounts (klubb@demo.se,
// *@demo-if.se, *@demo.se etc.) hade tidigare ingen demoProfile-flagga,
// så isDemoSession returnerade false och de slank igenom våra
// mutation-guards när ROOTS_ENABLE_DEMO_ACCOUNTS=true i staging/prod.
// Vi taggar dem nu baserat på email-mönster så samma guards gäller.
const DEMO_EMAIL_PATTERNS: RegExp[] = [
  /@demo\.se$/i,
  /@demo-if\.se$/i,
];
function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEMO_EMAIL_PATTERNS.some((re) => re.test(email));
}

async function syncUserAuthFromDb(
  userId: string
): Promise<{
  role: Role;
  orgId: string | null;
  deletedAt: Date | null;
  isDemoAccount: boolean;
} | null> {
  const now = Date.now();
  const cached = userSyncCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return {
      role: cached.role,
      orgId: cached.orgId,
      deletedAt: cached.deletedAt,
      isDemoAccount: cached.isDemoAccount,
    };
  }
  try {
    const [row] = await db
      .select({
        role: users.role,
        orgId: users.orgId,
        deletedAt: users.deletedAt,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) {
      userSyncCache.delete(userId);
      return null;
    }
    const fresh = {
      role: row.role as Role,
      orgId: row.orgId,
      deletedAt: row.deletedAt,
      isDemoAccount: isDemoEmail(row.email),
    };
    userSyncCache.set(userId, { ...fresh, expiresAt: now + USER_SYNC_TTL_MS });
    pruneUserSyncCache();
    return fresh;
  } catch (err) {
    // DB hiccup ska inte logga ut alla — fall back på cachad
    // session-data och försök igen nästa request.
    log.warn({ err, userId }, "session DB sync failed; using cached values");
    return null;
  }
}

/** Invalidera per-process syncen för en user. Anropas när vi medvetet
 *  ändrar role/orgId/deletedAt så vi inte väntar 30s på TTL. */
export function invalidateUserAuthSync(userId: string): void {
  userSyncCache.delete(userId);
}

/**
 * MASTERPLAN_01 KC2.4: rolling-window-refresh tröskel.
 * Vi vill inte uppdatera Redis TTL på varje /me-anrop (browser pollar
 * /me ofta). Istället: när sessionens ålder > 50% av SESSION_TTL,
 * räknar /me-handler den som "halvgammal" och triggar en refresh
 * (best-effort). Detta håller aktiva användare inloggade utan att
 * spamma Redis EXPIRE.
 */
export const SESSION_REFRESH_THRESHOLD_MS = (SESSION_TTL * 1000) / 2;

export interface SessionData {
  userId: string;
  role: Role;
  orgId: string | null;
  createdAt: number;
  /** In-memory demo login (no DB row); used by /me when userId is not in DB. */
  demoProfile?: { email: string; name: string; orgName: string };
  /**
   * P3.28: true för DB-seeded demo-accounts (matchar email-pattern). Sätts
   * via syncUserAuthFromDb i getSession. Mutations-guards ska behandla
   * dessa som demo även när userId är riktig.
   */
  isDemoAccount?: boolean;
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
  let session: SessionData | null = null;

  if (await isRedisAvailable()) {
    const raw = await redis.get(`${SESSION_PREFIX}${id}`);
    if (!raw) return null;
    try {
      session = JSON.parse(raw) as SessionData;
    } catch {
      log.warn({ sessionId: id.slice(0, 8) }, "corrupt session data");
      return null;
    }
  } else {
    const entry = memoryStore.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryStore.delete(id);
      return null;
    }
    try {
      session = JSON.parse(entry.data) as SessionData;
    } catch {
      return null;
    }
  }

  if (!session) return null;

  // P2.7: hämta färska role/orgId från DB för icke-demo-sessioner.
  // Om användaren har raderats (deletedAt satt) returnerar vi null
  // så att gamla session-zombies inte fortsätter ha åtkomst. Demo-
  // sessioner har ingen DB-rad och bypass:ar syncen.
  if (session.userId && !session.demoProfile) {
    const fresh = await syncUserAuthFromDb(session.userId);
    if (fresh) {
      if (fresh.deletedAt) {
        return null;
      }
      // Returnera en kopia med uppdaterad role/orgId så caller alltid
      // ser DB-sanningen. Vi skriver inte tillbaka till Redis för att
      // hålla skrivkostnaden nere — TTL:n på Redis-sessionen styr
      // session-livscykeln, in-memory syncen styr fresh authz.
      session = {
        ...session,
        role: fresh.role,
        orgId: fresh.orgId,
        isDemoAccount: fresh.isDemoAccount,
      };
    }
  }

  return session;
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
  if (!session) return false;
  // P3.28: blockera BÅDE in-memory demoProfile-sessions OCH DB-seeded
  // demo-accounts (matchade på email-pattern i syncUserAuthFromDb).
  return Boolean(session.demoProfile) || Boolean(session.isDemoAccount);
}

/**
 * MASTERPLAN_01 KC2.4: rolling-window refresh.
 *
 * Tidigare bumpade vi bara EXPIRE; `session.createdAt` stod kvar på
 * original-värdet och varje /me efter halv-TTL triggade refresh igen
 * = Redis-EXPIRE-spam. Nu sätter vi även `createdAt = now` i datat,
 * så nästa refresh inte triggas förrän halva nya TTL passerat.
 */
export async function refreshSession(id: string): Promise<void> {
  if (await isRedisAvailable()) {
    const raw = await redis.get(`${SESSION_PREFIX}${id}`);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SessionData;
      data.createdAt = Date.now();
      await redis.set(
        `${SESSION_PREFIX}${id}`,
        JSON.stringify(data),
        "EX",
        SESSION_TTL
      );
    } catch {
      // Corrupt JSON — fall back to bumping the TTL only.
      await redis.expire(`${SESSION_PREFIX}${id}`, SESSION_TTL);
    }
    return;
  }
  const entry = memoryStore.get(id);
  if (entry) {
    try {
      const data = JSON.parse(entry.data) as SessionData;
      data.createdAt = Date.now();
      entry.data = JSON.stringify(data);
    } catch {
      // ignore corrupt JSON
    }
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
