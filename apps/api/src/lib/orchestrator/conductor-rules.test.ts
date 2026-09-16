import { describe, expect, it } from "vitest";
import { cardPlan, domainForEvent } from "./conductor-rules";

describe("conductor rules", () => {
  it("opens a board card for card.open", () => {
    const plan = cardPlan({
      action: "card.open",
      ruleId: "r1",
      title: "Ny förening",
      entityId: "org-1",
      event: "org.pending",
    });
    expect(plan.key).toBe("rule-card:r1:org-1");
    expect(plan.gate).toBe("none");
    expect(plan.domainId).toBe("fundraising");
    expect(plan.body).toContain("org-1");
  });

  it("keeps email drafts as drafts", () => {
    const plan = cardPlan({
      action: "email.draft",
      ruleId: "r2",
      title: "Inbjudan",
      entityId: "inv-1",
      event: "invite.created",
    });
    expect(plan.key).toBe("email-draft:r2:inv-1");
    expect(plan.gate).toBe("email");
    expect(plan.domainId).toBe("email");
    expect(plan.body).toMatch(/Inget skickat/);
    expect(plan.body).not.toMatch(/skickades|skickar mejl/i);
  });

  it("keeps Fortnox drafts as drafts with money gate", () => {
    const plan = cardPlan({
      action: "fortnox.draft",
      ruleId: "r3",
      title: "Avräkning",
      entityId: "camp-1",
      event: "settlement.ready",
    });
    expect(plan.key).toBe("fortnox-draft:r3:camp-1");
    expect(plan.gate).toBe("money");
    expect(plan.domainId).toBe("money");
    expect(plan.body).toMatch(/Inget skickat till Fortnox/);
  });

  it("maps events to domains without money on shop orders", () => {
    expect(domainForEvent("order.paid", "card.open")).toBe("shop");
    expect(domainForEvent("payout.pending", "fortnox.draft")).toBe("money");
    expect(domainForEvent("email.paused", "email.draft")).toBe("email");
    expect(domainForEvent("job.stale", "card.open")).toBe("admin");
  });
});
