import { Hono, type Context } from "hono";
import { getBankIdAdapter, bankIdMode } from "../lib/bankid/adapter";
import { childLogger } from "../lib/logger";
import {
  bankidStartRateLimit,
  bankidCollectRateLimit,
} from "../lib/rate-limit";

const log = childLogger("bankid");

export const bankid = new Hono();

// P3.25 (audit 2026-05-26): tidigare hade /auth/start, /collect, /cancel
// inga rate limits. Pre-push fix 2026-05-26: skilj på start/cancel
// (sällsynta, dyra) och collect (frekvent polling 2s-intervall under
// 180s). Annars nås limiten efter 60s legitim BankID-användning.
async function enforceBankIdRateLimit(
  c: Context,
  kind: "start" | "collect",
): Promise<Response | null> {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = kind === "collect"
    ? await bankidCollectRateLimit(ip)
    : await bankidStartRateLimit(ip);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.resetInSeconds));
    return c.json(
      { error: "För många BankID-försök. Försök igen om en stund." },
      429
    );
  }
  return null;
}

bankid.get("/status", async (c) => {
  // Rapportera vilken adapter som faktiskt är laddad. Att härleda läget ur
  // BANKID_PFX_PATH ljög när certifikatet fanns men adaptern inte kunde laddas.
  const mode = bankIdMode();
  return c.json({ enabled: mode !== "mock", mode });
});

bankid.post("/auth/start", async (c) => {
  const limited = await enforceBankIdRateLimit(c, "start");
  if (limited) return limited;

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const adapter = getBankIdAdapter();
    const result = await adapter.startAuth(ip);

    return c.json({
      orderRef: result.orderRef,
      autoStartToken: result.autoStartToken,
      qrStartToken: result.qrStartToken,
    });
  } catch (err) {
    log.error({ err }, "auth/start failed");
    return c.json({ error: "Kunde inte starta BankID-identifiering" }, 500);
  }
});

bankid.post("/auth/collect", async (c) => {
  const limited = await enforceBankIdRateLimit(c, "collect");
  if (limited) return limited;

  let body: { orderRef: string };
  try {
    body = await c.req.json<{ orderRef: string }>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  if (!body.orderRef) {
    return c.json({ error: "orderRef krävs" }, 400);
  }

  try {
    const adapter = getBankIdAdapter();
    const result = await adapter.collect(body.orderRef);

    return c.json(result);
  } catch (err) {
    log.error({ err }, "auth/collect failed");
    return c.json({ error: "BankID-identifiering misslyckades" }, 500);
  }
});

bankid.post("/auth/cancel", async (c) => {
  const limited = await enforceBankIdRateLimit(c, "start");
  if (limited) return limited;

  let body: { orderRef: string };
  try {
    body = await c.req.json<{ orderRef: string }>();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }

  if (!body.orderRef) {
    return c.json({ error: "orderRef krävs" }, 400);
  }

  try {
    const adapter = getBankIdAdapter();
    await adapter.cancel(body.orderRef);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: "Cancel misslyckades" });
  }
});
