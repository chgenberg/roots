import { canExecute } from "./approvals";
import { isGate } from "./approvals";
import { publicGraph } from "./graph";
import { tryFixKey } from "./hands";
import { excerptMemory, readMemory } from "./memory";
import { isEmailPaused } from "./probes";
import { readPulse } from "./pulse";
import { latestHeartbeatRun } from "./store";
import {
  findCardByKey,
  listDbCards,
  tablesMissing,
  updateCardFields,
  wireOrchestratorStore,
} from "./store";
import { loadWorkboard, saveWorkboard, upsertCard } from "./workboard";
import {
  isCardStatus,
  mergeCards,
  shouldMirrorToFile,
  type CardStatus,
  type WorkboardCard,
} from "./workboard-types";
import { dbCardToWorkboard } from "./cards";

export type OrchestratorBoard = {
  cards: WorkboardCard[];
  memoryExcerpt: string;
  lastRun: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    status: string;
    summary: string;
    findings: number;
  } | null;
  graph: ReturnType<typeof publicGraph>;
  pulse: Partial<Record<string, number>>;
};

export async function loadOrchestratorBoard(): Promise<OrchestratorBoard> {
  wireOrchestratorStore();
  const [fileBoard, dbCards, memory, lastRun, pulse] = await Promise.all([
    loadWorkboard(),
    listDbCards(),
    readMemory(),
    latestHeartbeatRun(),
    readPulse(),
  ]);

  return {
    cards: mergeCards(fileBoard.cards, dbCards),
    memoryExcerpt: excerptMemory(memory.body),
    lastRun: lastRun
      ? {
          id: lastRun.id,
          startedAt: lastRun.startedAt.toISOString(),
          endedAt: lastRun.endedAt?.toISOString() ?? null,
          status: lastRun.status,
          summary: lastRun.summary,
          findings: lastRun.findings,
        }
      : null,
    graph: publicGraph(),
    pulse,
  };
}

export type AdminAction = "approve" | "reject" | "move";

export type AdminPatchResult =
  | { ok: true; card: WorkboardCard }
  | { ok: false; status: 400 | 404 | 500; error: string };

async function persistFileMirror(card: WorkboardCard): Promise<void> {
  if (!shouldMirrorToFile(card)) return;
  try {
    const board = await loadWorkboard();
    await saveWorkboard(upsertCard(board, card));
  } catch {
    // Prod filesystem is often read-only. Database is the source of truth.
  }
}

export async function applyAdminAction(input: {
  id: string;
  action: AdminAction;
  status?: string;
}): Promise<AdminPatchResult> {
  wireOrchestratorStore();
  const key = input.id.trim();
  if (!key) return { ok: false, status: 400, error: "orchestratorInvalidAction" };

  try {
    const row = await findCardByKey(key);
    if (!row) return { ok: false, status: 404, error: "orchestratorCardNotFound" };

    if (input.action === "move") {
      if (!input.status || !isCardStatus(input.status)) {
        return { ok: false, status: 400, error: "orchestratorInvalidAction" };
      }
      await updateCardFields(key, { status: input.status });
      const next = await findCardByKey(key);
      if (!next) return { ok: false, status: 404, error: "orchestratorCardNotFound" };
      const card = dbCardToWorkboard(next);
      await persistFileMirror(card);
      return { ok: true, card };
    }

    if (input.action === "reject") {
      const body = row.body.includes("Avvisat i admin.")
        ? row.body
        : `${row.body}\n\nAvvisat i admin.`;
      await updateCardFields(key, {
        status: "done",
        rejectedAt: new Date(),
        body,
      });
      const next = await findCardByKey(key);
      if (!next) return { ok: false, status: 404, error: "orchestratorCardNotFound" };
      const card = dbCardToWorkboard(next);
      await persistFileMirror(card);
      return { ok: true, card };
    }

    const gate = isGate(row.gate) ? row.gate : "none";
    if (gate === "irreversible" || gate === "deploy") {
      const note =
        "Godkänt i admin, men grind körs aldrig från knappen.";
      const body = row.body.includes(note) ? row.body : `${row.body}\n\n${note}`;
      await updateCardFields(key, {
        status: "blocked" satisfies CardStatus,
        approvedAt: new Date(),
        body,
      });
      const next = await findCardByKey(key);
      if (!next) return { ok: false, status: 404, error: "orchestratorCardNotFound" };
      const card = dbCardToWorkboard(next);
      await persistFileMirror(card);
      return { ok: true, card };
    }

    const decision = canExecute({
      gate,
      explicitYes: true,
      emailPaused: isEmailPaused(),
    });
    if (!decision.ok) {
      const body = row.body.includes(decision.reason)
        ? row.body
        : `${row.body}\n\n${decision.reason}`;
      await updateCardFields(key, {
        status: "blocked",
        approvedAt: new Date(),
        body,
      });
      const next = await findCardByKey(key);
      if (!next) return { ok: false, status: 404, error: "orchestratorCardNotFound" };
      const card = dbCardToWorkboard(next);
      await persistFileMirror(card);
      return { ok: true, card };
    }

    const hand = await tryFixKey(key);
    if (hand?.ok) {
      const body = `${row.body}\n\n${hand.did}`;
      await updateCardFields(key, {
        status: "done",
        approvedAt: new Date(),
        body,
      });
    } else {
      const note = hand
        ? hand.did
        : "Godkänt. Ingen Hand för den här nyckeln — väntar på en människa eller Cursor.";
      const body = row.body.includes(note) ? row.body : `${row.body}\n\n${note}`;
      await updateCardFields(key, {
        status: "ready",
        approvedAt: new Date(),
        body,
      });
    }
    const next = await findCardByKey(key);
    if (!next) return { ok: false, status: 404, error: "orchestratorCardNotFound" };
    const card = dbCardToWorkboard(next);
    await persistFileMirror(card);
    return { ok: true, card };
  } catch (e) {
    if (tablesMissing(e)) {
      return { ok: false, status: 500, error: "orchestratorTablesMissing" };
    }
    throw e;
  }
}
