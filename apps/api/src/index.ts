import { serve } from "@hono/node-server";
import { app } from "./app";
import { childLogger } from "./lib/logger";
import { initBankIdAdapter } from "./lib/bankid/adapter";

const log = childLogger("server");

const port = Number(process.env.PORT) || 4000;

async function start() {
  await initBankIdAdapter();

  serve({ fetch: app.fetch, port }, (info) => {
    log.info({ port: info.port }, `Roots API running on http://localhost:${info.port}`);
  });
}

start().catch((err) => {
  log.error({ err }, "Failed to start server");
  process.exit(1);
});
