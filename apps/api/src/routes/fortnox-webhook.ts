import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { childLogger } from "../lib/logger";

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

const processedWebhooks = new Set<string>();

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
  if (eventId && processedWebhooks.has(eventId)) {
    return c.json({ received: true, duplicate: true });
  }

  if (eventId) {
    processedWebhooks.add(eventId);
    // Prevent unbounded growth
    if (processedWebhooks.size > 10000) {
      const first = processedWebhooks.values().next().value;
      if (first) processedWebhooks.delete(first);
    }
  }

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
