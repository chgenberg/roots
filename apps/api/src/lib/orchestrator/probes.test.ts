import { describe, expect, it } from "vitest";
import { isEmailPaused, probeEmailPaused } from "./probes";

describe("isEmailPaused", () => {
  it("reads FEATURE_EMAIL_DISABLED", () => {
    expect(isEmailPaused({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isEmailPaused({ FEATURE_EMAIL_DISABLED: "true" } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(
      isEmailPaused({ FEATURE_EMAIL_DISABLED: "TRUE" } as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});

describe("probeEmailPaused", () => {
  it("opens a card only when mail is paused", async () => {
    const prev = process.env.FEATURE_EMAIL_DISABLED;
    process.env.FEATURE_EMAIL_DISABLED = "true";
    try {
      const seeds = await probeEmailPaused();
      expect(seeds).toHaveLength(1);
      expect(seeds[0].key).toBe("email-paused");
      expect(seeds[0].gate).toBe("email");
    } finally {
      if (prev === undefined) delete process.env.FEATURE_EMAIL_DISABLED;
      else process.env.FEATURE_EMAIL_DISABLED = prev;
    }
  });
});
