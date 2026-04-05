import { Hono } from "hono";
import { getBankIdAdapter } from "../lib/bankid/adapter";
import { childLogger } from "../lib/logger";

const log = childLogger("bankid");

export const bankid = new Hono();

bankid.get("/status", async (c) => {
  const hasCert = Boolean(process.env.BANKID_PFX_PATH);
  return c.json({
    enabled: hasCert,
    mode: hasCert
      ? process.env.BANKID_ENV === "production"
        ? "production"
        : "test"
      : "mock",
  });
});

bankid.post("/auth/start", async (c) => {
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
  } catch (err: any) {
    log.error({ err }, "auth/start failed");
    return c.json({ error: "Kunde inte starta BankID-identifiering" }, 500);
  }
});

bankid.post("/auth/collect", async (c) => {
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
  } catch (err: any) {
    log.error({ err }, "auth/collect failed");
    return c.json({ error: "BankID-identifiering misslyckades" }, 500);
  }
});

bankid.post("/auth/cancel", async (c) => {
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
