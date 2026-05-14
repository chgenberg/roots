import { describe, expect, it } from "vitest";
import {
  buildRiksCodeMap,
  buildSegmentCodeIndex,
  parseCsv,
  parseCsvLine,
  riksRowSchema,
  segmentRowSchema,
  slugify,
  uniqueSlug,
} from "./util";

describe("parseCsvLine", () => {
  it("splits simple commas", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted values with commas", () => {
    expect(parseCsvLine('a,"b, c",d')).toEqual(["a", "b, c", "d"]);
  });

  it("handles escaped double-quotes", () => {
    expect(parseCsvLine('"hello ""world""",x')).toEqual([
      'hello "world"',
      "x",
    ]);
  });

  it("returns empty cells for trailing commas", () => {
    expect(parseCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("parseCsv with zod", () => {
  it("validates a riksorganisation block", () => {
    const csv = [
      "Riksorganisation,Typ av Riksorganisation",
      "Alpha,Idrott",
      'Beta,"Bistånd / Internationellt"',
    ].join("\n");
    const rows = parseCsv(csv, riksRowSchema);
    expect(rows).toEqual([
      { Riksorganisation: "Alpha", "Typ av Riksorganisation": "Idrott" },
      {
        Riksorganisation: "Beta",
        "Typ av Riksorganisation": "Bistånd / Internationellt",
      },
    ]);
  });

  it("rejects rows missing required fields", () => {
    const csv = ["Riksorganisation,Typ av Riksorganisation", ",Idrott"].join(
      "\n"
    );
    expect(() => parseCsv(csv, riksRowSchema)).toThrow(/validation failed/);
  });

  it("parses segment rows", () => {
    const csv = [
      "Riksorganisation,Segment / Förbund,Typ",
      "Riksidrottsförbundet,Fotboll,Idrott",
      "Riksidrottsförbundet,Innebandy,Idrott",
    ].join("\n");
    const rows = parseCsv(csv, segmentRowSchema);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Segment / Förbund"]).toBe("Fotboll");
  });
});

describe("slugify", () => {
  it("normalises Swedish diacritics", () => {
    expect(slugify("Riksidrottsförbundet")).toBe("riksidrottsforbundet");
    expect(slugify("Hörselskadades Riksförbund")).toBe(
      "horselskadades-riksforbund"
    );
  });

  it("collapses non-alphanum runs to a single dash", () => {
    expect(slugify("Foo / Bar — Baz")).toBe("foo-bar-baz");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("—Foo—")).toBe("foo");
  });

  it("clamps length", () => {
    const long = "a".repeat(120);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when unused", () => {
    const taken = new Set<string>();
    expect(uniqueSlug("alpha", taken)).toBe("alpha");
    expect(taken.has("alpha")).toBe(true);
  });

  it("suffixes on collision", () => {
    const taken = new Set<string>(["alpha"]);
    expect(uniqueSlug("alpha", taken)).toBe("alpha-2");
    expect(uniqueSlug("alpha", taken)).toBe("alpha-3");
  });

  it("falls back to 'row' on empty input", () => {
    expect(uniqueSlug("", new Set())).toBe("row");
  });
});

describe("buildRiksCodeMap", () => {
  it("produces stable, unique codes per name", () => {
    const map = buildRiksCodeMap([
      { Riksorganisation: "Alpha", "Typ av Riksorganisation": "" },
      { Riksorganisation: "Alpha2", "Typ av Riksorganisation": "" },
      { Riksorganisation: "Beta — Något", "Typ av Riksorganisation": "" },
    ]);
    expect(map.get("Alpha")).toBe("alpha");
    expect(map.get("Alpha2")).toBe("alpha2");
    expect(map.get("Beta — Något")).toBe("beta-nagot");
  });

  it("handles duplicate canonical names with suffixes", () => {
    const map = buildRiksCodeMap([
      { Riksorganisation: "Alpha", "Typ av Riksorganisation": "" },
      // Same slug due to diacritics, treated as a second row by caller.
      { Riksorganisation: "Älphå", "Typ av Riksorganisation": "" },
    ]);
    expect(map.get("Alpha")).toBe("alpha");
    expect(map.get("Älphå")).toBe("alpha-2");
  });
});

describe("buildSegmentCodeIndex", () => {
  it("scopes segment codes per riksorganisation and flags unknowns", () => {
    const known = ["Riksidrottsförbundet", "Sveriges Schackförbund"];
    const { perRiks, unknownRiks } = buildSegmentCodeIndex(
      [
        {
          Riksorganisation: "Riksidrottsförbundet",
          "Segment / Förbund": "Fotboll",
          Typ: "Idrott",
        },
        {
          Riksorganisation: "Riksidrottsförbundet",
          "Segment / Förbund": "Innebandy",
          Typ: "Idrott",
        },
        {
          Riksorganisation: "Sveriges Schackförbund",
          "Segment / Förbund": "Schack",
          Typ: "Idrott",
        },
        {
          Riksorganisation: "Okänd",
          "Segment / Förbund": "Vilse",
          Typ: "",
        },
      ],
      known
    );
    expect(perRiks.get("Riksidrottsförbundet")?.get("Fotboll")).toBe("fotboll");
    expect(perRiks.get("Riksidrottsförbundet")?.get("Innebandy")).toBe(
      "innebandy"
    );
    expect(perRiks.get("Sveriges Schackförbund")?.get("Schack")).toBe("schack");
    expect(unknownRiks).toEqual(["Okänd"]);
  });

  it("reuses the same code for duplicate (riks, segment) rows", () => {
    // Real CSV exports occasionally emit the same logical segment twice
    // (e.g. when re-exported from Excel with a header repeat). The earlier
    // implementation would silently rewrite the first row's code to
    // "fotboll-2" because it treated the duplicate as a slug collision.
    const { perRiks } = buildSegmentCodeIndex(
      [
        {
          Riksorganisation: "Riksidrottsförbundet",
          "Segment / Förbund": "Fotboll",
          Typ: "Idrott",
        },
        {
          Riksorganisation: "Riksidrottsförbundet",
          "Segment / Förbund": "Fotboll",
          Typ: "Idrott",
        },
      ],
      ["Riksidrottsförbundet"]
    );
    expect(perRiks.get("Riksidrottsförbundet")?.get("Fotboll")).toBe("fotboll");
    expect(perRiks.get("Riksidrottsförbundet")?.size).toBe(1);
  });

  it("suffixes real slug collisions (different segment names → same slug)", () => {
    // Two genuinely different segments under the same riks that happen to
    // produce the same slug must get suffixed.
    const { perRiks } = buildSegmentCodeIndex(
      [
        {
          Riksorganisation: "Alpha",
          "Segment / Förbund": "Foo Bar",
          Typ: "",
        },
        {
          Riksorganisation: "Alpha",
          "Segment / Förbund": "Foo-Bar",
          Typ: "",
        },
      ],
      ["Alpha"]
    );
    expect(perRiks.get("Alpha")?.get("Foo Bar")).toBe("foo-bar");
    expect(perRiks.get("Alpha")?.get("Foo-Bar")).toBe("foo-bar-2");
  });

  it("isolates code namespaces between different riksorganisations", () => {
    // Same segment name in two different riks gets the SAME code — collisions
    // are detected per-(riksorganisation_id, code), not globally.
    const { perRiks } = buildSegmentCodeIndex(
      [
        {
          Riksorganisation: "Alpha",
          "Segment / Förbund": "Fotboll",
          Typ: "",
        },
        {
          Riksorganisation: "Beta",
          "Segment / Förbund": "Fotboll",
          Typ: "",
        },
      ],
      ["Alpha", "Beta"]
    );
    expect(perRiks.get("Alpha")?.get("Fotboll")).toBe("fotboll");
    expect(perRiks.get("Beta")?.get("Fotboll")).toBe("fotboll");
  });
});
