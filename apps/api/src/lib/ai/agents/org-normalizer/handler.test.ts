import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for `runOrganizationNormalize` (apps/api/src/lib/ai/agents/org-normalizer/handler.ts).
 *
 * Uses the same `vi.hoisted` chainable-mock pattern as `portal.snapshot.test.ts`
 * so the handler exercises real Drizzle query syntax without touching Postgres.
 *
 * Mocks:
 *  - `@roots/db`   → chainable proxy whose results are dequeued from a small queue.
 *  - `../../flags` → toggle `newOrgHierarchy` per test.
 *  - `../../audit` → assert audit row is emitted only on successful writes.
 */

const { mockDb, dbHandle, updateCalls } = vi.hoisted(() => {
  const state: { queue: unknown[]; idx: number } = { queue: [], idx: 0 };
  const updates: { table: unknown; values: unknown; where: unknown }[] = [];

  const dequeue = (): unknown => {
    const v = state.idx < state.queue.length ? state.queue[state.idx] : [];
    state.idx += 1;
    return v;
  };

  const selectChain: any = new Proxy(
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
        return (..._args: any[]) => selectChain;
      },
    }
  );

  // Update chain — capture the values and where then resolve to []
  const makeUpdateChain = (table: unknown) => {
    const payload: any = { table, values: undefined, where: undefined };
    const chain: any = {
      set(values: unknown) {
        payload.values = values;
        return chain;
      },
      where(where: unknown) {
        payload.where = where;
        updates.push(payload);
        return chain;
      },
      then(resolve: any, reject?: any) {
        return Promise.resolve([]).then(resolve, reject);
      },
    };
    return chain;
  };

  const db = {
    select: () => selectChain,
    update: (table: unknown) => makeUpdateChain(table),
    insert: () => selectChain,
  };

  return {
    mockDb: db,
    dbHandle: {
      reset(next?: unknown[]) {
        state.queue.length = 0;
        if (next) state.queue.push(...next);
        state.idx = 0;
        updates.length = 0;
      },
    },
    updateCalls: updates,
  };
});

vi.mock("@roots/db", () => ({ db: mockDb }));
vi.mock("@roots/db/schema", async () => {
  const actual = await vi.importActual<any>("@roots/db/schema");
  return actual;
});
vi.mock("../../../audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../flags", async () => {
  const actual = await vi.importActual<any>("../../../flags");
  return {
    ...actual,
    flags: {
      ...actual.flags,
      newOrgHierarchy: vi.fn(() => true),
    },
  };
});

import { runOrganizationNormalize } from "./handler";
import { flags } from "../../../flags";
import { auditLog } from "../../../audit";

const newOrgHierarchyMock = vi.mocked(flags.newOrgHierarchy);
const auditLogMock = vi.mocked(auditLog);

beforeEach(() => {
  dbHandle.reset();
  newOrgHierarchyMock.mockReset().mockReturnValue(true);
  auditLogMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runOrganizationNormalize", () => {
  it("skips entirely when newOrgHierarchy flag is off", async () => {
    newOrgHierarchyMock.mockReturnValue(false);

    const res = await runOrganizationNormalize({
      organizationId: "00000000-0000-0000-0000-000000000001",
    });

    expect(res).toEqual({
      writes: 0,
      matchedRiksorganisationId: null,
      source: "skip-flag",
    });
    expect(updateCalls).toHaveLength(0);
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("normalises NULL columns and matches riksorg by national_federation", async () => {
    dbHandle.reset([
      // organizations row
      [
        {
          id: "00000000-0000-0000-0000-000000000010",
          name: "IFK Göteborg",
          nationalFederation: "Riksidrottsförbundet",
          normalizedName: null,
          displayName: null,
          riksorganisationId: null,
        },
      ],
      // master_riksorganisation rows
      [
        { id: "rid-1", name: "Riksidrottsförbundet" },
        { id: "rid-2", name: "Sveriges Schackförbund" },
      ],
    ]);

    const res = await runOrganizationNormalize({
      organizationId: "00000000-0000-0000-0000-000000000010",
    });

    expect(res.source).toBe("local");
    expect(res.matchedRiksorganisationId).toBe("rid-1");
    expect(res.writes).toBe(3); // normalized_name + display_name + riks id

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].values).toMatchObject({
      normalizedName: "ifk goteborg",
      displayName: "IFK Göteborg",
      riksorganisationId: "rid-1",
    });

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const auditArg = auditLogMock.mock.calls[0][0];
    expect(auditArg.action).toBe("org.normalize");
    expect(auditArg.entityType).toBe("organization");
    expect(auditArg.meta).toMatchObject({
      source: "local",
      confidence: 1,
      matchedOn: "national_federation",
    });
  });

  it("never overwrites existing curated values", async () => {
    dbHandle.reset([
      [
        {
          id: "00000000-0000-0000-0000-000000000011",
          name: "AIK Fotboll",
          nationalFederation: null,
          normalizedName: "human-curated value",
          displayName: "AIK Fotboll",
          riksorganisationId: "existing-rid",
        },
      ],
      [{ id: "rid-1", name: "Riksidrottsförbundet" }],
    ]);

    const res = await runOrganizationNormalize({
      organizationId: "00000000-0000-0000-0000-000000000011",
    });

    expect(res.source).toBe("skip-nochange");
    expect(res.writes).toBe(0);
    expect(updateCalls).toHaveLength(0);
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("returns skip-missing when org row is not found", async () => {
    dbHandle.reset([
      [], // organizations
    ]);

    const res = await runOrganizationNormalize({
      organizationId: "00000000-0000-0000-0000-000000000012",
    });

    expect(res.source).toBe("skip-missing");
    expect(updateCalls).toHaveLength(0);
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("fills normalized_name even when no riksorg matches", async () => {
    dbHandle.reset([
      [
        {
          id: "00000000-0000-0000-0000-000000000013",
          name: "Helt Nytt Förbund",
          nationalFederation: null,
          normalizedName: null,
          displayName: null,
          riksorganisationId: null,
        },
      ],
      [{ id: "rid-1", name: "Riksidrottsförbundet" }],
    ]);

    const res = await runOrganizationNormalize({
      organizationId: "00000000-0000-0000-0000-000000000013",
    });

    expect(res.source).toBe("local");
    expect(res.matchedRiksorganisationId).toBeNull();
    expect(res.writes).toBe(2); // normalized_name + display_name only
    expect(updateCalls[0].values).toMatchObject({
      normalizedName: "helt nytt forbund",
      displayName: "Helt Nytt Förbund",
    });
    expect(updateCalls[0].values).not.toHaveProperty("riksorganisationId");

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(auditLogMock.mock.calls[0][0].meta).toMatchObject({
      source: "local",
      confidence: 0,
      matchedOn: null,
    });
  });
});
