import { z } from "zod";
import { router, publicProcedure } from "../init";
import { isSalesUser, isAdmin } from "../middleware/auth";

const salesProcedure = publicProcedure.use(isSalesUser);
const adminProcedure = publicProcedure.use(isAdmin);

export const salesRouter = router({
  dashboard: salesProcedure.query(async ({ ctx }) => {
    return {
      recentQuotes: [],
      recentOrders: [],
      totalClubs: 0,
      pipelineValue: 0,
    };
  }),

  quotes: router({
    list: salesProcedure.query(async ({ ctx }) => {
      return [];
    }),

    create: salesProcedure
      .input(
        z.object({
          orgId: z.string().uuid(),
          lines: z.array(
            z.object({
              productId: z.string().uuid(),
              qty: z.number().int().positive(),
              unitPriceOre: z.number().int().positive(),
            })
          ),
          validUntil: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const totalOre = input.lines.reduce(
          (sum, l) => sum + l.qty * l.unitPriceOre,
          0
        );
        return {
          id: crypto.randomUUID(),
          orgId: input.orgId,
          salesRepId: ctx.userId,
          status: "DRAFT" as const,
          totalOre,
          createdAt: new Date().toISOString(),
        };
      }),

    convertToOrder: salesProcedure
      .input(z.object({ quoteId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return {
          orderId: crypto.randomUUID(),
          quoteId: input.quoteId,
          status: "PENDING" as const,
        };
      }),
  }),

  orders: router({
    list: salesProcedure.query(async () => {
      return [];
    }),

    updateStatus: salesProcedure
      .input(
        z.object({
          orderId: z.string().uuid(),
          status: z.enum([
            "PENDING",
            "CONFIRMED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
          ]),
        })
      )
      .mutation(async ({ input }) => {
        return { id: input.orderId, status: input.status };
      }),
  }),

  customers: router({
    list: salesProcedure.query(async () => {
      return [];
    }),
  }),

  admin: router({
    users: adminProcedure.query(async () => {
      return [];
    }),

    pendingRegistrations: adminProcedure.query(async () => {
      return [];
    }),

    approveRegistration: adminProcedure
      .input(z.object({ orgId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        return { orgId: input.orgId, approved: true };
      }),
  }),
});
