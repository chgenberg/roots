import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./root";
import {
  isWorkboardCard,
  type CardStatus,
  type Workboard,
  type WorkboardCard,
} from "./workboard-types";

export type {
  CardSource,
  CardStatus,
  Workboard,
  WorkboardCard,
} from "./workboard-types";
export {
  CARD_STATUSES,
  isCardStatus,
  isWorkboardCard,
  mergeCards,
} from "./workboard-types";

const WORKBOARD_REL = "apps/api/src/lib/orchestrator/workboard.json";

export function workboardPath(root = repoRoot()): string {
  return path.join(root, WORKBOARD_REL);
}

const EMPTY: Workboard = { updatedAt: new Date(0).toISOString(), cards: [] };

export async function loadWorkboard(root = repoRoot()): Promise<Workboard> {
  try {
    const raw = await readFile(workboardPath(root), "utf8");
    const parsed = JSON.parse(raw) as Workboard;
    if (!parsed || !Array.isArray(parsed.cards)) return EMPTY;
    return {
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : EMPTY.updatedAt,
      cards: parsed.cards.filter(isWorkboardCard),
    };
  } catch {
    return EMPTY;
  }
}

export async function saveWorkboard(
  board: Workboard,
  root = repoRoot()
): Promise<void> {
  const next: Workboard = {
    updatedAt: new Date().toISOString(),
    cards: board.cards,
  };
  await writeFile(workboardPath(root), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function moveCard(
  board: Workboard,
  id: string,
  status: CardStatus
): Workboard {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    cards: board.cards.map((c) =>
      c.id === id ? { ...c, status, updatedAt: now } : c
    ),
  };
}

export function upsertCard(board: Workboard, card: WorkboardCard): Workboard {
  const now = new Date().toISOString();
  const idx = board.cards.findIndex((c) => c.id === card.id);
  const next = { ...card, updatedAt: now };
  if (idx === -1) {
    return { updatedAt: now, cards: [next, ...board.cards] };
  }
  const cards = board.cards.slice();
  cards[idx] = { ...cards[idx], ...next };
  return { updatedAt: now, cards };
}
