import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * API SNAPSHOT TESTS — shop endpoints (synthesis §16 Typ B/C, §7 "rör inte").
 *
 * Shop is the **highest-risk surface**: a regression here breaks live seller
 * pages and customer checkout. These snapshots lock the exact JSON that
 * the public shop page consumes today so any future change shows up as a
 * diff in CI.
 */

const { mockDb, dbHandle } = vi.hoisted(() => {
  const state: { queue: unknown[]; idx: number } = { queue: [], idx: 0 };

  const dequeue = (): unknown => {
    const v = state.idx < state.queue.length ? state.queue[state.idx] : [];
    state.idx += 1;
    return v;
  };

  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: any, reject?: any) => {
            try {
              return Promise.resolve(dequeue()).then(resolve, reject);
            } catch (err) {
              return Promise.reject(err).then(resolve, reject);
            }
          };
        }
        if (prop === "returning") {
          return () => chain;
        }
        return (..._args: any[]) => chain;
      },
    }
  );

  const db = {
    select: (..._args: any[]) => chain,
    insert: (..._args: any[]) => chain,
    update: (..._args: any[]) => chain,
    delete: (..._args: any[]) => chain,
    execute: async () => [{ ok: 1 }],
    transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  };

  return {
    mockDb: db,
    dbHandle: {
      reset(next?: unknown[]) {
        state.queue.length = 0;
        if (next) state.queue.push(...next);
        state.idx = 0;
      },
    },
  };
});

vi.mock("@roots/db", () => ({ db: mockDb }));

import { shop } from "./shop";

beforeEach(() => {
  dbHandle.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callShop(path: string) {
  const res = await shop.request(path);
  return { status: res.status, body: await res.json() };
}

describe("GET /v1/shop/by-slug/:slug", () => {
  it("returns full shop payload for an active seller (snapshot)", async () => {
    dbHandle.reset([
      // sellers
      [
        {
          id: "00000000-0000-0000-0000-000000000111",
          userId: "00000000-0000-0000-0000-000000000222",
          teamId: "00000000-0000-0000-0000-000000000333",
          campaignId: "00000000-0000-0000-0000-000000000444",
          shopSlug: "anna-roots-2026",
          displayName: "Anna",
          individualGoal: 5000,
          status: "ACTIVE",
          publicAlias: null,
          hideFromLeaderboard: false,
          personalMessage: "Vi springer för en bra sak!",
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
          inviteToken: null,
        },
      ],
      // teams
      [
        {
          id: "00000000-0000-0000-0000-000000000333",
          orgId: "00000000-0000-0000-0000-000000000555",
          name: "P10 Svart",
        },
      ],
      // campaigns
      [
        {
          id: "00000000-0000-0000-0000-000000000444",
          name: "Vårkampanj 2026",
          story: "Vi samlar pengar till nytt cuplag.",
          description: "Köp gott och stöd laget.",
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2026-06-01T00:00:00.000Z"),
          goalType: "AMOUNT",
          goalValue: 100_000,
          deliveryType: "PICKUP",
          shippingThresholdOre: 0,
          shippingFeeOre: 0,
          status: "ACTIVE",
        },
      ],
      // organizations
      [{ name: "IFK Roots" }],
      // products
      [
        {
          id: "00000000-0000-0000-0000-000000000aa1",
          sku: "ROOTS-001",
          name: "Roots Granola 500g",
          slug: "roots-granola-500g",
          description: "Hemkrossad havre och nötter.",
          priceOre: 12900,
          currency: "SEK",
          active: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      // bundles
      [
        {
          id: "00000000-0000-0000-0000-000000000bb1",
          name: "Familjepaket",
          slug: "familjepaket",
          description: "Två granola, en kaffe.",
          priceOre: 24900,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      // bundleProducts
      [
        {
          id: "00000000-0000-0000-0000-000000000cc1",
          bundleId: "00000000-0000-0000-0000-000000000bb1",
          productId: "00000000-0000-0000-0000-000000000aa1",
        },
      ],
      // soldResult
      [{ total: 38700 }],
      // orderCountResult
      [{ count: 3 }],
    ]);

    const out = await callShop("/by-slug/anna-roots-2026");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });

  it("returns 404 when slug is unknown", async () => {
    dbHandle.reset([
      [], // sellers (empty)
    ]);

    const out = await callShop("/by-slug/saknas");
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "Shop hittades inte." });
  });
});

describe("GET /v1/shop/products", () => {
  it("returns the public catalogue (snapshot)", async () => {
    dbHandle.reset([
      [
        {
          id: "00000000-0000-0000-0000-000000000aa1",
          sku: "ROOTS-001",
          name: "Roots Granola 500g",
          slug: "roots-granola-500g",
          description: "Hemkrossad havre och nötter.",
          priceOre: 12900,
          currency: "SEK",
          active: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      [
        {
          id: "00000000-0000-0000-0000-000000000bb1",
          name: "Familjepaket",
          slug: "familjepaket",
          description: "Två granola, en kaffe.",
          priceOre: 24900,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    ]);

    const out = await callShop("/products");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});
