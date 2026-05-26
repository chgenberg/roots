import { Hono } from "hono";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { childLogger } from "../lib/logger";
import { wasWebhookEventSeen } from "../lib/webhook-dedup";

const log = childLogger("fortnox-webhook");

export const fortnoxWebhook = new Hono();

const FORTNOX_WEBHOOK_SECRET = process.env.FORTNOX_WEBHOOK_SECRET || "";

function verifySignature(payload: string, signature: string): boolean {
  if (!FORTNOX_WEBHOOK_SECRET) return false;

  const expected = createHmac("sha256", FORTNOX_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

fortnoxWebhook.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-fortnox-signature") || "";

  if (!FORTNOX_WEBHOOK_SECRET) {
    log.warn("FORTNOX_WEBHOOK_SECRET not configured — rejecting request");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  if (!verifySignature(rawBody, signature)) {
    log.warn("Invalid signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const eventId = body.eventId as string | undefined;
  // MASTERPLAN_01 KC8.3 + P3.47 (audit 2026-05-26): Redis-backed dedup
  // istället för en process-local Set. Tidigare hoppade vi över dedup:en
  // helt om eventId saknades — då skulle Fortnox kunna re-pusha samma
  // event efter byte av payload-format eller en proxy-replay och vi
  // skulle processa det flera gånger. Falla tillbaka på SHA256(body) +
  // signaturen så vi alltid har en stabil dedup-nyckel.
  const dedupId =
    eventId ||
    `body:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}` +
      `:${signature.slice(0, 16)}`;
  const seen = await wasWebhookEventSeen("fortnox", dedupId);
  if (seen) {
    log.info({ eventId, dedupId }, "Duplicate Fortnox webhook — skipping");
    return c.json({ received: true, duplicate: true });
  }
  // Pre-push 2026-05-26: när vi börjar göra verkliga DB-mutations
  // (invoice-paid, invoice-cancelled) MÅSTE vi följa samma pattern
  // som checkout.ts — wrap processing i try/catch och anropa
  // clearWebhookEventSeen("fortnox", dedupId) i catch innan vi
  // returnerar 5xx. Annars fastnar dedup-keyen i 24h och Fortnox-
  // retries klassas som dups.

  const eventType = body.event as string | undefined;
  log.info({ eventType, eventId }, "Received event");

  switch (eventType) {
    case "invoice-paid":
    case "invoice-cancelled":
      // Will update order.invoiceStatus when DB is connected
      log.info({ eventType }, "Would update invoice status");
      break;
    default:
      log.info({ eventType }, "Unhandled event type");
  }

  return c.json({ received: true });
});
