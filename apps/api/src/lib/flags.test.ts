import { afterEach, describe, expect, it } from "vitest";
import { featureOn, flags, isEnabled } from "./flags";

describe("isEnabled", () => {
  afterEach(() => {
    delete process.env.CUSTOM_TEST_FLAG;
  });

  it("defaults when unset", () => {
    expect(isEnabled("CUSTOM_TEST_FLAG", false)).toBe(false);
    expect(isEnabled("CUSTOM_TEST_FLAG", true)).toBe(true);
  });

  it("treats on/1/true/yes as true", () => {
    for (const v of ["on", "ON", "1", "true", "yes"]) {
      process.env.CUSTOM_TEST_FLAG = v;
      expect(isEnabled("CUSTOM_TEST_FLAG", false)).toBe(true);
    }
  });
});

describe("featureOn", () => {
  afterEach(() => {
    delete process.env.FEATURE_ROLLOUT_TEST;
    delete process.env.FEATURE_ROLLOUT_TEST_ORGS;
  });

  it("is off when base flag missing", () => {
    expect(featureOn("ROLLOUT_TEST")).toBe(false);
  });

  it("is on globally when ORGS unset", () => {
    process.env.FEATURE_ROLLOUT_TEST = "on";
    expect(featureOn("ROLLOUT_TEST")).toBe(true);
    expect(featureOn("ROLLOUT_TEST", { orgId: "any" })).toBe(true);
  });

  it("requires org in list when ORGS set", () => {
    process.env.FEATURE_ROLLOUT_TEST = "on";
    process.env.FEATURE_ROLLOUT_TEST_ORGS = "org-a, org-b";
    expect(featureOn("ROLLOUT_TEST", { orgId: "org-a" })).toBe(true);
    expect(featureOn("ROLLOUT_TEST", { orgId: "org-c" })).toBe(false);
    expect(featureOn("ROLLOUT_TEST")).toBe(false);
  });

  it("normalizes feature name", () => {
    process.env.FEATURE_NEW_ORG_HIERARCHY = "1";
    expect(featureOn("NEW_ORG_HIERARCHY")).toBe(true);
    expect(flags.newOrgHierarchy()).toBe(true);
  });
});
