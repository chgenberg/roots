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
  // Populated by the LEFT JOIN in /v1/portal/pipeline. Nullable because
  // the FK could in theory be unresolved during data-migration windows,
  // and optional so older API responses still validate.
  orgName: z.string().nullable().optional(),
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

// ── /v1/portal/quotes ───────────────────────────────────────────────

export const quoteStatusEnum = z.union([
  z.literal("DRAFT"),
  z.literal("SENT"),
  z.literal("ACCEPTED"),
  z.literal("REJECTED"),
]);

export const portalQuoteSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  // Same nullable-optional treatment as `pipelineDealSchema.orgName` —
  // server-side LEFT JOIN, client renders "—" if it's missing.
  orgName: z.string().nullable().optional(),
  salesRepId: z.string().uuid().nullable().optional(),
  status: quoteStatusEnum,
  totalOre: z.number().int(),
  validUntil: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

export const quotesListResponseSchema = z.object({
  quotes: z.array(portalQuoteSchema),
});
export type QuotesListResponse = z.infer<typeof quotesListResponseSchema>;

// ── POST /v1/portal/quotes (Sprint C — Ny offert) ───────────────────

export const createQuoteRequestSchema = z.object({
  orgId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive().max(10_000),
      })
    )
    .min(1)
    .max(50),
  validUntilDays: z.number().int().min(1).max(365).optional(),
  status: z.union([z.literal("DRAFT"), z.literal("SENT")]).optional(),
});
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>;

export const createQuoteResponseSchema = z.object({
  quote: portalQuoteSchema,
});
export type CreateQuoteResponse = z.infer<typeof createQuoteResponseSchema>;

// ── /v1/portal/members ──────────────────────────────────────────────

export const portalMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string().nullable(),
  role: portalRoleSchema,
  createdAt: z.union([z.string(), z.date()]),
});

export const membersListResponseSchema = z.object({
  members: z.array(portalMemberSchema),
});
export type MembersListResponse = z.infer<typeof membersListResponseSchema>;

// ── POST /v1/portal/members/invite (Sprint C — Bjud in medlem) ──────

export const inviteMemberRequestSchema = z.object({
  email: z.string().email().max(255),
  contactName: z.string().max(255).optional(),
  role: z
    .union([z.literal("CLUB_MEMBER"), z.literal("CLUB_ADMIN")])
    .optional(),
});
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;

export const inviteMemberResponseSchema = z.object({
  member: portalMemberSchema,
});
export type InviteMemberResponse = z.infer<typeof inviteMemberResponseSchema>;

// ── /v1/portal/clubs ────────────────────────────────────────────────

export const portalClubSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string().nullable().optional(),
  orgNumber: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const clubsListResponseSchema = z.object({
  clubs: z.array(portalClubSchema),
});
export type ClubsListResponse = z.infer<typeof clubsListResponseSchema>;
