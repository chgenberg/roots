import { describe, expect, it } from "vitest";
import {
  mergeCards,
  isWorkboardCard,
  shouldMirrorToFile,
  type WorkboardCard,
} from "./workboard-types";

function card(partial: Partial<WorkboardCard> & Pick<WorkboardCard, "id">): WorkboardCard {
  return {
    title: "t",
    body: "",
    status: "inbox",
    domainId: "admin",
    playbook: "",
    files: [],
    gate: "none",
    source: "cursor",
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    ...partial,
  };
}

describe("mergeCards", () => {
  it("lets the database win on the same id", () => {
    const file = [card({ id: "a", title: "from file", status: "doing" })];
    const db = [
      card({
        id: "a",
        title: "from db",
        status: "inbox",
        source: "heartbeat",
        updatedAt: "2026-09-06T12:00:00.000Z",
      }),
    ];
    const merged = mergeCards(file, db);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("from db");
    expect(merged[0].source).toBe("heartbeat");
  });

  it("keeps file-only cards", () => {
    const merged = mergeCards(
      [card({ id: "wb-1" })],
      [card({ id: "hb-1", source: "heartbeat" })]
    );
    expect(merged.map((c) => c.id).sort()).toEqual(["hb-1", "wb-1"]);
  });
});

describe("shouldMirrorToFile", () => {
  it("keeps Cursor cards out of the database-only heartbeat stream", () => {
    expect(shouldMirrorToFile(card({ id: "wb-1", source: "cursor" }))).toBe(true);
    expect(
      shouldMirrorToFile(card({ id: "email-paused", source: "heartbeat" }))
    ).toBe(false);
    expect(
      shouldMirrorToFile(card({ id: "pending-payouts", source: "admin" }))
    ).toBe(false);
  });
});

describe("isWorkboardCard", () => {
  it("rejects incomplete rows", () => {
    expect(isWorkboardCard({})).toBe(false);
    expect(isWorkboardCard(card({ id: "ok" }))).toBe(true);
  });
});
