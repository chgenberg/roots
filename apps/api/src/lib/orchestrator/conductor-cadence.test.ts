import { describe, expect, it } from "vitest";
import {
  cadenceBucket,
  isCadenceDue,
  jobKey,
} from "./conductor-cadence";

describe("conductor cadence", () => {
  it("always looks when cadence is always", () => {
    expect(isCadenceDue({ cadence: "always", lastLookedAt: new Date() })).toBe(
      true
    );
  });

  it("is due hourly after an hour", () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000 - 1);
    expect(isCadenceDue({ cadence: "hourly", lastLookedAt: hourAgo })).toBe(
      true
    );
    expect(
      isCadenceDue({
        cadence: "hourly",
        lastLookedAt: new Date(Date.now() - 10 * 60 * 1000),
      })
    ).toBe(false);
  });

  it("buckets always jobs without a period", () => {
    expect(cadenceBucket("always")).toBeNull();
    expect(jobKey("r1", "ord-1", "order.paid", "always")).toBe(
      "rule:r1:ord-1:order.paid"
    );
  });

  it("keeps same-period jobs unique", () => {
    const a = jobKey("r1", "ord-1", "order.paid", "daily");
    const b = jobKey("r1", "ord-1", "order.paid", "daily");
    expect(a).toBe(b);
    expect(a).toMatch(/^rule:r1:ord-1:order.paid:\d{4}-\d{2}-\d{2}$/);
  });
});
