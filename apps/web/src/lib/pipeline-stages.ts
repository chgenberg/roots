import type { PipelineDealKind } from "@roots/contracts";

/**
 * Pipeline stages, shared by the kanban board, the list view and the deal
 * dialog so the three can never disagree on labels or ordering.
 *
 * The board mixes two entity types on purpose:
 *   LEAD  — an `organizations` row that has no quote yet
 *   QUOTE — a `quotes` row, whose `status` is the stage
 *
 * That is why dragging is not a single "set stage" operation, and why
 * `dropIntent()` below exists: crossing the LEAD boundary creates or would
 * have to delete a quote, which is a different action from moving one.
 */

export const ALL_STAGES = [
  "LEAD",
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
] as const;
export type Stage = (typeof ALL_STAGES)[number];

/** The four stages that are backed by `quotes.status`. */
export const QUOTE_STAGES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;

export const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  DRAFT: "Utkast",
  SENT: "Skickad",
  ACCEPTED: "Accepterad",
  REJECTED: "Nekad",
};

export function stageIndex(stage: string): number {
  const i = (ALL_STAGES as readonly string[]).indexOf(stage);
  return i === -1 ? ALL_STAGES.length : i;
}

export function stageBadgeVariant(
  stage: string
): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" {
  switch (stage) {
    case "ACCEPTED":
      return "success";
    case "SENT":
      return "warning";
    case "REJECTED":
      return "destructive";
    case "DRAFT":
      return "outline";
    default:
      return "secondary";
  }
}

/** Whole days since an ISO timestamp, floored at 0. */
export function daysSince(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

export type DropIntent =
  /** Same column — nothing to do. */
  | { type: "noop" }
  /** Move an existing quote: PATCH /quotes/:id/status. */
  | { type: "move-quote"; status: (typeof QUOTE_STAGES)[number] }
  /** Turn a lead into a quote: open the quote dialog prefilled. */
  | { type: "create-quote"; sendNow: boolean }
  /** Not a legal move — `reason` is shown to the rep. */
  | { type: "blocked"; reason: string };

/**
 * What dropping `deal` on `target` should do.
 *
 * Kept as a pure function so the rules are stated once and can be reasoned
 * about (and unit-tested) without a DOM.
 */
export function dropIntent(
  deal: { kind: PipelineDealKind; status: string },
  target: string
): DropIntent {
  if (deal.status === target) return { type: "noop" };

  if (deal.kind === "LEAD") {
    if (target === "DRAFT" || target === "SENT") {
      return { type: "create-quote", sendNow: target === "SENT" };
    }
    // Accepting or rejecting presupposes something to accept or reject.
    // Silently creating an accepted 0 kr quote would corrupt the pipeline
    // value and the rep's commission base, so we stop and say why.
    return {
      type: "blocked",
      reason:
        "Leadet har ingen offert än. Dra det till Utkast eller Skickad för att skapa en offert först.",
    };
  }

  if (target === "LEAD") {
    // A quote exists; a lead is by definition a club without one. Moving
    // left would mean deleting the quote — that is a destructive action and
    // must not be triggered by a drag gesture.
    return {
      type: "blocked",
      reason:
        "Det finns redan en offert för klubben, så den kan inte bli ett lead igen. Ta bort offerten om den skapades av misstag.",
    };
  }

  const status = QUOTE_STAGES.find((s) => s === target);
  if (!status) {
    return { type: "blocked", reason: "Okänt steg." };
  }
  return { type: "move-quote", status };
}
