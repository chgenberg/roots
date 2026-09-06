import type { DomainId } from "./graph";
import { isGate, type Gate } from "./approvals";

export type CardStatus = "inbox" | "ready" | "doing" | "blocked" | "done";

export const CARD_STATUSES: CardStatus[] = [
  "inbox",
  "ready",
  "doing",
  "blocked",
  "done",
];

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as string[]).includes(value);
}

export type CardSource = "cursor" | "heartbeat" | "admin";

export type WorkboardCard = {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  domainId: DomainId;
  playbook: string;
  files: string[];
  gate: Gate;
  source: CardSource;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
};

export type Workboard = {
  updatedAt: string;
  cards: WorkboardCard[];
};

export function isWorkboardCard(value: unknown): value is WorkboardCard {
  if (!value || typeof value !== "object") return false;
  const c = value as WorkboardCard;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    isCardStatus(c.status) &&
    isGate(c.gate) &&
    typeof c.domainId === "string"
  );
}

/** Cursor-historik i git. Heartbeat-kort hör bara i databasen. */
export function shouldMirrorToFile(card: WorkboardCard): boolean {
  return card.source === "cursor" || card.id.startsWith("wb-");
}

/** Database wins on the same id. */
export function mergeCards(
  fileCards: WorkboardCard[],
  dbCards: WorkboardCard[]
): WorkboardCard[] {
  const map = new Map<string, WorkboardCard>();
  for (const c of fileCards) map.set(c.id, c);
  for (const c of dbCards) map.set(c.id, c);
  return [...map.values()].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );
}
