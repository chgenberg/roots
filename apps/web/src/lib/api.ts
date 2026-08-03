import { getBrowserApiBase } from "./api-base";

let csrfToken: string | null = null;

export class CsrfTokenError extends Error {
  constructor(readonly status: number) {
    super("Tjänsten är tillfälligt otillgänglig. Försök igen om en stund.");
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
    res = await fetch(`${base}/v1/csrf-token`, { credentials: "include" });
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

  const headers: Record<string, string> = {};
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
        data: { error: "Tjänsten är tillfälligt otillgänglig" } as T,
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
