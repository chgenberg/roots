import Redis from "ioredis";
import { childLogger } from "./logger";

const log = childLogger("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_DISABLED = process.env.REDIS_DISABLED === "true";

function createRedis() {
  if (REDIS_DISABLED) {
    const noop = new Redis({ lazyConnect: true, enableOfflineQueue: false });
    noop.disconnect();
    return noop;
  }

  // Connection-audit P1 #11: previously `retryStrategy: () => null` meant a
  // single network blip permanently disconnected the client until the API
  // process restarted, and the error handler was a silent no-op. We now
  // back off exponentially (capped at 5s) and emit a warn-level log so
  // operators see when Redis is misbehaving.
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: (times) => Math.min(50 * Math.pow(2, times), 5000),
    reconnectOnError: () => true,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("error", (err) => {
    log.warn({ err: err.message }, "redis error");
  });
  client.on("reconnecting", (delay: number) => {
    log.warn({ delay }, "redis reconnecting");
  });
  return client;
}

export const redis = createRedis();
