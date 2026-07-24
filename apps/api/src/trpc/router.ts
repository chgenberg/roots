import { router, publicProcedure, middleware } from "./init";
import { authRouter } from "./routers/auth";
import { aiRouter } from "./routers/ai";
import {
  campaignsRouter,
  teamsRouter,
  sellersRouter,
} from "./routers/campaigns";

export { router, publicProcedure, middleware };

/**
 * tRPC-ytan. Produktkatalogen, klubb- och säljflödena ligger i REST-routerna
 * under src/routes/ — det är dem webben faktiskt anropar via /api/v1. De
 * tidigare `products`/`club`/`sales`-routrarna här var stubbar som svarade med
 * hårdkodad eller påhittad data (bl.a. inaktuella priser) och togs bort.
 */
export const appRouter = router({
  auth: authRouter,
  ai: aiRouter,
  campaigns: campaignsRouter,
  teams: teamsRouter,
  sellers: sellersRouter,
});

export type AppRouter = typeof appRouter;
