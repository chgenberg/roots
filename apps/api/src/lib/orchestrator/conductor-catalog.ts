/**
 * Dirigenten — sluten katalog för Roots: När → gör → grind.
 * Deploy, lyft av mejlpaus, PAID och Fortnox-skick finns inte som åtgärder.
 */

import type { Gate } from "./approvals";

export const CONDUCTOR_EVENTS = [
  "org.pending",
  "invite.created",
  "order.created",
  "order.paid",
  "order.failed",
  "settlement.ready",
  "payout.pending",
  "email.paused",
  "job.stale",
  "calculator.lead",
  "campaign.ended",
] as const;

export type ConductorEvent = (typeof CONDUCTOR_EVENTS)[number];

export const CONDUCTOR_ACTIONS = [
  "card.open",
  "email.draft",
  "fortnox.draft",
] as const;

export type ConductorAction = (typeof CONDUCTOR_ACTIONS)[number];

export function isConductorEvent(v: string): v is ConductorEvent {
  return (CONDUCTOR_EVENTS as readonly string[]).includes(v);
}

export function isConductorAction(v: string): v is ConductorAction {
  return (CONDUCTOR_ACTIONS as readonly string[]).includes(v);
}

export function eventLabel(event: string): string {
  const map: Record<ConductorEvent, string> = {
    "org.pending": "en förening väntar på granskning",
    "invite.created": "en inbjudan skapas",
    "order.created": "en order läggs",
    "order.paid": "en order blir betald",
    "order.failed": "en betalning misslyckas",
    "settlement.ready": "en avräkning är redo",
    "payout.pending": "en utbetalning väntar",
    "email.paused": "mejlpausen är på",
    "job.stale": "ett jobb tystnar",
    "calculator.lead": "någon lämnar en kalkyl-lead",
    "campaign.ended": "en kampanj avslutas",
  };
  return isConductorEvent(event) ? map[event] : event;
}

export function actionLabel(action: string): string {
  if (action === "email.draft") return "lägg mejlutkast";
  if (action === "fortnox.draft") return "lägg Fortnox-utkast";
  return "öppna ett kort";
}

export function defaultGateFor(action: ConductorAction): Gate {
  if (action === "email.draft") return "email";
  if (action === "fortnox.draft") return "irreversible";
  return "none";
}

export function actionsForDesk(key: string, name: string): ConductorAction[] {
  const hay = `${key} ${name}`.toLowerCase();
  if (key === "pengar" || /pengar|bokför|fortnox/.test(hay)) {
    return ["card.open", "fortnox.draft"];
  }
  if (key === "drift" || /drift|heartbeat|grind/.test(hay)) {
    return ["card.open"];
  }
  if (key === "mejl" || /mejl/.test(hay)) {
    return ["card.open", "email.draft"];
  }
  return ["card.open", "email.draft"];
}

export function actionAllowedForDesk(
  key: string,
  name: string,
  action: ConductorAction
): boolean {
  return actionsForDesk(key, name).includes(action);
}

export function toolNoteForDesk(key: string, name: string): string {
  const allowed = actionsForDesk(key, name).join(", ");
  if (key === "pengar" || /pengar|bokför|fortnox/.test(`${key} ${name}`)) {
    return `Verktyg: ${allowed}. Fortnox är utkast. PAID och bank trycks inte.`;
  }
  if (key === "drift") {
    return `Verktyg: ${allowed}. Aldrig deploy.`;
  }
  if (key === "mejl") {
    return `Verktyg: ${allowed}. Mejl går inte ut. Mejlpausen lyfts inte.`;
  }
  return `Verktyg: ${allowed}. Inget går ut förrän Godkänn.`;
}

export function deskKeyForRule(trigger: string, action: string): string {
  if (action === "fortnox.draft" || trigger.startsWith("payout.") || trigger.startsWith("settlement.")) {
    return "pengar";
  }
  if (trigger.startsWith("email.") || action === "email.draft") return "mejl";
  if (trigger.startsWith("order.") || trigger === "campaign.ended") return "orderliv";
  if (trigger === "org.pending" || trigger === "invite.created") return "forening";
  if (trigger === "calculator.lead") return "forening";
  return "drift";
}

export type DraftRule = {
  title: string;
  trigger: ConductorEvent;
  action: ConductorAction;
  filter: Record<string, unknown>;
  actionJson: Record<string, unknown>;
};

export function draftRuleFromText(text: string): DraftRule {
  const lower = text.toLowerCase();
  let trigger: ConductorEvent = "order.created";
  if (/gransk|godkänn fören|ny fören|org.?pending|väntar på/.test(lower)) {
    trigger = "org.pending";
  } else if (/inbjud|invite/.test(lower)) {
    trigger = "invite.created";
  } else if (/betald|paid|kvitto/.test(lower)) {
    trigger = "order.paid";
  } else if (/misslyck|fail/.test(lower)) {
    trigger = "order.failed";
  } else if (/avräkn|settlement/.test(lower)) {
    trigger = "settlement.ready";
  } else if (/utbetal/.test(lower)) {
    trigger = "payout.pending";
  } else if (/mejlpaus|email.?paus/.test(lower)) {
    trigger = "email.paused";
  } else if (/jobb|cron|stale/.test(lower)) {
    trigger = "job.stale";
  } else if (/kalkyl|lead/.test(lower)) {
    trigger = "calculator.lead";
  } else if (/kampanj.*(slut|klar|avslut)/.test(lower)) {
    trigger = "campaign.ended";
  } else if (/order|kassa|beställ/.test(lower)) {
    trigger = "order.created";
  }

  let action: ConductorAction = "card.open";
  if (/fortnox|bokför/.test(lower)) action = "fortnox.draft";
  else if (/mejl|mail|skicka mall|utkast.*mejl/.test(lower)) action = "email.draft";

  const title = text.trim().replace(/\s+/g, " ").slice(0, 80) || "Nytt uppdrag";
  return {
    title,
    trigger,
    action,
    filter: {},
    actionJson: action === "card.open" ? { title } : {},
  };
}
