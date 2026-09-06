import { describe, expect, it } from "vitest";
import { canExecute, isGate } from "./approvals";

describe("canExecute", () => {
  it("allows none", () => {
    expect(canExecute({ gate: "none" }).ok).toBe(true);
  });

  it("never allows irreversible", () => {
    const d = canExecute({ gate: "irreversible", explicitYes: true });
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/Fortnox|banken/i);
  });

  it("blocks deploy without bug-hunt and yes", () => {
    expect(canExecute({ gate: "deploy" }).ok).toBe(false);
    expect(canExecute({ gate: "deploy", bugHuntClean: true }).ok).toBe(false);
    expect(
      canExecute({ gate: "deploy", bugHuntClean: true, explicitYes: true }).ok
    ).toBe(true);
  });

  it("blocks email while paused", () => {
    expect(
      canExecute({ gate: "email", explicitYes: true, emailPaused: true }).ok
    ).toBe(false);
    expect(canExecute({ gate: "email", explicitYes: true }).ok).toBe(true);
  });

  it("requires yes for money", () => {
    expect(canExecute({ gate: "money" }).ok).toBe(false);
    expect(canExecute({ gate: "money", explicitYes: true }).ok).toBe(true);
  });

  it("recognises gates", () => {
    expect(isGate("money")).toBe(true);
    expect(isGate("koppla")).toBe(false);
  });
});
