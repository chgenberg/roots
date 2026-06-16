import { describe, it, expect } from "vitest";
import { computeCalculator, CALCULATOR_DEFAULTS } from "@roots/contracts";

describe("computeCalculator", () => {
  it("multiplies sellers × avg and applies margin", () => {
    const r = computeCalculator({
      sellers: 25,
      avgPerSellerKr: 1500,
      marginPercent: 25,
    });
    expect(r.grossKr).toBe(37500);
    expect(r.earningsKr).toBe(9375); // 37500 * 0.25
    expect(r.rootsShareKr).toBe(28125);
    expect(r.earningsPerSellerKr).toBe(375); // 9375 / 25
  });

  it("handles zero sellers without dividing by zero", () => {
    const r = computeCalculator({
      sellers: 0,
      avgPerSellerKr: 1500,
      marginPercent: 25,
    });
    expect(r.grossKr).toBe(0);
    expect(r.earningsKr).toBe(0);
    expect(r.earningsPerSellerKr).toBe(0);
  });

  it("clamps margin to 0–100 and floors sellers", () => {
    const r = computeCalculator({
      sellers: 10.9,
      avgPerSellerKr: 1000,
      marginPercent: 250,
    });
    expect(r.sellers).toBe(10);
    expect(r.marginPercent).toBe(100);
    expect(r.grossKr).toBe(10000);
    expect(r.earningsKr).toBe(10000);
    expect(r.rootsShareKr).toBe(0);
  });

  it("computes goal percentage capped at 100", () => {
    const r = computeCalculator({
      sellers: 50,
      avgPerSellerKr: 2000,
      marginPercent: 25,
      goalKr: 10000,
    });
    // gross 100000, earnings 25000, goal 10000 -> 250% capped to 100
    expect(r.earningsKr).toBe(25000);
    expect(r.goalKr).toBe(10000);
    expect(r.goalPct).toBe(100);
  });

  it("returns null goalPct when no goal set", () => {
    const r = computeCalculator({
      sellers: 5,
      avgPerSellerKr: 1000,
      marginPercent: 25,
    });
    expect(r.goalKr).toBeNull();
    expect(r.goalPct).toBeNull();
  });

  it("uses sane defaults", () => {
    const r = computeCalculator(CALCULATOR_DEFAULTS);
    expect(r.grossKr).toBe(37500);
    expect(r.earningsKr).toBe(9375);
  });
});
