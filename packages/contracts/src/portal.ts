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

// KPI block populates the four cards at the top of /portal/statistik.
// Every numeric field is computed over the last 30 days and (where it
// makes sense) compared to the preceding 30 days for a percent delta.
// `prev*Percent` is nullable because the previous window can be zero
// (e.g. brand-new orgs) — the UI then hides the delta badge instead of
// rendering "Infinity %".
export const statisticsKpisSchema = z.object({
  totalRevenueOre: z.number().int().nonnegative(),
  totalRevenue: z.string(),
  avgOrderValueOre: z.number().int().nonnegative(),
  avgOrderValue: z.string(),
  totalOrders: z.number().int().nonnegative(),
  newMembersThisPeriod: z.number().int().nonnegative(),
  activeMembersThisPeriod: z.number().int().nonnegative(),
  prevPeriodRevenuePercent: z.number().nullable(),
  prevPeriodOrdersPercent: z.number().nullable(),
  prevPeriodMembersPercent: z.number().nullable(),
});

export const topProductSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  soldUnits: z.number().int().nonnegative(),
  revenueOre: z.number().int().nonnegative(),
  revenue: z.string(),
  sharePercent: z.number().min(0).max(100),
});

export const statisticsResponseSchema = z.object({
  monthlyData: z.array(monthBucketSchema),
  isDemo: z.boolean(),
  totals: z.object({
    orders: z.number().int().nonnegative(),
    revenueOre: z.number().int().nonnegative(),
    revenue: z.string(),
  }),
  // Optional + default so older clients/snapshots keep validating while
  // the API rolls out the additive payload. Once all consumers are on
  // the new shape these can be tightened to required.
  kpis: statisticsKpisSchema.optional(),
  topProducts: z.array(topProductSchema).default([]),
});
export type StatisticsResponse = z.infer<typeof statisticsResponseSchema>;
export type StatisticsKpis = z.infer<typeof statisticsKpisSchema>;
export type TopProduct = z.infer<typeof topProductSchema>;

// ── /v1/portal/pipeline ─────────────────────────────────────────────

export const pipelineStageSchema = z.object({
  stage: z.string(),
  count: z.number().int().nonnegative(),
  totalOre: z.number().int().nonnegative(),
});

// A pipeline card is one of two different things, and the board has to
// know which: a LEAD is an `organizations` row with no quote yet, a QUOTE
// is a `quotes` row. Moving between them is not a status update but a
// create/delete, so the UI must not treat them the same.
export const pipelineDealKindEnum = z.union([
  z.literal("LEAD"),
  z.literal("QUOTE"),
]);
export type PipelineDealKind = z.infer<typeof pipelineDealKindEnum>;

export const pipelineDealSchema = z.object({
  id: z.string().uuid(),
  // Optional so a stale API build (pre-kind) still validates; the client
  // falls back to deriving it from `status === "LEAD"`.
  kind: pipelineDealKindEnum.optional(),
  status: z.string(),
  totalOre: z.number().int().nonnegative(),
  orgId: z.string().uuid(),
  // Populated by the LEFT JOIN in /v1/portal/pipeline. Nullable because
  // the FK could in theory be unresolved during data-migration windows,
  // and optional so older API responses still validate.
  orgName: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  // When the card entered its current stage (quotes.updatedAt). The age
  // badge counts from this, not from createdAt.
  stageSince: z.union([z.string(), z.date()]).nullable().optional(),
  potentialScore: z.number().int().nullable().optional(),
  leadSource: z.string().nullable().optional(),
});
export type PipelineDeal = z.infer<typeof pipelineDealSchema>;

export const pipelineResponseSchema = z.object({
  stages: z.array(pipelineStageSchema),
  deals: z.array(pipelineDealSchema),
  // True for demo logins, which may read the board but not move deals
  // (they share the seeded demo data with everyone else). The server owns
  // that decision, so it tells the client instead of letting it offer a
  // drag gesture that is guaranteed to come back as a 403.
  readOnly: z.boolean().optional(),
});
export type PipelineResponse = z.infer<typeof pipelineResponseSchema>;

// ── GET /v1/portal/pipeline/deals/:kind/:id ─────────────────────────
//
// Backs the pipeline detail dialog. One endpoint for both card kinds so
// the client has a single fetch path; `kind` discriminates the payload.
export const pipelineDealLineSchema = z.object({
  productName: z.string(),
  sku: z.string().nullable().optional(),
  qty: z.number().int(),
  unitPriceOre: z.number().int(),
  lineTotalOre: z.number().int(),
});

export const pipelineDealDetailSchema = z.object({
  kind: pipelineDealKindEnum,
  id: z.string().uuid(),
  status: z.string(),
  totalOre: z.number().int(),
  createdAt: z.union([z.string(), z.date()]),
  stageSince: z.union([z.string(), z.date()]).nullable().optional(),
  validUntil: z.union([z.string(), z.date()]).nullable().optional(),
  salesRepName: z.string().nullable().optional(),
  org: z.object({
    id: z.string().uuid(),
    name: z.string(),
    orgNumber: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    sportType: z.string().nullable().optional(),
    municipality: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    crmStatus: z.string().nullable().optional(),
    leadSource: z.string().nullable().optional(),
    potentialScore: z.number().int().nullable().optional(),
    membersCount: z.number().int().nonnegative(),
  }),
  lines: z.array(pipelineDealLineSchema),
  // Other quotes for the same club, so the rep sees history without
  // leaving the dialog.
  otherQuotes: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
      totalOre: z.number().int(),
      createdAt: z.union([z.string(), z.date()]),
    })
  ),
});
export type PipelineDealDetail = z.infer<typeof pipelineDealDetailSchema>;

export const pipelineDealDetailResponseSchema = z.object({
  deal: pipelineDealDetailSchema,
});
export type PipelineDealDetailResponse = z.infer<
  typeof pipelineDealDetailResponseSchema
>;

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

// ── PATCH /v1/portal/quotes/:id/status ──────────────────────────────
//
// Powers drag-and-drop between the four quote stages on the pipeline
// board. LEAD is deliberately absent: a card can only leave LEAD by a
// quote being created for it, never by a status write.
export const updateQuoteStatusRequestSchema = z.object({
  status: quoteStatusEnum,
});
export type UpdateQuoteStatusRequest = z.infer<
  typeof updateQuoteStatusRequestSchema
>;

export const updateQuoteStatusResponseSchema = z.object({
  quote: z.object({
    id: z.string().uuid(),
    status: quoteStatusEnum,
    totalOre: z.number().int(),
    orgId: z.string().uuid(),
    updatedAt: z.union([z.string(), z.date()]),
  }),
  // True when accepting the quote also promoted the club from LEAD to
  // CUSTOMER, so the UI can say so instead of silently changing CRM state.
  orgPromotedToCustomer: z.boolean().default(false),
});
export type UpdateQuoteStatusResponse = z.infer<
  typeof updateQuoteStatusResponseSchema
>;

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
  // Sprint E12: real aggregates surfaced by /v1/portal/clubs so the
  // SALES_REP / INTERNAL_ADMIN klubbar-table stops showing "—" for
  // members, last order date and revenue. All optional + nullable so
  // older clients keep validating.
  membersCount: z.number().int().nonnegative().optional(),
  lastOrderAt: z.union([z.string(), z.date()]).nullable().optional(),
  revenueOre: z.number().int().nonnegative().optional(),
  crmStatus: z.string().nullable().optional(),
});

export const clubsListResponseSchema = z.object({
  clubs: z.array(portalClubSchema),
});
export type ClubsListResponse = z.infer<typeof clubsListResponseSchema>;
