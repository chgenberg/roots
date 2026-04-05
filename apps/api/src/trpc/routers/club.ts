import { z } from "zod";
import { router, publicProcedure } from "../init";
import { isClubUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { CreateOrderSchema } from "@roots/contracts";

const clubProcedure = publicProcedure.use(isClubUser);

export const clubRouter = router({
  me: clubProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.userId,
      orgId: ctx.orgId,
      role: ctx.role,
    };
  }),

  orders: clubProcedure.query(async ({ ctx }) => {
    // Will query DB in full implementation
    return [];
  }),

  createOrder: clubProcedure
    .input(CreateOrderSchema)
    .use(idempotent)
    .mutation(async ({ ctx, input }) => {
      // Will create order in DB with idempotency check
      return {
        id: crypto.randomUUID(),
        orgId: ctx.orgId,
        status: "PENDING" as const,
        lines: input.lines,
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date().toISOString(),
      };
    }),

  dashboard: clubProcedure.query(async ({ ctx }) => {
    return {
      recentOrders: [],
      totalOrders: 0,
      orgName: "Loading...",
    };
  }),
});
