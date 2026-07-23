import { describe, it, expect } from "vitest";
import { stockholmDateIso } from "./date";

describe("stockholmDateIso", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(stockholmDateIso(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-15");
  });

  it("rolls to the local day during summer (CEST, +02:00)", () => {
    // 2026-07-15 22:30 UTC = 2026-07-16 00:30 i Stockholm.
    expect(stockholmDateIso(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
  });

  it("rolls to the local day during winter (CET, +01:00)", () => {
    // 2026-01-15 23:30 UTC = 2026-01-16 00:30 i Stockholm.
    expect(stockholmDateIso(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("does not roll before local midnight", () => {
    // 2026-07-15 21:30 UTC = 2026-07-15 23:30 i Stockholm.
    expect(stockholmDateIso(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-15");
  });
});
