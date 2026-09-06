/**
 * Hard gates. The brain may propose; Hands only run when this says ok.
 * irreversible is never ok. Deploy and money need an explicit human yes.
 */

export type Gate = "none" | "deploy" | "irreversible" | "email" | "money";

export const GATES: Gate[] = ["none", "deploy", "irreversible", "email", "money"];

export function isGate(value: string): value is Gate {
  return (GATES as string[]).includes(value);
}

export type ApprovalInput = {
  gate: Gate;
  explicitYes?: boolean;
  bugHuntClean?: boolean;
  emailPaused?: boolean;
};

export type ApprovalDecision = {
  ok: boolean;
  reason: string;
};

export function canExecute(input: ApprovalInput): ApprovalDecision {
  switch (input.gate) {
    case "none":
      return { ok: true, reason: "Ingen grind." };
    case "irreversible":
      return {
        ok: false,
        reason: "Förbjuden knapp. Alltid människa i Fortnox eller banken.",
      };
    case "deploy":
      if (!input.bugHuntClean) {
        return {
          ok: false,
          reason: "Deploy kräver bug-hunt utan CRITICAL eller HIGH.",
        };
      }
      if (!input.explicitYes) {
        return { ok: false, reason: "Deploy kräver explicit ja." };
      }
      return { ok: true, reason: "Bug-hunt ren och ja mottaget." };
    case "email":
      if (input.emailPaused) {
        return {
          ok: false,
          reason: "Mejl är pausade. Skicka inte.",
        };
      }
      if (!input.explicitYes) {
        return { ok: false, reason: "Mejl med grind kräver explicit ja." };
      }
      return { ok: true, reason: "Mejl tillåtet." };
    case "money":
      if (!input.explicitYes) {
        return {
          ok: false,
          reason: "Pengar kräver explicit ja.",
        };
      }
      return { ok: true, reason: "Pengar tillåtna efter ja." };
    default:
      return { ok: false, reason: "Okänd grind." };
  }
}

export function gateLabel(gate: Gate): string {
  switch (gate) {
    case "none":
      return "Ingen";
    case "deploy":
      return "Deploy";
    case "irreversible":
      return "Låst";
    case "email":
      return "Mejl";
    case "money":
      return "Pengar";
  }
}
