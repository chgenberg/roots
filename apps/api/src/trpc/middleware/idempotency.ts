import { middleware } from "../init";

const processedKeys = new Map<string, { result: unknown; timestamp: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export const idempotent = middleware(async ({ next, getRawInput }) => {
  const rawInput = await getRawInput();
  const input = rawInput as Record<string, unknown> | undefined;
  const key = input?.idempotencyKey as string | undefined;

  if (!key) {
    return next();
  }

  const existing = processedKeys.get(key);
  if (existing && Date.now() - existing.timestamp < TTL_MS) {
    return { ok: true as const, data: existing.result };
  }

  const result = await next();

  if (result.ok) {
    processedKeys.set(key, { result: result.data, timestamp: Date.now() });
  }

  return result;
});
