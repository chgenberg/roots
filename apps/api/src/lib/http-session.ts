import type { Context } from "hono";
import { getSession, SESSION_COOKIE_NAME } from "./session";
import type { SessionData } from "./session";

/**
 * Läser sessionen ur request-cookien.
 *
 * Låg dessa två helpers tidigare kopierade i elva route-filer (alla med
 * `c: any`). En delad, typad implementation gör att cookie-parsningen bara
 * finns på ett ställe — annars riskerar en säkerhetsfix att appliceras på
 * några av kopiorna men inte alla.
 */
export function getSessionId(c: Context): string | null {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/** Returnerar sessionen, eller null om den saknas/är ogiltig. */
export async function requireSession(c: Context): Promise<SessionData | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;
  try {
    return await getSession(sessionId);
  } catch {
    return null;
  }
}
