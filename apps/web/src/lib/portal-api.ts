import { apiFetch } from "./api";

export async function portalFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { ok, data, status } = await apiFetch<T & { error?: string }>(
    `/v1/portal${path}`,
    options
  );

  if (!ok) {
    throw new Error((data as { error?: string })?.error || `API error ${status}`);
  }

  return data as T;
}
