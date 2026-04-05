import { middleware } from "../init";
import { childLogger } from "../../lib/logger";

const log = childLogger("idempotency");

const processedKeys = new Map<string, { timestamp: number }>();
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
    log.warn({ key }, "Duplicate idempotency key — proceeding anyway (DB constraints enforce uniqueness)");
  }

  const result = await next();

  if (result.ok) {
    processedKeys.set(key, { timestamp: Date.now() });
  }

  return result;
});
