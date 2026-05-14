import { z } from "zod";

/**
 * Shared response contracts for portal API endpoints.
 *
 * One source of truth for `apps/api` (server) and `apps/web` (client) so the
 * UI cannot drift from the API (MASTER_PLAN T1, synthesis §14.1).
 *
 * Rules:
 *  - Fields are **additive**. Adding a new optional key is non-breaking.
 *  - Existing key renames require keeping the old key one release.
 *  - Numeric monetary values are always in `Ore`-suffixed integer fields;
 *    string aliases (e.g. `revenue: "1 200 kr"`) are formatted server-side.
 */

/**
 * String roles emitted by portal endpoints. Mirrors `users.roleEnum` in DB.
 * Kept as a Zod-only literal union here (no enum import) so the contracts
 * package stays runtime-light and front-end safe.
 */
export const portalRoleSchema = z.union([
  z.literal("PUBLIC"),
  z.literal("CLUB_MEMBER"),
  z.literal("CLUB_ADMIN"),
  z.literal("SALES_REP"),
  z.literal("SALES_ADMIN"),
  z.literal("INTERNAL_ADMIN"),
  z.literal("ASSOCIATION_ADMIN"),
  z.literal("TEAM_LEADER"),
  z.literal("SELLER"),
]);
export type PortalRole = z.infer<typeof portalRoleSchema>;

// ── /v1/portal/dashboard ────────────────────────────────────────────

export const dashboardClubStatsSchema = z.object({
  members: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  revenueOre: z.number().int().nonnegative(),
  revenue: z.string(),
  nextDelivery: z.string().nullable(),
});

export const dashboardSalesStatsSchema = z.object({
  clubs: z.number().int().nonnegative(),
  quotesOut: z.number().int().nonnegative(),
  closedThisMonth: z.number().int().nonnegative(),
  pipelineValueOre: z.number().int().nonnegative(),
  activeClubs: z.number().int().nonnegative(),
  openQuotes: z.number().int().nonnegative(),
  pipelineValue: z.string(),
});

export const dashboardAdminStatsSchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  totalClubs: z.number().int().nonnegative(),
  mrrOre: z.number().int().nonnegative(),
  mrr: z.string(),
  activeClubs: z.number().int().nonnegative(),
  hairConversion: z.string().nullable(),
});

export const dashboardResponseSchema = z.object({
  role: portalRoleSchema,
  isDemo: z.boolean(),
  stats: z.union([
    dashboardClubStatsSchema,
    dashboardSalesStatsSchema,
    dashboardAdminStatsSchema,
  ]),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

// ── /v1/portal/statistics ───────────────────────────────────────────

export const monthBucketSchema = z.object({
  month: z.string(),
  orderCount: z.number().int().nonnegative(),
  revenueOre: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  revenue: z.string(),
});

export const statisticsResponseSchema = z.object({
  monthlyData: z.array(monthBucketSchema),
  isDemo: z.boolean(),
  totals: z.object({
    orders: z.number().int().nonnegative(),
    revenueOre: z.number().int().nonnegative(),
    revenue: z.string(),
  }),
});
export type StatisticsResponse = z.infer<typeof statisticsResponseSchema>;

// ── /v1/portal/pipeline ─────────────────────────────────────────────

export const pipelineStageSchema = z.object({
  stage: z.string(),
  count: z.number().int().nonnegative(),
  totalOre: z.number().int().nonnegative(),
});

export const pipelineDealSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  totalOre: z.number().int().nonnegative(),
  orgId: z.string().uuid(),
  createdAt: z.union([z.string(), z.date()]),
});

export const pipelineResponseSchema = z.object({
  stages: z.array(pipelineStageSchema),
  deals: z.array(pipelineDealSchema),
});
export type PipelineResponse = z.infer<typeof pipelineResponseSchema>;

// ── /v1/portal/income ───────────────────────────────────────────────

export const incomeResponseSchema = z.object({
  months: z.array(
    z.object({
      month: z.string(),
      revenueOre: z.number().int().nonnegative(),
      orderCount: z.number().int().nonnegative(),
    })
  ),
  totalEarnedOre: z.number().int().nonnegative(),
});
export type IncomeResponse = z.infer<typeof incomeResponseSchema>;
