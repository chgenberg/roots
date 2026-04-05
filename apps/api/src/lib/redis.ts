import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_DISABLED = process.env.REDIS_DISABLED === "true";

function createRedis() {
  if (REDIS_DISABLED) {
    const noop = new Redis({ lazyConnect: true, enableOfflineQueue: false });
    noop.disconnect();
    return noop;
  }

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: () => null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("error", () => {});
  return client;
}

export const redis = createRedis();
