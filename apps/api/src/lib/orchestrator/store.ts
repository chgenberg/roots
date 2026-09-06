import { and, desc, eq, like, ne } from "drizzle-orm";
import { db } from "@roots/db";
import { orchestratorCards, orchestratorRuns } from "@roots/db/schema";
import { dbCardToWorkboard, type DbCard } from "./cards";
import { setCardWriter } from "./hands";
import type { CardStatus } from "./workboard-types";
import type { WorkboardCard } from "./workboard-types";

export function tablesMissing(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /orchestrator_cards|orchestrator_runs|does not exist/i.test(msg);
}

let wired = false;

export function wireOrchestratorStore(): void {
  if (wired) return;
  wired = true;
  setCardWriter({
    findUnique: async ({ where }) => {
      const [row] = await db
        .select({ body: orchestratorCards.body })
        .from(orchestratorCards)
        .where(eq(orchestratorCards.key, where.key))
        .limit(1);
      return row ?? null;
    },
    update: async ({ where, data }) => {
      await db
        .update(orchestratorCards)
        .set({
          status: data.status,
          body: data.body,
          updatedAt: new Date(),
        })
        .where(eq(orchestratorCards.key, where.key));
    },
  });
}

export async function findCardByKey(key: string): Promise<DbCard | null> {
  const [row] = await db
    .select()
    .from(orchestratorCards)
    .where(eq(orchestratorCards.key, key))
    .limit(1);
  return row ?? null;
}

export async function listDbCards(limit = 200): Promise<WorkboardCard[]> {
  try {
    const rows = await db
      .select()
      .from(orchestratorCards)
      .orderBy(desc(orchestratorCards.updatedAt))
      .limit(limit);
    return rows.map(dbCardToWorkboard);
  } catch (e) {
    if (tablesMissing(e)) return [];
    throw e;
  }
}

export async function listOpenHeartbeatKeys(prefix: string): Promise<string[]> {
  const rows = await db
    .select({ key: orchestratorCards.key })
    .from(orchestratorCards)
    .where(
      and(
        eq(orchestratorCards.source, "heartbeat"),
        ne(orchestratorCards.status, "done"),
        like(orchestratorCards.key, `${prefix}%`)
      )
    );
  return rows.map((r) => r.key);
}

export async function createHeartbeatCard(data: {
  key: string;
  title: string;
  body: string;
  domainId: string;
  gate: string;
  filesJson: string;
}): Promise<void> {
  await db.insert(orchestratorCards).values({
    key: data.key,
    title: data.title,
    body: data.body,
    status: "inbox",
    domainId: data.domainId,
    gate: data.gate,
    filesJson: data.filesJson,
    source: "heartbeat",
  });
}

export async function reopenCard(
  key: string,
  data: {
    title: string;
    body: string;
    domainId: string;
    gate: string;
    filesJson: string;
  }
): Promise<void> {
  await db
    .update(orchestratorCards)
    .set({
      title: data.title,
      body: data.body,
      status: "inbox",
      domainId: data.domainId,
      gate: data.gate,
      filesJson: data.filesJson,
      rejectedAt: null,
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(orchestratorCards.key, key));
}

export async function markCardDone(key: string, body: string): Promise<void> {
  await db
    .update(orchestratorCards)
    .set({ status: "done" satisfies CardStatus, body, updatedAt: new Date() })
    .where(eq(orchestratorCards.key, key));
}

export async function updateCardFields(
  key: string,
  data: Partial<{
    status: CardStatus;
    body: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
  }>
): Promise<void> {
  await db
    .update(orchestratorCards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orchestratorCards.key, key));
}

export async function createRun(): Promise<{ id: string }> {
  const [row] = await db
    .insert(orchestratorRuns)
    .values({ kind: "heartbeat", status: "running" })
    .returning({ id: orchestratorRuns.id });
  if (!row) throw new Error("kunde inte skapa orchestrator_run");
  return row;
}

export async function finishRun(
  id: string,
  data: { status: string; summary: string; findings: number }
): Promise<void> {
  await db
    .update(orchestratorRuns)
    .set({
      status: data.status,
      summary: data.summary,
      findings: data.findings,
      endedAt: new Date(),
    })
    .where(eq(orchestratorRuns.id, id));
}

export async function latestHeartbeatRun() {
  try {
    const [row] = await db
      .select()
      .from(orchestratorRuns)
      .where(eq(orchestratorRuns.kind, "heartbeat"))
      .orderBy(desc(orchestratorRuns.startedAt))
      .limit(1);
    return row ?? null;
  } catch (e) {
    if (tablesMissing(e)) return null;
    throw e;
  }
}
