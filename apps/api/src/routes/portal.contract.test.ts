import { describe, expect, it } from "vitest";
import {
  dashboardResponseSchema,
  pipelineResponseSchema,
  statisticsResponseSchema,
  incomeResponseSchema,
} from "@roots/contracts";

/**
 * Locks the shape returned by `apps/api/src/routes/portal.ts` against the
 * shared Zod contracts in `@roots/contracts`. If a future PR drifts the
 * response (renames a field, changes a type), these tests fail BEFORE the
 * UI silently shows 0/demo (MASTER_PLAN T1, synthesis §14.1, §16 Typ B).
 *
 * These fixtures intentionally match what the route emits today.
 */

describe("portal contracts — dashboard", () => {
  it("accepts CLUB stats", () => {
    expect(() =>
      dashboardResponseSchema.parse({
        role: "CLUB_ADMIN",
        isDemo: false,
        stats: {
          members: 12,
          orders: 4,
          revenueOre: 12345,
          revenue: "123 kr",
          nextDelivery: null,
        },
      })
    ).not.toThrow();
  });

  it("accepts SALES stats", () => {
    expect(() =>
      dashboardResponseSchema.parse({
        role: "SALES_REP",
        isDemo: true,
        stats: {
          clubs: 0,
          quotesOut: 0,
          closedThisMonth: 0,
          pipelineValueOre: 0,
          activeClubs: 0,
          openQuotes: 0,
          pipelineValue: "0 kr",
        },
      })
    ).not.toThrow();
  });

  it("accepts INTERNAL_ADMIN stats", () => {
    expect(() =>
      dashboardResponseSchema.parse({
        role: "INTERNAL_ADMIN",
        isDemo: false,
        stats: {
          totalOrders: 100,
          totalClubs: 25,
          mrrOre: 9_900_000,
          mrr: "99 000 kr",
          activeClubs: 25,
          hairConversion: null,
        },
      })
    ).not.toThrow();
  });

  it("rejects missing isDemo (catches drift)", () => {
    expect(() =>
      dashboardResponseSchema.parse({
        role: "INTERNAL_ADMIN",
        stats: {
          totalOrders: 0,
          totalClubs: 0,
          mrrOre: 0,
          mrr: "0 kr",
          activeClubs: 0,
          hairConversion: null,
        },
      })
    ).toThrow();
  });
});

describe("portal contracts — statistics", () => {
  it("accepts empty bucket list", () => {
    expect(() =>
      statisticsResponseSchema.parse({
        monthlyData: [],
        isDemo: true,
        totals: { orders: 0, revenueOre: 0, revenue: "0 kr" },
      })
    ).not.toThrow();
  });

  it("accepts populated buckets with aliases", () => {
    expect(() =>
      statisticsResponseSchema.parse({
        monthlyData: [
          {
            month: "2026-05",
            orderCount: 3,
            revenueOre: 1500,
            orders: 3,
            revenue: "15 kr",
          },
        ],
        isDemo: false,
        totals: { orders: 3, revenueOre: 1500, revenue: "15 kr" },
      })
    ).not.toThrow();
  });
});

describe("portal contracts — pipeline", () => {
  it("accepts both stages and deals", () => {
    expect(() =>
      pipelineResponseSchema.parse({
        stages: [{ stage: "DRAFT", count: 1, totalOre: 100 }],
        deals: [
          {
            id: "00000000-0000-0000-0000-000000000001",
            status: "DRAFT",
            totalOre: 100,
            orgId: "00000000-0000-0000-0000-000000000002",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).not.toThrow();
  });
});

describe("portal contracts — income", () => {
  it("accepts months + totalEarnedOre", () => {
    expect(() =>
      incomeResponseSchema.parse({
        months: [{ month: "2026-04", revenueOre: 0, orderCount: 0 }],
        totalEarnedOre: 0,
      })
    ).not.toThrow();
  });
});
