import { describe, expect, it } from "vitest";
import { tryFixKey } from "./hands";

describe("hands", () => {
  it("never clicks email pause, payouts or org review", async () => {
    expect(await tryFixKey("email-paused")).toBeNull();
    expect(await tryFixKey("pending-payouts")).toBeNull();
    expect(await tryFixKey("pending-org-review")).toBeNull();
    expect(await tryFixKey("stale-job:nightly")).toBeNull();
    expect(await tryFixKey("nightly-error:2026-09-16")).toBeNull();
  });
});
