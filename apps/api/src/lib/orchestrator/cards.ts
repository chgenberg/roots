import type { DomainId } from "./graph";
import { isGate, type Gate } from "./approvals";
import {
  isCardStatus,
  type CardSource,
  type CardStatus,
  type WorkboardCard,
} from "./workboard-types";

function parseFiles(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export type DbCard = {
  id: string;
  key: string;
  title: string;
  body: string;
  status: string;
  domainId: string;
  playbook: string;
  gate: string;
  filesJson: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
};

/** Drizzle row → workboard card. `id` on the card is `row.key`. */
export function dbCardToWorkboard(row: DbCard): WorkboardCard {
  const status: CardStatus = isCardStatus(row.status) ? row.status : "inbox";
  const gate: Gate = isGate(row.gate) ? row.gate : "none";
  const source: CardSource =
    row.source === "cursor" || row.source === "admin" || row.source === "heartbeat"
      ? row.source
      : "heartbeat";
  return {
    id: row.key,
    title: row.title,
    body: row.body,
    status,
    domainId: row.domainId as DomainId,
    playbook: row.playbook,
    files: parseFiles(row.filesJson),
    gate,
    source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    rejectedAt: row.rejectedAt?.toISOString(),
  };
}
