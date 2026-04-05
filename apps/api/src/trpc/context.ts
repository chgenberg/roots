import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";

export interface Context {
  userId: string | null;
  role: string | null;
  orgId: string | null;
  sessionId: string | null;
  ip: string;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<Context> {
  const cookieHeader = opts.req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE_NAME] || null;
  const ip =
    opts.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!sessionId) {
    return { userId: null, role: null, orgId: null, sessionId: null, ip };
  }

  try {
    const session = await getSession(sessionId);
    if (session) {
      return {
        userId: session.userId,
        role: session.role,
        orgId: session.orgId,
        sessionId,
        ip,
      };
    }
  } catch {}

  return { userId: null, role: null, orgId: null, sessionId: null, ip };
}
