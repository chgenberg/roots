const windows = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;

export function reviewerClientIp(c: {
  req: { header: (n: string) => string | undefined };
}): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return c.req.header("x-real-ip") || "unknown";
}

export function reviewerRateLimited(bucket: string, key: string, max: number): boolean {
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const prev = (windows.get(id) || []).filter((t) => t > cutoff);
  if (prev.length >= max) {
    windows.set(id, prev);
    return true;
  }
  prev.push(now);
  windows.set(id, prev);
  return false;
}
