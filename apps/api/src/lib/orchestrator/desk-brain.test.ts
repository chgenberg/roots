import { describe, expect, it } from "vitest";
import {
  asDraft,
  parseDeskOut,
  parseJsonObject,
  scrubDeskText,
} from "./desk-brain";
import { guardDraft, guardDrafts } from "./desk-guard";

describe("desk-brain parse", () => {
  it("reads JSON even when wrapped in prose", () => {
    const obj = parseJsonObject('Visst. {"reply":"Jag är Förening.","ready":false}');
    expect(obj?.reply).toMatch(/Förening/);
  });

  it("scrubs model names and AI", () => {
    expect(scrubDeskText("AI:n Grok säger ja")).toBe("agenten agenten säger ja");
  });

  it("accepts catalog drafts only", () => {
    expect(
      asDraft({
        title: "Kort vid ny förening",
        trigger: "org.pending",
        action: "card.open",
      })
    ).toEqual({
      title: "Kort vid ny förening",
      trigger: "org.pending",
      action: "card.open",
    });
    expect(
      asDraft({
        title: "Skicka Fortnox",
        trigger: "settlement.ready",
        action: "fortnox.send",
      })
    ).toBeNull();
  });

  it("keeps drafts off until ready and allowed", () => {
    const out = parseDeskOut(
      {
        reply: "Jag är Pengar. Vad ska i utkastet?",
        ready: false,
        drafts: [
          {
            title: "Fortnox vid avräkning",
            trigger: "settlement.ready",
            action: "fortnox.draft",
          },
        ],
        questions: ["Vad ska i utkastet?"],
      },
      "",
      ["card.open", "fortnox.draft"],
      { model: "test", tokens: 12 },
      "pengar"
    );
    expect(out?.ready).toBe(false);
    expect(out?.drafts).toEqual([]);
    expect(out?.reply).toMatch(/Pengar/);
  });

  it("keeps a ready draft on Pengar", () => {
    const out = parseDeskOut(
      {
        reply: "Jag lägger Fortnox-utkast när avräkningen är redo.",
        ready: true,
        questions: [],
        drafts: [
          {
            title: "Fortnox vid avräkning",
            trigger: "settlement.ready",
            action: "fortnox.draft",
          },
        ],
      },
      "",
      ["card.open", "fortnox.draft"],
      { model: "test", tokens: 9 },
      "pengar"
    );
    expect(out?.ready).toBe(true);
    expect(out?.drafts).toHaveLength(1);
  });
});

describe("desk-guard", () => {
  it("blocks PAID, deploy and mejlpaus", () => {
    expect(guardDraft("Tryck PAID på utbetalningen").ok).toBe(false);
    expect(guardDraft("Deploya till main").ok).toBe(false);
    expect(guardDraft("Lyft mejlpaus").ok).toBe(false);
    expect(guardDraft("När en förening väntar, öppna ett kort").ok).toBe(true);
  });

  it("blocks Fortnox-skick but not a draft title", () => {
    expect(guardDraft("Skicka till Fortnox nu").ok).toBe(false);
    expect(guardDrafts([{ title: "Fortnox-utkast vid avräkning" }]).ok).toBe(
      true
    );
  });
});
