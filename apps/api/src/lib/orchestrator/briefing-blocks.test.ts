import { describe, expect, it } from "vitest";
import {
  appendLesson,
  compactHistory,
  formatBriefing,
  parseBriefing,
  stampBlocks,
} from "./briefing-blocks";

describe("briefing-blocks", () => {
  it("round-trips JAG/GÖR/SAKNAS", () => {
    const raw = stampBlocks({
      jag: "Jag vaktar föreningar.",
      gor: "Öppnar kort.",
      saknas: "vem godkänner",
      ready: false,
    });
    const parsed = parseBriefing(raw);
    expect(parsed.jag).toMatch(/föreningar/);
    expect(parsed.klart).toBe(false);
    expect(formatBriefing(parsed)).toMatch(/KLART: nej/);
  });

  it("compacts long chat history", () => {
    const history = [
      { role: "you", text: "a" },
      { role: "agent", text: "b" },
      { role: "you", text: "c" },
      { role: "agent", text: "d" },
      { role: "you", text: "e" },
    ];
    const compact = compactHistory(history, 2);
    expect(compact[0]?.text).toMatch(/Tidigare 3/);
    expect(compact).toHaveLength(3);
  });

  it("appends a lesson once", () => {
    const first = appendLesson("", "Godkände “Kort”.");
    const second = appendLesson(first, "Godkände “Kort”.");
    expect(second.split("Godkände").length).toBe(2);
  });
});
