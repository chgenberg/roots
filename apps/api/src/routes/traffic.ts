/**
 * Anonym besöksstatistik: sidvisningar och klick från publika sidor.
 *
 * Endpointen är öppen och CSRF-undantagen av samma skäl som
 * felrapporteringen: besökaren har ingen session och anropet skickas med
 * sendBeacon, som inte kan bära en token. Skyddet är tak per IP och att
 * innehållet aldrig tolkas. IP-adressen används bara för taket och sparas
 * inte; ingen cookie, session eller användar-id följer med raden.
 */

import { Hono } from "hono";
import { z } from "zod";
import { db } from "@roots/db";
import { trafficEvents } from "@roots/db/schema";
import { checkRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";

const log = childLogger("traffic");

export const trafficTelemetry = new Hono();

const EventSchema = z.object({
  kind: z.enum(["page", "click"]),
  path: z.string().min(1).max(300),
  label: z.string().max(160).optional(),
  href: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

const BOT_UA =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios|go-http|java\//i;

function stripQuery(value: string): string {
  return value.split(/[?#]/)[0] ?? "";
}

function clean(value: string | undefined, max: number): string | null {
  const v = value?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

trafficTelemetry.post("/traffic", async (c) => {
  const ua = c.req.header("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return c.body(null, 204);

  const sessionUser = c.get("sessionUser" as never) as { role?: string } | undefined;
  if (sessionUser?.role === "INTERNAL_ADMIN") return c.body(null, 204);

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";
  const rate = await checkRateLimit(`traffic:${ip}`, 600, 60 * 60);
  if (!rate.allowed) return c.body(null, 204);

  let parsed;
  try {
    parsed = EventSchema.safeParse(await c.req.json());
  } catch {
    return c.body(null, 204);
  }
  if (!parsed.success) return c.body(null, 204);

  const { kind, label, href, source, device } = parsed.data;
  const path = stripQuery(parsed.data.path);
  if (!path.startsWith("/")) return c.body(null, 204);

  const cleanHref =
    href && /^(tel|mailto):/i.test(href) ? clean(href, 300) : clean(href && stripQuery(href), 300);

  try {
    await db.insert(trafficEvents).values({
      kind,
      path,
      label: kind === "click" ? clean(label, 160) : null,
      href: kind === "click" ? cleanHref : null,
      source: kind === "page" ? clean(source, 120) : null,
      device: device ?? null,
    });
  } catch (err) {
    log.warn({ err }, "Failed to save traffic event");
  }
  return c.body(null, 204);
});
