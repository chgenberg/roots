import { randomUUID } from "node:crypto";
import { redis } from "./redis";

/**
 * Ett enkelt lås i Redis för saker som inte får köras två gånger samtidigt
 * (en återbetalning på samma order, två sändningar till lagret).
 *
 * Låset har en egen nyckel per innehavare och släpps bara av den som tog
 * det. Annars kunde ett anrop som levt längre än låsets tid radera nästa
 * anrops lås när det till slut blev klart.
 */

export type LockResult =
  | { status: "acquired"; token: string }
  /** Någon annan håller låset. */
  | { status: "busy" }
  /** Redis svarar inte. Anroparen avgör om det är säkert att fortsätta. */
  | { status: "unavailable"; error: unknown };

export async function acquireLock(key: string, ttlSeconds: number): Promise<LockResult> {
  const token = randomUUID();
  try {
    const ok = await redis.set(key, token, "EX", ttlSeconds, "NX");
    return ok === "OK" ? { status: "acquired", token } : { status: "busy" };
  } catch (error) {
    return { status: "unavailable", error };
  }
}

const RELEASE_IF_OWNER =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export async function releaseLock(key: string, token: string): Promise<void> {
  await redis.eval(RELEASE_IF_OWNER, 1, key, token).catch(() => {});
}
