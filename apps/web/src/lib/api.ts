import { getBrowserApiBase } from "./api-base";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { getBrowserLocale, localeHeaders } from "@/i18n/browser-locale";

/**
 * Browser fetch to the Roots API with credentials + UI locale header.
 * Prefer this over raw `fetch` so English UI never receives Swedish API copy
 * when the browser's Accept-Language is Swedish.
 */
export function rootsFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const { headers: initHeaders, credentials, ...rest } = init;
  return fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    headers: localeHeaders(initHeaders),
  });
}

let csrfToken: string | null = null;

export class CsrfTokenError extends Error {
  constructor(readonly status: number) {
    super(appCommon[getBrowserLocale()].serviceUnavailable);
    this.name = "CsrfTokenError";
  }
}

/**
 * Shared CSRF fetch for any `fetch` that bypasses `apiFetch` (e.g. streaming AI).
 *
 * Token cachas bara vid lyckat svar. En 502 från proxyn får aldrig lämna
 * `csrfToken` satt till undefined — då hade nästa mutation skickat
 * `x-csrf-token: undefined` och fått 403 tills sidan laddades om.
 */
export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const base = getBrowserApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/v1/csrf-token`, {
      credentials: "include",
      headers: { "x-roots-locale": getBrowserLocale() },
    });
  } catch {
    throw new CsrfTokenError(0);
  }

  if (!res.ok) throw new CsrfTokenError(res.status);

  const data = (await res.json().catch(() => null)) as { token?: unknown } | null;
  if (!data || typeof data.token !== "string" || data.token.length === 0) {
    throw new CsrfTokenError(res.status);
  }

  csrfToken = data.token;
  return csrfToken;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { method = "GET", body, signal } = options;
  const locale = getBrowserLocale();

  const headers: Record<string, string> = {
    "x-roots-locale": locale,
  };
  if (body) headers["Content-Type"] = "application/json";

  if (method !== "GET" && method !== "HEAD") {
    try {
      headers["x-csrf-token"] = await getCsrfToken();
    } catch (err) {
      // Anropare förväntar sig { ok, status, data } och visar felbanner på
      // ok=false. Att kasta här hade blivit ett ohanterat undantag i varje
      // formulär, inklusive kassan.
      const status = err instanceof CsrfTokenError ? err.status || 503 : 503;
      return {
        ok: false,
        status,
        data: {
          error: appCommon[locale].serviceUnavailableShort,
        } as T,
      };
    }
  }

  const base = getBrowserApiBase();
  const res = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await res.json().catch(() => ({} as T));

  if (!res.ok && res.status === 403) {
    csrfToken = null;
  }

  return { ok: res.ok, status: res.status, data };
}
