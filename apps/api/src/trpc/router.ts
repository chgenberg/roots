import { router, publicProcedure, middleware } from "./init";
import { productsRouter } from "./routers/products";
import { authRouter } from "./routers/auth";
import { clubRouter } from "./routers/club";
import { salesRouter } from "./routers/sales";
import { aiRouter } from "./routers/ai";
import {
  campaignsRouter,
  teamsRouter,
  sellersRouter,
} from "./routers/campaigns";

export { router, publicProcedure, middleware };

export const appRouter = router({
  products: productsRouter,
  auth: authRouter,
  club: clubRouter,
  sales: salesRouter,
  ai: aiRouter,
  campaigns: campaignsRouter,
  teams: teamsRouter,
  sellers: sellersRouter,
});

export type AppRouter = typeof appRouter;
