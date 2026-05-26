import { redis } from "./redis";
import { childLogger } from "./logger";

const log = childLogger("webhook-dedup");

/**
 * MASTERPLAN_01 KC8.3: persistera webhook-dedup utanför process-minnet.
 *
 * Tidigare hade fortnox-webhook och liknande integrationer var sin
 * `Set<string>()` in-memory. Det betyder:
 *
 *   - Restart → tappar hela dedup-historiken → Fortnox kan
 *     re-pusha samma faktura-paid-event efter en deploy och vi
 *     dubbel-processar (riskerar dubbel-utbetalning).
 *   - Multi-instance (Railway scaling, blue/green) → varje instans
 *     ser bara sin egen historik, dedup blir effektivt en no-op.
 *
 * Strategi:
 *   - Primärt: Redis `SET key NX EX ttl`. Atomisk, race-safe.
 *   - Fallback: in-memory om Redis är nere. I prod är detta sämre
 *     än Redis men bättre än att webhooks failar — vi tillåter
 *     event:et att processas (returnerar `seenBefore=false`) och
 *     loggar en `warn` så ops ser. Multi-instance race är fortfarande
 *     bättre än ingen dedup alls.
 *
 * Användning:
 *   const seen = await wasWebhookEventSeen("fortnox", eventId, 86400);
 *   if (seen) return c.json({ received: true, duplicate: true });
 */
const PREFIX = "wh:";
const DEFAULT_TTL = 60 * 60 * 24; // 24h

const memoryFallback = new Map<string, number>();

function gcMemoryFallback() {
  if (memoryFallback.size < 5000) return;
  const now = Date.now();
  for (const [key, expiresAt] of memoryFallback) {
    if (expiresAt < now) memoryFallback.delete(key);
  }
  if (memoryFallback.size > 5000) {
    const trimCount = memoryFallback.size - 5000;
    const iter = memoryFallback.keys();
    for (let i = 0; i < trimCount; i++) {
      const k = iter.next().value;
      if (k) memoryFallback.delete(k);
    }
  }
}

/**
 * Returns `true` if `(scope, eventId)` has been observed within the
 * last `ttlSeconds`. Returns `false` and marks it as seen otherwise.
 *
 * `eventId` MUST be a stable identifier supplied by the provider
 * (Fortnox `eventId`, Klarna webhook id, etc). If the provider doesn't
 * supply one, dedup is impossible — caller should just process the
 * event blindly (never call this with a synthesized random id).
 */
export async function wasWebhookEventSeen(
  scope: string,
  eventId: string,
  ttlSeconds = DEFAULT_TTL
): Promise<boolean> {
  const key = `${PREFIX}${scope}:${eventId}`;
  try {
    // SET key value NX EX ttl returns "OK" if the key was set (= first
    // time we see it) or null if it already existed.
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === null;
  } catch (err) {
    // Redis down → fall back to in-memory. Better than blocking
    // legit webhook traffic on a Redis hiccup.
    log.warn(
      { err, scope, eventId: eventId.slice(0, 32) },
      "redis dedup failed — falling back to in-memory"
    );
    gcMemoryFallback();
    const expiresAt = memoryFallback.get(key);
    const now = Date.now();
    if (expiresAt && expiresAt > now) return true;
    memoryFallback.set(key, now + ttlSeconds * 1000);
    return false;
  }
}

/**
 * Pre-push fix 2026-05-26 (counter-finding för P3.43): om webhook-
 * handlern crashade efter att vi markerat dedup-keyen ramlade vi in
 * i ett tillstånd där alla framtida retries från providern (Klarna,
 * Fortnox) klassades som duplicate utan att vi någonsin lyckats
 * processa eventet. Fix:en är att handlern släpper keyen explicit
 * i catch-blocket innan den returnerar 5xx, så att providerns
 * nästa retry kan göra ett nytt försök.
 *
 * `clearWebhookEventSeen` är medvetet best-effort — den loggar men
 * vägrar inte att gå vidare om Redis är nere (samma falback-filosofi
 * som `wasWebhookEventSeen`).
 */
export async function clearWebhookEventSeen(
  scope: string,
  eventId: string,
): Promise<void> {
  const key = `${PREFIX}${scope}:${eventId}`;
  try {
    await redis.del(key);
  } catch (err) {
    log.warn(
      { err, scope, eventId: eventId.slice(0, 32) },
      "redis dedup release failed — key kommer att expira automatiskt"
    );
  }
  memoryFallback.delete(key);
}

/** Test-only: wipe the in-memory fallback so suites stay isolated. */
export function __resetWebhookDedupForTests(): void {
  memoryFallback.clear();
}
