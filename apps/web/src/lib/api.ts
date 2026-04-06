const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const res = await fetch(`${API_URL}/v1/csrf-token`, {
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

  const res = await fetch(`${API_URL}${path}`, {
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
