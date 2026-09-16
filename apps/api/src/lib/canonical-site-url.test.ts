import { describe, expect, it } from "vitest";
import {
  CANONICAL_SITE_ORIGIN,
  DEV_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "@roots/contracts";

describe("resolveCanonicalSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL and strips trailing slash", () => {
    expect(
      resolveCanonicalSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://preview.example/",
      })
    ).toBe("https://preview.example");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over SITE_URL", () => {
    expect(
      resolveCanonicalSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://a.example",
        SITE_URL: "https://b.example",
      })
    ).toBe("https://a.example");
  });

  it("falls back to roots.nu in production", () => {
    expect(resolveCanonicalSiteUrl({ NODE_ENV: "production" })).toBe(
      CANONICAL_SITE_ORIGIN
    );
  });

  it("falls back to local web port outside production", () => {
    expect(resolveCanonicalSiteUrl({ NODE_ENV: "development" })).toBe(
      DEV_SITE_ORIGIN
    );
  });
});
