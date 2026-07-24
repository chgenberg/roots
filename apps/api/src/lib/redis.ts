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

/**
 * Ansluter Redis innan vi tar emot trafik.
 *
 * `lazyConnect: true` tillsammans med `enableOfflineQueue: false` gör att det
 * *första* kommandot efter start alltid avvisas: lazyConnect gör att socketen
 * öppnas först när ett kommando skickas, och den avstängda offline-kön vägrar
 * köa kommandot under handskakningen. Felet blev "Stream isn't writeable and
 * enableOfflineQueue options is false".
 *
 * Effekten i drift var att `GET /readyz` svarade 503 direkt efter en deploy och
 * `ok` vid nästa anrop. Med healthcheck mot /readyz hade den första proben
 * kunnat fälla en fullt fungerande deploy.
 *
 * Offline-kön lämnas avstängd med flit — när Redis verkligen är nere ska
 * anrop faila snabbt i stället för att hopa sig. Vi tar bara bort
 * uppstartsfönstret.
 */
export async function connectRedis(): Promise<void> {
  if (REDIS_DISABLED) return;
  // "wait" = ansluter, "ready" = redan klar. Båda innebär att vi inte ska
  // anropa connect() igen (det kastar).
  if (redis.status !== "wait") return;
  try {
    await redis.connect();
    log.info("redis ansluten");
  } catch (err) {
    // Ingen anledning att fälla starten: retryStrategy fortsätter försöka och
    // /readyz rapporterar läget så länge det inte gått vägen.
    log.warn({ err }, "kunde inte ansluta Redis vid start — försöker vidare");
  }
}
