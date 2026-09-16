import { describe, expect, it } from "vitest";
import {
  actionAllowedForDesk,
  actionsForDesk,
  defaultGateFor,
  deskKeyForRule,
  draftRuleFromText,
} from "./conductor-catalog";

describe("conductor catalog", () => {
  it("drafts a review card for a pending club", () => {
    const draft = draftRuleFromText(
      "När en förening väntar på granskning, öppna ett kort."
    );
    expect(draft.trigger).toBe("org.pending");
    expect(draft.action).toBe("card.open");
    expect(defaultGateFor(draft.action)).toBe("none");
    expect(deskKeyForRule(draft.trigger, draft.action)).toBe("forening");
  });

  it("keeps Fortnox drafts on Pengar and money", () => {
    const draft = draftRuleFromText(
      "När en avräkning är redo, skriv Fortnox-utkast."
    );
    expect(draft.trigger).toBe("settlement.ready");
    expect(draft.action).toBe("fortnox.draft");
    expect(defaultGateFor(draft.action)).toBe("money");
    expect(actionAllowedForDesk("pengar", "Pengar", "fortnox.draft")).toBe(true);
    expect(actionAllowedForDesk("mejl", "Mejl", "fortnox.draft")).toBe(false);
  });

  it("gives Drift only cards and Pengar Fortnox", () => {
    expect(actionsForDesk("drift", "Drift")).toEqual(["card.open"]);
    expect(actionsForDesk("pengar", "Pengar")).toEqual([
      "card.open",
      "fortnox.draft",
    ]);
    expect(actionAllowedForDesk("pengar", "Pengar", "email.draft")).toBe(false);
  });

  it("gates email drafts", () => {
    const draft = draftRuleFromText(
      "När en inbjudan skapas, lägg mejlutkast."
    );
    expect(draft.trigger).toBe("invite.created");
    expect(draft.action).toBe("email.draft");
    expect(defaultGateFor(draft.action)).toBe("email");
  });
});
