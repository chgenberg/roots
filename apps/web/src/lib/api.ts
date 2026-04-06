import { getBrowserApiBase } from "./api-base";

let csrfToken: string | null = null;

/** Shared CSRF fetch for any `fetch` that bypasses `apiFetch` (e.g. streaming AI). */
export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const base = getBrowserApiBase();
  const res = await fetch(`${base}/v1/csrf-token`, {
    credentials: "include",
  });
  const data = await res.json();
  csrfToken = data.token;
  return csrfToken!;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";

  if (method !== "GET" && method !== "HEAD") {
    headers["x-csrf-token"] = await getCsrfToken();
  }

  const base = getBrowserApiBase();
  const res = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({} as T));

  if (!res.ok && res.status === 403) {
    csrfToken = null;
  }

  return { ok: res.ok, status: res.status, data };
}
