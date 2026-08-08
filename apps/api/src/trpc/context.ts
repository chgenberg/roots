import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import {
  resolveUiLocaleFromHeaders,
  type UiLocale,
} from "../lib/ui-locale";

export interface Context {
  userId: string | null;
  role: string | null;
  orgId: string | null;
  sessionId: string | null;
  ip: string;
  // Scout fix 2026-05-26 (Auth-C2): expose demo-flagga i tRPC-context
  // så middleware kan blockera mutations från demo-konton.
  isDemo: boolean;
  locale: UiLocale;
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
  const locale = resolveUiLocaleFromHeaders((n) => opts.req.headers.get(n));

  if (!sessionId) {
    return {
      userId: null,
      role: null,
      orgId: null,
      sessionId: null,
      ip,
      isDemo: false,
      locale,
    };
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
        isDemo: session.isDemoAccount === true || Boolean(session.demoProfile),
        locale,
      };
    }
  } catch {}

  return {
    userId: null,
    role: null,
    orgId: null,
    sessionId: null,
    ip,
    isDemo: false,
    locale,
  };
}
