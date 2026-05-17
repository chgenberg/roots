import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * API SNAPSHOT TESTS — portal endpoints (synthesis §16 Typ B/C).
 *
 * The exact JSON wire format for every dashboard role and for the
 * statistics/pipeline/income screens is locked into a Vitest snapshot.
 * If a future PR drifts the response (renames a field, changes a number,
 * removes a string alias) reviewers will see the diff in CI before it
 * silently breaks the UI.
 *
 * The DB is mocked so tests run in <100ms without Postgres. Each test
 * enqueues the exact rows it expects the route to fetch — effectively a
 * checked-in "seed" of deterministic, role-specific data.
 *
 * NOTE: this is **complementary** to `portal.contract.test.ts` (which
 * validates shape via Zod) — the snapshot adds literal-value guard rails.
 */

const { mockDb, dbHandle } = vi.hoisted(() => {
  // Inline `makeMockDb` so the mock module factory below can see it
  // (vi.mock + vi.hoisted runs before any top-level imports).
  const state: { queue: unknown[]; idx: number } = { queue: [], idx: 0 };

  const dequeue = (): unknown => {
    const v = state.idx < state.queue.length ? state.queue[state.idx] : [];
    state.idx += 1;
    return v;
  };

  const inserts: { table: unknown; values: unknown }[] = [];
  let currentInsertTable: unknown = null;

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
        if (prop === "values") {
          return (values: unknown) => {
            inserts.push({ table: currentInsertTable, values });
            return chain;
          };
        }
        return (..._args: any[]) => chain;
      },
    }
  );

  const db = {
    select: (..._args: any[]) => chain,
    insert: (table: unknown) => {
      currentInsertTable = table;
      return chain;
    },
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
        inserts.length = 0;
        currentInsertTable = null;
      },
      inserts,
    },
  };
});

vi.mock("@roots/db", () => ({ db: mockDb }));

vi.mock("../lib/session", async () => {
  const actual = await vi.importActual<any>("../lib/session");
  return {
    ...actual,
    getSession: vi.fn(),
    SESSION_COOKIE_NAME: actual.SESSION_COOKIE_NAME ?? "roots_session",
  };
});

import { portal } from "./portal";
import * as session from "../lib/session";

const SESSION_COOKIE = `${session.SESSION_COOKIE_NAME}=session-id`;
const getSessionMock = vi.mocked(session.getSession);

beforeEach(() => {
  dbHandle.reset();
  getSessionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callPortal(path: string) {
  const res = await portal.request(path, {
    headers: { cookie: SESSION_COOKIE },
  });
  return { status: res.status, body: await res.json() };
}

describe("GET /v1/portal/dashboard — CLUB_ADMIN", () => {
  it("returns deterministic club KPIs (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000010",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [{ count: 24 }],         // members
      [{ count: 12 }],         // orders
      [{ total: 480_000 }],    // revenue (PAID) → 4 800 kr
    ]);

    const out = await callPortal("/dashboard");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/dashboard — SALES_REP", () => {
  it("returns deterministic sales KPIs (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000011",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [{ count: 7 }],            // clubs
      [{ count: 5 }],            // quotesOut
      [{ count: 3 }],            // closedThisMonth
      [{ total: 1_250_000 }],    // pipelineValue (SENT) → 12 500 kr
    ]);

    const out = await callPortal("/dashboard");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/dashboard — INTERNAL_ADMIN", () => {
  it("returns deterministic platform KPIs (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000012",
      role: "INTERNAL_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [{ count: 1234 }],         // totalOrders
      [{ count: 56 }],           // totalClubs
      [{ total: 99_000_000 }],   // mrr (PAID sum) → 990 000 kr
    ]);

    const out = await callPortal("/dashboard");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });

  it("returns isDemo=true and 0-kr fallback when no rows", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000013",
      role: "INTERNAL_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [{ count: 0 }],
      [{ count: 0 }],
      [{ total: 0 }],
    ]);

    const out = await callPortal("/dashboard");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/statistics", () => {
  it("returns monthly buckets with formatted aliases (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000020",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000bb",
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [
        { month: "2026-03", orderCount: 4, revenueOre: 80_000 },
        { month: "2026-04", orderCount: 6, revenueOre: 150_000 },
        { month: "2026-05", orderCount: 9, revenueOre: 270_000 },
      ],
    ]);

    const out = await callPortal("/statistics");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });

  it("returns isDemo=true for empty buckets (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000021",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000cc",
      createdAt: 0,
    } as any);

    dbHandle.reset([[]]);

    const out = await callPortal("/statistics");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/pipeline", () => {
  it("returns stage rollups and recent deals (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000030",
      role: "SALES_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [
        { status: "DRAFT", count: 2, totalOre: 300_000 },
        { status: "SENT", count: 4, totalOre: 800_000 },
        { status: "ACCEPTED", count: 1, totalOre: 250_000 },
      ],
      [
        {
          id: "00000000-0000-0000-0000-0000000000d1",
          status: "SENT",
          totalOre: 250_000,
          orgId: "00000000-0000-0000-0000-0000000000aa",
          // Joined from `organizations` via LEFT JOIN in
          // /v1/portal/pipeline (Sprint B). The UI renders this as the
          // kanban-card title instead of "Klubb <orgId-prefix>".
          orgName: "Demo Fotbollsklubb",
          createdAt: new Date("2026-05-14T08:00:00.000Z"),
        },
        {
          id: "00000000-0000-0000-0000-0000000000d2",
          status: "DRAFT",
          totalOre: 150_000,
          orgId: "00000000-0000-0000-0000-0000000000bb",
          // Null orgName covers the data-migration edge case where the
          // FK lookup misses; the contract schema allows it and the UI
          // falls back to "—".
          orgName: null,
          createdAt: new Date("2026-05-13T12:00:00.000Z"),
        },
      ],
    ]);

    const out = await callPortal("/pipeline");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/income", () => {
  it("returns last 6 months earned (snapshot)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000040",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000ee",
      createdAt: 0,
    } as any);

    dbHandle.reset([
      [
        { month: "2026-05", revenueOre: 200_000, orderCount: 8 },
        { month: "2026-04", revenueOre: 175_000, orderCount: 7 },
        { month: "2026-03", revenueOre: 90_000, orderCount: 4 },
      ],
      [{ total: 465_000 }],
    ]);

    const out = await callPortal("/income");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });
});

describe("GET /v1/portal/dashboard — unauthenticated", () => {
  it("returns 401 without snapshotting the body", async () => {
    getSessionMock.mockResolvedValue(null);
    dbHandle.reset();
    const out = await callPortal("/dashboard");
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: "Ej inloggad" });
  });
});

/**
 * Regression coverage for connection-audit P0 #1 — role + tenancy scoping.
 *
 * Before this fix, the /dashboard handler had a bare "else" branch that
 * served the INTERNAL_ADMIN aggregate (totalOrders/totalClubs/mrr across
 * the platform) to anything that wasn't CLUB_* or SALES_*. That meant
 * fundraising sessions (ASSOCIATION_ADMIN, TEAM_LEADER, SELLER) silently
 * leaked global platform numbers. Similarly /statistics and /income used
 * `session.orgId ? eq(...) : sql\`1=1\`` so null-orgId sessions saw global
 * revenue, and /pipeline had no tenancy filter at all.
 */
describe("portal role scoping — connection audit P0 #1", () => {
  it("dashboard returns 403 for fundraising roles (no platform leak)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000060",
      role: "ASSOCIATION_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/dashboard");
    expect(out.status).toBe(403);
    expect(out.body).toEqual({ error: "Behörighet saknas" });
  });

  it("dashboard returns 400 for CLUB_ADMIN without orgId", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000061",
      role: "CLUB_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/dashboard");
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "Klubbkontext saknas" });
  });

  it("statistics returns 403 for SELLER (orders are not seller-owned)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000062",
      role: "SELLER",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/statistics");
    expect(out.status).toBe(403);
    expect(out.body).toEqual({ error: "Behörighet saknas" });
  });

  it("income returns 400 for CLUB_ADMIN without orgId (was global 1=1)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000063",
      role: "CLUB_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/income");
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "Klubbkontext saknas" });
  });

  it("pipeline returns 403 for CLUB_MEMBER (quotes are sales-internal)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000064",
      role: "CLUB_MEMBER",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/pipeline");
    expect(out.status).toBe(403);
    expect(out.body).toEqual({ error: "Behörighet saknas" });
  });

  it("clubs returns 403 for CLUB_ADMIN (only sales/admin see directory)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000065",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/clubs");
    expect(out.status).toBe(403);
    expect(out.body).toEqual({ error: "Behörighet saknas" });
  });

  it("sellers returns 403 for non-admin roles (no staff enumeration)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000066",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await callPortal("/sellers");
    expect(out.status).toBe(403);
    expect(out.body).toEqual({ error: "Behörighet saknas" });
  });
});

/**
 * Regression coverage for two recent portal bug fixes:
 *
 *  1. `orders.userId` / `orders.orgId` are both NOT NULL in the schema, but
 *     the handler used to forward `session.orgId` even when it was `null`,
 *     producing a DB-level 500. We now fail fast with a 400 if the session
 *     has no club context.
 *
 *  2. `order_lines` has a column named `qty`, not `quantity`. The previous
 *     insert used `quantity: l.qty`, which silently broke the line-items
 *     write at runtime. The fix renames to `qty` — this test asserts the
 *     exact field name reaches the DB layer.
 */
describe("POST /v1/portal/orders", () => {
  async function postOrder(body: unknown) {
    const res = await portal.request("/orders", {
      method: "POST",
      headers: {
        cookie: SESSION_COOKIE,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it("returns 400 when session has no orgId (no orphan rows)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000050",
      role: "CLUB_ADMIN",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();

    const out = await postOrder({
      items: [{ productId: "00000000-0000-0000-0000-0000000000f1", qty: 2 }],
    });

    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "Beställning kräver klubbkontext" });
    expect(dbHandle.inserts).toHaveLength(0);
  });

  it("inserts order_lines with `qty` (not `quantity`)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000051",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000ab",
      createdAt: 0,
    } as any);

    dbHandle.reset([
      // products lookup
      [
        {
          id: "00000000-0000-0000-0000-0000000000f1",
          priceOre: 12_900,
        },
      ],
      // returning() of the new order row
      [{ id: "00000000-0000-0000-0000-000000000099" }],
    ]);

    const out = await postOrder({
      items: [{ productId: "00000000-0000-0000-0000-0000000000f1", qty: 3 }],
    });

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ ok: true });

    // 1st insert = orders, 2nd = order_lines
    expect(dbHandle.inserts).toHaveLength(2);
    const lineValues = dbHandle.inserts[1].values as Array<Record<string, unknown>>;
    expect(Array.isArray(lineValues)).toBe(true);
    expect(lineValues[0]).toMatchObject({
      productId: "00000000-0000-0000-0000-0000000000f1",
      qty: 3,
      unitPriceOre: 12_900,
      orderId: "00000000-0000-0000-0000-000000000099",
    });
    // Regression: `quantity` must NOT be present (schema has `qty`).
    expect(lineValues[0]).not.toHaveProperty("quantity");
  });
});

/**
 * Sprint C — POST /v1/portal/quotes ("Ny offert").
 *
 * Critical guarantees:
 *  - role scoping: CLUB roles must not create quotes (would let a club
 *    write itself a fake deal)
 *  - server-side pricing: the `unitPriceOre` written to `quote_lines`
 *    must come from the product catalog, not the request body
 *  - transactional: quote + lines are inserted together
 */
describe("POST /v1/portal/quotes", () => {
  async function postQuote(body: unknown) {
    const res = await portal.request("/quotes", {
      method: "POST",
      headers: {
        cookie: SESSION_COOKIE,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it("returns 403 for CLUB_ADMIN (sales-internal endpoint)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000111",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      createdAt: 0,
    } as any);
    dbHandle.reset();

    const out = await postQuote({
      orgId: "00000000-0000-0000-0000-0000000000aa",
      lines: [{ productId: "00000000-0000-0000-0000-0000000000f1", qty: 1 }],
    });

    expect(out.status).toBe(403);
    expect(dbHandle.inserts).toHaveLength(0);
  });

  it("creates quote + lines with server-side pricing for SALES_REP", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000112",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
    } as any);

    dbHandle.reset([
      // org lookup
      [
        {
          id: "00000000-0000-0000-0000-0000000000bb",
          name: "Demo Fotbollsklubb",
        },
      ],
      // product catalog lookup
      [
        { id: "00000000-0000-0000-0000-0000000000f1", priceOre: 14_900 },
        { id: "00000000-0000-0000-0000-0000000000f2", priceOre: 12_900 },
      ],
      // returning() of the new quote row
      [
        {
          id: "00000000-0000-0000-0000-0000000000q1",
          orgId: "00000000-0000-0000-0000-0000000000bb",
          salesRepId: "00000000-0000-0000-0000-000000000112",
          status: "DRAFT",
          totalOre: 2 * 14_900 + 1 * 12_900,
          validUntil: new Date("2026-06-17T00:00:00.000Z"),
          createdAt: new Date("2026-05-17T00:00:00.000Z"),
        },
      ],
    ]);

    const out = await postQuote({
      orgId: "00000000-0000-0000-0000-0000000000bb",
      lines: [
        // Client *tries* to send a manipulated unitPriceOre — must be
        // ignored. Only productId + qty should reach the lines table.
        {
          productId: "00000000-0000-0000-0000-0000000000f1",
          qty: 2,
          unitPriceOre: 1,
        },
        { productId: "00000000-0000-0000-0000-0000000000f2", qty: 1 },
      ],
      status: "DRAFT",
    });

    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({
      quote: {
        id: "00000000-0000-0000-0000-0000000000q1",
        orgName: "Demo Fotbollsklubb",
        status: "DRAFT",
        totalOre: 2 * 14_900 + 1 * 12_900,
      },
    });

    // 1st insert = quotes, 2nd = quote_lines.
    expect(dbHandle.inserts).toHaveLength(2);
    const quoteValues = dbHandle.inserts[0].values as Record<string, unknown>;
    expect(quoteValues).toMatchObject({
      orgId: "00000000-0000-0000-0000-0000000000bb",
      salesRepId: "00000000-0000-0000-0000-000000000112",
      status: "DRAFT",
      totalOre: 2 * 14_900 + 1 * 12_900,
    });

    const lineValues = dbHandle.inserts[1].values as Array<
      Record<string, unknown>
    >;
    expect(lineValues).toHaveLength(2);
    // Server-side price wins over whatever the client tried to send.
    expect(lineValues[0]).toMatchObject({
      productId: "00000000-0000-0000-0000-0000000000f1",
      qty: 2,
      unitPriceOre: 14_900,
    });
    expect(lineValues[1]).toMatchObject({
      productId: "00000000-0000-0000-0000-0000000000f2",
      qty: 1,
      unitPriceOre: 12_900,
    });
  });

  it("returns 400 when lines array is empty", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000113",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await postQuote({
      orgId: "00000000-0000-0000-0000-0000000000bb",
      lines: [],
    });
    expect(out.status).toBe(400);
    expect(dbHandle.inserts).toHaveLength(0);
  });
});

/**
 * Sprint C — POST /v1/portal/members/invite ("Bjud in medlem").
 *
 * Critical guarantees:
 *  - role scoping: only CLUB_ADMIN (with their own orgId) and
 *    INTERNAL_ADMIN can invite — never SALES_*, never fundraising roles
 *  - email uniqueness: pre-existing email returns 409 (not 500)
 *  - inserted user lands in the caller's orgId with the supplied role
 */
describe("POST /v1/portal/members/invite", () => {
  async function postInvite(body: unknown) {
    const res = await portal.request("/members/invite", {
      method: "POST",
      headers: {
        cookie: SESSION_COOKIE,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it("returns 403 for SALES_REP (no member-roster mutation)", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000121",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
    } as any);
    dbHandle.reset();
    const out = await postInvite({
      email: "ny@medlem.se",
      contactName: "Ny Medlem",
    });
    expect(out.status).toBe(403);
    expect(dbHandle.inserts).toHaveLength(0);
  });

  it("returns 409 when email is already registered", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000122",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000cc",
      createdAt: 0,
    } as any);
    dbHandle.reset([
      // pre-existing user row
      [{ id: "00000000-0000-0000-0000-0000000000u1" }],
    ]);
    const out = await postInvite({
      email: "redan@finns.se",
      contactName: "Dubblett",
    });
    expect(out.status).toBe(409);
    expect(dbHandle.inserts).toHaveLength(0);
  });

  it("inserts the new member into the caller's org for CLUB_ADMIN", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000123",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000cc",
      createdAt: 0,
    } as any);
    dbHandle.reset([
      // existing-user lookup returns empty array
      [],
      // returning() of the new user row
      [
        {
          id: "00000000-0000-0000-0000-0000000000u9",
          email: "ny@medlem.se",
          contactName: "Ny Medlem",
          role: "CLUB_MEMBER",
          createdAt: new Date("2026-05-17T22:00:00.000Z"),
        },
      ],
    ]);

    const out = await postInvite({
      email: "Ny@Medlem.SE  ",
      contactName: "Ny Medlem",
      role: "CLUB_MEMBER",
    });

    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({
      member: { email: "ny@medlem.se", role: "CLUB_MEMBER" },
    });
    expect(dbHandle.inserts).toHaveLength(1);
    const inserted = dbHandle.inserts[0].values as Record<string, unknown>;
    expect(inserted).toMatchObject({
      email: "ny@medlem.se",
      role: "CLUB_MEMBER",
      orgId: "00000000-0000-0000-0000-0000000000cc",
      contactName: "Ny Medlem",
    });
    // Password hash is a non-loginable sentinel — must not be a real
    // argon2 string (the auth route verifies argon2 and would otherwise
    // panic before the 401 path).
    expect(String(inserted.passwordHash)).toMatch(/^invite-pending-/);
  });
});
