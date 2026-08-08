import { Hono, type Context } from "hono";
import { getBankIdAdapter, bankIdMode } from "../lib/bankid/adapter";
import { childLogger } from "../lib/logger";
import {
  bankidStartRateLimit,
  bankidCollectRateLimit,
} from "../lib/rate-limit";
import { resolveUiLocale, uiError } from "../lib/ui-locale";

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
      { error: uiError(resolveUiLocale(c), "bankIdRateLimited") },
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

  const locale = resolveUiLocale(c);
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
    return c.json({ error: uiError(locale, "bankIdStartFailed") }, 500);
  }
});

bankid.post("/auth/collect", async (c) => {
  const limited = await enforceBankIdRateLimit(c, "collect");
  if (limited) return limited;

  let body: { orderRef: string; locale?: unknown };
  try {
    body = await c.req.json<{ orderRef: string; locale?: unknown }>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);
  if (!body.orderRef) {
    return c.json({ error: uiError(locale, "orderRefRequired") }, 400);
  }

  try {
    const adapter = getBankIdAdapter();
    const result = await adapter.collect(body.orderRef);

    return c.json(result);
  } catch (err) {
    log.error({ err }, "auth/collect failed");
    return c.json({ error: uiError(locale, "bankIdFailed") }, 500);
  }
});

bankid.post("/auth/cancel", async (c) => {
  const limited = await enforceBankIdRateLimit(c, "start");
  if (limited) return limited;

  let body: { orderRef: string; locale?: unknown };
  try {
    body = await c.req.json<{ orderRef: string; locale?: unknown }>();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);
  if (!body.orderRef) {
    return c.json({ error: uiError(locale, "orderRefRequired") }, 400);
  }

  try {
    const adapter = getBankIdAdapter();
    await adapter.cancel(body.orderRef);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: uiError(locale, "bankIdCancelFailed") });
  }
});
