import { describe, expect, it, vi } from "vitest";

vi.mock("@roots/db", () => ({ db: {} }));
vi.mock("@roots/db/schema", () => ({ reviewerMedia: {} }));

import { parseChat, transcriptFallback } from "./reviewer-llm";

/**
 * Protects the Roots feedback agent: chat replies stay JSON, and the
 * fallback prompt must describe Roots on Railway — not QueenCloud/AWS.
 */
describe("reviewer LLM helpers", () => {
  it("parseChat reads phase + reply and ignores extra text", () => {
    const parsed = parseChat(
      'visst\n{"phase":"ready","reply":"Klicka på Skicka när det stämmer."}\n'
    );
    expect(parsed).toEqual({
      phase: "ready",
      reply: "Klicka på Skicka när det stämmer.",
      cursorPrompt: "",
    });
  });

  it("parseChat defaults unknown phase to ask", () => {
    const parsed = parseChat('{"phase":"maybe","reply":"Vilken sida?"}');
    expect(parsed?.phase).toBe("ask");
  });

  it("transcriptFallback names Roots + Railway, never QueenCloud or Bedrock", () => {
    const text = transcriptFallback([
      { role: "user", body: "Knappen är fel", imageUrls: [] },
    ]);
    expect(text).toContain("Roots");
    expect(text).toContain("Railway");
    expect(text).not.toMatch(/Bedrock|App Runner/i);
  });
});
