import { describe, expect, it } from "vitest";
import {
  matchRiksorganisation,
  normalizeName,
  normalizeWithoutClubSuffix,
} from "./normalize";

describe("normalizeName", () => {
  it("strips diacritics and lowercases via sv-SE locale", () => {
    expect(normalizeName("IFK Göteborg")).toBe("ifk goteborg");
    expect(normalizeName("Hörselskadades Riksförbund")).toBe(
      "horselskadades riksforbund"
    );
    expect(normalizeName("Åre IF")).toBe("are if");
  });

  it("normalises punctuation and collapses whitespace", () => {
    expect(normalizeName("  P-10 / Svart  ")).toBe("p 10 svart");
    expect(normalizeName("AIK\u00A0Fotboll")).toBe("aik fotboll"); // NBSP
  });

  it("returns '' for nullish input", () => {
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
  });

  it("is idempotent", () => {
    const a = normalizeName("Linköpings FF — F-12 Vit!");
    const b = normalizeName(a);
    expect(a).toBe(b);
  });
});

describe("normalizeWithoutClubSuffix", () => {
  it("removes common Swedish club suffixes after normalisation", () => {
    expect(normalizeWithoutClubSuffix("IFK Göteborg FK")).toBe("goteborg");
    expect(normalizeWithoutClubSuffix("Malmö FF")).toBe("malmo");
  });

  it("keeps unrelated tokens intact", () => {
    expect(normalizeWithoutClubSuffix("Sveriges Schackförbund")).toBe(
      "sveriges schackforbund"
    );
  });

  it("returns '' for nullish input", () => {
    expect(normalizeWithoutClubSuffix(undefined)).toBe("");
  });
});

describe("matchRiksorganisation", () => {
  const candidates = [
    { id: "rid-1", normalizedName: normalizeName("Riksidrottsförbundet") },
    {
      id: "rid-2",
      normalizedName: normalizeName("Sveriges Schackförbund"),
    },
    { id: "rid-3", normalizedName: normalizeName("Friluftsfrämjandet") },
  ];

  it("matches by national_federation when present", () => {
    const res = matchRiksorganisation(
      {
        nationalFederation: "Riksidrottsförbundet",
        name: "IFK Göteborg",
      },
      candidates
    );
    expect(res).toEqual({
      riksorganisationId: "rid-1",
      matchedOn: "national_federation",
    });
  });

  it("falls back to name match", () => {
    const res = matchRiksorganisation(
      { nationalFederation: "", name: "Friluftsfrämjandet" },
      candidates
    );
    expect(res).toEqual({ riksorganisationId: "rid-3", matchedOn: "name" });
  });

  it("returns null for no match", () => {
    const res = matchRiksorganisation(
      { nationalFederation: "Okänt Förbund", name: "IFK Göteborg" },
      candidates
    );
    expect(res).toEqual({ riksorganisationId: null, matchedOn: null });
  });

  it("returns null when candidate set is empty", () => {
    const res = matchRiksorganisation(
      { nationalFederation: "Riksidrottsförbundet" },
      []
    );
    expect(res).toEqual({ riksorganisationId: null, matchedOn: null });
  });
});
