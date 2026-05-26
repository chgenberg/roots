import { apiFetch } from "./api";

/**
 * Minimal subset of a Zod schema's runtime surface that we actually need.
 * Avoids forcing `apps/web` to depend on `zod` directly while still
 * benefitting from `@roots/contracts` schemas at the call sites.
 */
interface ParseableSchema<T> {
  safeParse(
    value: unknown
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: unknown } };
}

/**
 * Typed fetch wrapper for `/v1/portal/*` endpoints.
 *
 * If a `schema` from `@roots/contracts` is passed, the response is
 * runtime-validated. Drift between the API and the UI surfaces as a
 * thrown Error instead of silently rendering empty/undefined fields
 * (the failure mode documented in the connection audit P0 #5 / P1 #12).
 */
export async function portalFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal; schema: ParseableSchema<T> }
): Promise<T>;
export async function portalFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; signal?: AbortSignal }
): Promise<T>;
export async function portalFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    schema?: ParseableSchema<T>;
  } = {}
): Promise<T> {
  const { schema, ...fetchOptions } = options;
  const { ok, data, status } = await apiFetch<T & { error?: string }>(
    `/v1/portal${path}`,
    fetchOptions
  );

  if (!ok) {
    throw new Error((data as { error?: string })?.error || `API error ${status}`);
  }

  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error("portalFetch schema drift", {
        path,
        issues: parsed.error.issues,
      });
      throw new Error(`Unexpected response shape from ${path}`);
    }
    return parsed.data;
  }

  return data as T;
}
