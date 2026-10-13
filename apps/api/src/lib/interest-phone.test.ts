import { describe, expect, it } from "vitest";
import { normalizeInterestPhone } from "@roots/contracts";

describe("normalizeInterestPhone", () => {
  it("reads Swedish mobile numbers in the forms people type", () => {
    expect(normalizeInterestPhone("070-123 45 67")).toBe("+46701234567");
    expect(normalizeInterestPhone("0701234567")).toBe("+46701234567");
    expect(normalizeInterestPhone("+46 70 123 45 67")).toBe("+46701234567");
    expect(normalizeInterestPhone("0046701234567")).toBe("+46701234567");
  });

  it("keeps foreign numbers given with a plus", () => {
    expect(normalizeInterestPhone("+47 912 34 567")).toBe("+4791234567");
  });

  it("rejects what is not a phone number", () => {
    expect(normalizeInterestPhone("")).toBeNull();
    expect(normalizeInterestPhone("hej")).toBeNull();
    expect(normalizeInterestPhone("070")).toBeNull();
    expect(normalizeInterestPhone("12345678")).toBeNull();
    expect(normalizeInterestPhone("070-123 45 67 89 01")).toBeNull();
  });
});
