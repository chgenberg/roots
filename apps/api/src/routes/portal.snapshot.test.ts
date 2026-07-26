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

// `auditLogs` is re-exported from @roots/db and used by lib/audit. Without
// it in the mock the audit write throws (swallowed by design), so the audit
// trail would silently go untested — and for pipeline moves that trail is
// the only record of who moved a deal and when.
vi.mock("@roots/db", () => ({ db: mockDb, auditLogs: { _table: "audit_logs" } }));

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
      // 1. monthlyData (12-month rolling buckets)
      [
        { month: "2026-03", orderCount: 4, revenueOre: 80_000 },
        { month: "2026-04", orderCount: 6, revenueOre: 150_000 },
        { month: "2026-05", orderCount: 9, revenueOre: 270_000 },
      ],
      // 2. KPI: current 30-day window aggregate
      [{ orderCount: 9, revenueOre: 270_000, uniqueUsers: 7 }],
      // 3. KPI: previous 30-day window aggregate (for % delta)
      [{ orderCount: 6, revenueOre: 150_000, uniqueUsers: 4 }],
      // 4. KPI: new members in current 30-day window
      [{ count: 12 }],
      // 5. KPI: new members in previous 30-day window
      [{ count: 8 }],
      // 6. Top products (90-day rolling, ordered by revenue desc)
      [
        {
          productId: "00000000-0000-0000-0000-0000000000a1",
          name: "Roots Schampoo",
          slug: "roots-schampoo",
          soldUnits: 30,
          revenueOre: 90_000,
        },
        {
          productId: "00000000-0000-0000-0000-0000000000a2",
          name: "Roots Conditioner",
          slug: "roots-conditioner",
          soldUnits: 25,
          revenueOre: 75_000,
        },
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

    // /pipeline now executes four queries: stages-rollup, lead-count,
    // recent-quote-deals, recent-lead-orgs. (Sprint E12 added the LEAD
    // stage projection over `organizations.crmStatus`.)
    dbHandle.reset([
      [
        { status: "DRAFT", count: 2, totalOre: 300_000 },
        { status: "SENT", count: 4, totalOre: 800_000 },
        { status: "ACCEPTED", count: 1, totalOre: 250_000 },
      ],
      [{ leadCount: 1 }],
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
          // `stageSince` (quotes.updatedAt) is what the board's age badge
          // counts from — a quote that has sat 40 days in SENT is the
          // signal, not the day it was drafted.
          stageSince: new Date("2026-05-20T08:00:00.000Z"),
          municipality: "Solna",
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
          stageSince: null,
          municipality: null,
        },
      ],
      [
        {
          id: "00000000-0000-0000-0000-0000000000e1",
          orgId: "00000000-0000-0000-0000-0000000000e1",
          orgName: "IFK Lead-test",
          createdAt: new Date("2026-05-15T09:00:00.000Z"),
          potentialScore: 65,
          leadSource: "OUTBOUND",
          municipality: "Uppsala",
        },
      ],
    ]);

    const out = await callPortal("/pipeline");
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });

  // Demo logins (salj@roots.se and friends) may read the board but every
  // write is refused. The board reads this flag to hide the drag handles —
  // without it the demo user drags a card and gets a 403 that looks like a
  // broken feature rather than a deliberate limit.
  it("flags the board read-only for demo accounts", async () => {
    // The local dev env sets ROOTS_ALLOW_DEMO_WRITES=true (film recording);
    // clear it so the assertion means the same thing here and in CI.
    vi.stubEnv("ROOTS_ALLOW_DEMO_WRITES", "");
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000030",
      role: "SALES_REP",
      orgId: null,
      createdAt: 0,
      isDemoAccount: true,
    } as any);
    dbHandle.reset([[], [{ leadCount: 0 }], [], []]);

    const out = await callPortal("/pipeline");
    expect(out.status).toBe(200);
    expect((out.body as { readOnly: boolean }).readOnly).toBe(true);
    vi.unstubAllEnvs();
  });
});

// ── Drag-and-drop between pipeline stages ──────────────────────────
//
// PATCH /quotes/:id/status is what the kanban board writes when a card is
// dropped on another column (and what the stage picker in the deal dialog
// calls). The guards below are the ones that keep a drag from doing
// something the rep didn't ask for.

const QUOTE_ID = "00000000-0000-0000-0000-0000000000d1";
const REP_ID = "00000000-0000-0000-0000-000000000040";

function repSession(userId = REP_ID) {
  return {
    userId,
    role: "SALES_REP",
    orgId: null,
    createdAt: 0,
  } as any;
}

async function patchStatus(id: string, body: unknown) {
  const res = await portal.request(`/quotes/${id}/status`, {
    method: "PATCH",
    headers: { cookie: SESSION_COOKIE, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("PATCH /v1/portal/quotes/:id/status", () => {
  const existingQuote = {
    id: QUOTE_ID,
    status: "SENT",
    orgId: "00000000-0000-0000-0000-0000000000aa",
    salesRepId: REP_ID,
    totalOre: 250_000,
  };

  it("refuses demo accounts before touching the quote", async () => {
    vi.stubEnv("ROOTS_ALLOW_DEMO_WRITES", "");
    getSessionMock.mockResolvedValue({
      ...repSession(),
      isDemoAccount: true,
    });
    dbHandle.reset([[existingQuote]]);

    const out = await patchStatus(QUOTE_ID, { status: "ACCEPTED" });
    expect(out.status).toBe(403);
    // Nothing was written: no status update means no audit row either.
    expect(dbHandle.inserts).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it("moves a quote the rep owns and reports the new stage", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [existingQuote],
      [
        {
          ...existingQuote,
          status: "REJECTED",
          updatedAt: new Date("2026-05-21T10:00:00.000Z"),
        },
      ],
      [], // auditLog insert
    ]);

    const out = await patchStatus(QUOTE_ID, { status: "REJECTED" });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      quote: {
        id: QUOTE_ID,
        status: "REJECTED",
        totalOre: 250_000,
        orgId: existingQuote.orgId,
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
      orgPromotedToCustomer: false,
    });

    // `quotes` only stores the current status, so the audit row is the
    // whole history of the move.
    expect(dbHandle.inserts).toHaveLength(1);
    expect(dbHandle.inserts[0].values).toMatchObject({
      userId: REP_ID,
      action: "sales.quote.status_changed",
      entityType: "quote",
      entityId: QUOTE_ID,
      meta: { from: "SENT", to: "REJECTED", orgId: existingQuote.orgId },
    });
  });

  it("promotes the club from LEAD to CUSTOMER when the quote is accepted", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [existingQuote],
      [
        {
          ...existingQuote,
          status: "ACCEPTED",
          updatedAt: new Date("2026-05-21T10:00:00.000Z"),
        },
      ],
      [{ id: existingQuote.orgId }], // organizations update matched a LEAD row
      [], // auditLog insert
    ]);

    const out = await patchStatus(QUOTE_ID, { status: "ACCEPTED" });
    expect(out.status).toBe(200);
    expect(out.body.orgPromotedToCustomer).toBe(true);
  });

  it("rejects EXPIRED — it has no column on the board", async () => {
    getSessionMock.mockResolvedValue(repSession());
    const out = await patchStatus(QUOTE_ID, { status: "EXPIRED" });
    expect(out.status).toBe(400);
  });

  it("rejects an unknown status", async () => {
    getSessionMock.mockResolvedValue(repSession());
    const out = await patchStatus(QUOTE_ID, { status: "WON" });
    expect(out.status).toBe(400);
  });

  it("rejects a malformed quote id before touching the database", async () => {
    getSessionMock.mockResolvedValue(repSession());
    const out = await patchStatus("not-a-uuid", { status: "SENT" });
    expect(out.status).toBe(400);
  });

  it("does not let a rep move a colleague's quote", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [{ ...existingQuote, salesRepId: "00000000-0000-0000-0000-0000000000ff" }],
    ]);

    const out = await patchStatus(QUOTE_ID, { status: "ACCEPTED" });
    expect(out.status).toBe(403);
  });

  it("404s on a quote that doesn't exist", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([[]]);

    const out = await patchStatus(QUOTE_ID, { status: "SENT" });
    expect(out.status).toBe(404);
  });

  it("keeps club roles out", async () => {
    getSessionMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000050",
      role: "CLUB_ADMIN",
      orgId: "00000000-0000-0000-0000-0000000000cc",
      createdAt: 0,
    } as any);

    const out = await patchStatus(QUOTE_ID, { status: "ACCEPTED" });
    expect(out.status).toBe(403);
  });

  it("leaves the stage untouched when dropped back on the same column", async () => {
    getSessionMock.mockResolvedValue(repSession());
    // Only the lookup runs — a no-op move must not bump updatedAt, or the
    // "days in stage" badge would reset every time a card is nudged.
    dbHandle.reset([[existingQuote]]);

    const out = await patchStatus(QUOTE_ID, { status: "SENT" });
    expect(out.status).toBe(200);
    expect(out.body.quote.status).toBe("SENT");
    expect(out.body.orgPromotedToCustomer).toBe(false);
  });
});

describe("GET /v1/portal/pipeline/deals/:kind/:id", () => {
  it("rejects an unknown kind", async () => {
    getSessionMock.mockResolvedValue(repSession());
    const out = await callPortal(`/pipeline/deals/klubb/${QUOTE_ID}`);
    expect(out.status).toBe(400);
  });

  it("returns the quote with lines, club facts and sibling quotes (snapshot)", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [
        {
          id: QUOTE_ID,
          status: "SENT",
          totalOre: 250_000,
          orgId: "00000000-0000-0000-0000-0000000000aa",
          salesRepId: REP_ID,
          validUntil: new Date("2026-06-14T08:00:00.000Z"),
          createdAt: new Date("2026-05-14T08:00:00.000Z"),
          updatedAt: new Date("2026-05-20T08:00:00.000Z"),
        },
      ],
      [
        {
          id: "00000000-0000-0000-0000-0000000000aa",
          name: "Demo Fotbollsklubb",
          orgNumber: "556677-8899",
          type: "club",
          sportType: "Fotboll",
          municipality: "Solna",
          region: "Stockholm",
          website: "demoif.se",
          crmStatus: "LEAD",
          leadSource: "OUTBOUND",
          potentialScore: 70,
          assignedAsmUserId: REP_ID,
          createdAt: new Date("2026-04-01T08:00:00.000Z"),
        },
      ],
      [{ membersCount: 15 }],
      [
        {
          productName: "Roots Schampoo",
          sku: "ROOTS-SH-001",
          qty: 10,
          unitPriceOre: 14_900,
        },
      ],
      [
        // The card's own quote is filtered out of `otherQuotes`.
        {
          id: QUOTE_ID,
          status: "SENT",
          totalOre: 250_000,
          createdAt: new Date("2026-05-14T08:00:00.000Z"),
        },
        {
          id: "00000000-0000-0000-0000-0000000000d9",
          status: "REJECTED",
          totalOre: 90_000,
          createdAt: new Date("2026-03-02T08:00:00.000Z"),
        },
      ],
      [{ contactName: "Erik Säljare", email: "salj@roots.se" }],
    ]);

    const out = await callPortal(`/pipeline/deals/quote/${QUOTE_ID}`);
    expect(out.status).toBe(200);
    expect(out.body).toMatchSnapshot();
  });

  it("does not let a rep open a colleague's quote", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [
        {
          id: QUOTE_ID,
          status: "SENT",
          totalOre: 250_000,
          orgId: "00000000-0000-0000-0000-0000000000aa",
          salesRepId: "00000000-0000-0000-0000-0000000000ff",
          validUntil: null,
          createdAt: new Date("2026-05-14T08:00:00.000Z"),
          updatedAt: new Date("2026-05-14T08:00:00.000Z"),
        },
      ],
    ]);

    const out = await callPortal(`/pipeline/deals/quote/${QUOTE_ID}`);
    expect(out.status).toBe(403);
  });

  it("does not let a rep open a lead assigned to someone else", async () => {
    getSessionMock.mockResolvedValue(repSession());
    dbHandle.reset([
      [
        {
          id: "00000000-0000-0000-0000-0000000000e1",
          name: "IFK Lead-test",
          orgNumber: null,
          type: "club",
          sportType: null,
          municipality: null,
          region: null,
          website: null,
          crmStatus: "LEAD",
          leadSource: "WEB",
          potentialScore: 40,
          assignedAsmUserId: "00000000-0000-0000-0000-0000000000ff",
          createdAt: new Date("2026-05-15T09:00:00.000Z"),
        },
      ],
    ]);

    const out = await callPortal(
      "/pipeline/deals/lead/00000000-0000-0000-0000-0000000000e1"
    );
    expect(out.status).toBe(403);
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
