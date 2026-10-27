import { describe, expect, it, vi } from "vitest";

vi.mock("@roots/db", () => ({ db: {} }));

import { normalizeWebsite, parseBrandInput } from "./club-brand";

// 1×1 genomskinlig PNG.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("parseBrandInput", () => {
  it("accepts colours, a PNG logo and a website", () => {
    const r = parseBrandInput({
      website: "ifkumea.se",
      color: "#1a3c8b",
      colors: ["#1A3C8B", "#ffd200"],
      logo: PNG,
      logoOnDark: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.website).toBe("https://ifkumea.se");
    expect(r.value.color).toBe("#1A3C8B");
    expect(r.value.colors).toEqual(["#1A3C8B", "#FFD200"]);
    expect(r.value.logo?.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(r.value.logoOnDark).toBe(true);
  });

  it("puts the main colour first in the list", () => {
    const r = parseBrandInput({ color: "#112233", colors: ["#445566"] });
    expect(r.ok && r.value.colors).toEqual(["#112233", "#445566"]);
  });

  it("keeps the logo when it is left out and removes it on null", () => {
    const keep = parseBrandInput({ color: "#112233" });
    const drop = parseBrandInput({ color: "#112233", logo: null });
    expect(keep.ok && keep.value.logo).toBeUndefined();
    expect(drop.ok && drop.value.logo).toBeNull();
  });

  it("rejects SVG and other formats than PNG", () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from("<svg onload='x'/>").toString("base64")}`;
    expect(parseBrandInput({ logo: svg })).toEqual({ ok: false, error: "invalidLogo" });
    const fake = `data:image/png;base64,${Buffer.from("<script>").toString("base64")}`;
    expect(parseBrandInput({ logo: fake })).toEqual({ ok: false, error: "invalidLogo" });
  });

  it("rejects colours that are not #RRGGBB", () => {
    expect(parseBrandInput({ color: "red" })).toEqual({ ok: false, error: "invalidColor" });
    expect(parseBrandInput({ colors: ["#12345"] })).toEqual({ ok: false, error: "invalidColor" });
  });

  it("rejects web addresses that are not http(s)", () => {
    expect(parseBrandInput({ website: "javascript:alert(1)" })).toEqual({
      ok: false,
      error: "invalidWebsite",
    });
  });
});

describe("normalizeWebsite", () => {
  it("adds https and drops a trailing slash", () => {
    expect(normalizeWebsite("www.laget.se/IFKUmea/")).toBe("https://www.laget.se/IFKUmea");
    expect(normalizeWebsite("  ")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
  });
});
