import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for `scheduleOrgNormalize` (apps/api/src/lib/jobs/schedule-org-normalize.ts).
 *
 * Verifies the actual production helper — not a copy — exercises:
 *   1. Correct name/payload/singletonKey passed to `enqueueJob`.
 *   2. Errors from `enqueueJob` are swallowed (caller's HTTP path is safe).
 *   3. `flags.workersEnabled()` false → short-circuit, no enqueue call.
 *   4. Re-trigger for the same orgId → identical singletonKey (dedup).
 */

vi.mock("./index", () => ({
  enqueueJob: vi.fn().mockResolvedValue("job_1"),
  singletonKey: (name: string, parts: Record<string, unknown>) =>
    `${name}|${Object.entries(parts)
      .map(([k, v]) => `${k}=${v}`)
      .join("&")}`,
}));

vi.mock("../flags", async () => {
  const actual = await vi.importActual<any>("../flags");
  return {
    ...actual,
    flags: {
      ...actual.flags,
      workersEnabled: vi.fn(() => true),
    },
  };
});

import { scheduleOrgNormalize } from "./schedule-org-normalize";
import { enqueueJob } from "./index";
import { flags } from "../flags";

const enqueueMock = vi.mocked(enqueueJob);
const workersEnabledMock = vi.mocked(flags.workersEnabled);

beforeEach(() => {
  enqueueMock.mockReset().mockResolvedValue("job_1");
  workersEnabledMock.mockReset().mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("scheduleOrgNormalize", () => {
  it("enqueues with stable singletonKey on the orgId", () => {
    const orgId = "00000000-0000-0000-0000-0000000000aa";
    scheduleOrgNormalize(orgId);

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(
      "agent.organization-normalize",
      { organizationId: orgId },
      { singletonKey: `agent.organization-normalize|orgId=${orgId}` }
    );
  });

  it("short-circuits when workers are disabled (no enqueue call)", () => {
    workersEnabledMock.mockReturnValue(false);
    scheduleOrgNormalize("00000000-0000-0000-0000-0000000000bb");
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("swallows enqueue errors so callers never observe them", async () => {
    enqueueMock.mockRejectedValueOnce(new Error("boom"));

    expect(() =>
      scheduleOrgNormalize("00000000-0000-0000-0000-0000000000cc")
    ).not.toThrow();

    // Allow the microtask queue to flush so the .catch runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("returns synchronously (does not await the underlying promise)", () => {
    const orgId = "00000000-0000-0000-0000-0000000000ee";
    // If this returned the promise, the runtime type would be Promise<…>.
    const ret = scheduleOrgNormalize(orgId);
    expect(ret).toBeUndefined();
  });

  it("deduplicates per orgId via singletonKey (same key on re-trigger)", () => {
    const orgId = "00000000-0000-0000-0000-0000000000dd";
    scheduleOrgNormalize(orgId);
    scheduleOrgNormalize(orgId);

    expect(enqueueMock).toHaveBeenCalledTimes(2);
    expect(enqueueMock.mock.calls[0][2]).toEqual(
      enqueueMock.mock.calls[1][2]
    );
  });
});
