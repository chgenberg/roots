import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@roots/db";
import {
  conductorDesks,
  conductorMessages,
  conductorRules,
  conductorTraces,
} from "@roots/db/schema";
import { isAgentFigure, parseCadence, portraitSrc } from "@roots/contracts";

export type DeskRow = typeof conductorDesks.$inferSelect;
export type RuleRow = typeof conductorRules.$inferSelect;
export type MessageRow = typeof conductorMessages.$inferSelect;

export function conductorTablesMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /conductor_desks|conductor_messages|conductor_rules|conductor_traces|does not exist/i.test(
    msg
  );
}

export async function listDesks(): Promise<DeskRow[]> {
  return db
    .select()
    .from(conductorDesks)
    .orderBy(asc(conductorDesks.createdAt));
}

export async function getDesk(id: string): Promise<DeskRow | null> {
  const [row] = await db
    .select()
    .from(conductorDesks)
    .where(eq(conductorDesks.id, id))
    .limit(1);
  return row ?? null;
}

export async function createDesk(data: {
  key: string;
  name: string;
  blurb?: string;
  accent?: string;
  portrait?: number | null;
}): Promise<DeskRow> {
  const [row] = await db
    .insert(conductorDesks)
    .values({
      key: data.key,
      name: data.name,
      blurb: data.blurb ?? "",
      accent: data.accent ?? "ink",
      portrait: data.portrait ?? null,
    })
    .returning();
  return row;
}

export async function updateDesk(
  id: string,
  data: Partial<
    Pick<DeskRow, "name" | "blurb" | "accent" | "portrait" | "briefing">
  >
): Promise<DeskRow | null> {
  const [row] = await db
    .update(conductorDesks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(conductorDesks.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCustomDesk(id: string): Promise<boolean> {
  const desk = await getDesk(id);
  if (!desk || !desk.key.startsWith("custom:")) return false;
  await db.delete(conductorRules).where(eq(conductorRules.deskId, id));
  await db.delete(conductorDesks).where(eq(conductorDesks.id, id));
  return true;
}

export async function listRulesForDesk(deskId: string): Promise<RuleRow[]> {
  return db
    .select()
    .from(conductorRules)
    .where(eq(conductorRules.deskId, deskId))
    .orderBy(desc(conductorRules.updatedAt))
    .limit(40);
}

export async function listRecentDeskMessages(
  deskId: string,
  take = 10
): Promise<MessageRow[]> {
  const rows = await db
    .select()
    .from(conductorMessages)
    .where(
      and(eq(conductorMessages.deskId, deskId), eq(conductorMessages.thread, "desk"))
    )
    .orderBy(desc(conductorMessages.createdAt))
    .limit(take);
  return rows.reverse();
}

export type TracePurpose =
  | "train"
  | "task"
  | "handoff"
  | "draft"
  | "guard"
  | "intake";
export type TraceOutcome = "ok" | "blocked" | "questions" | "draft" | "fail";

export async function writeDeskTrace(row: {
  deskId?: string | null;
  deskKey?: string;
  deskName?: string;
  model?: string;
  tokens?: number;
  purpose: TracePurpose;
  gate?: string;
  outcome: TraceOutcome;
}): Promise<void> {
  try {
    await db.insert(conductorTraces).values({
      deskId: row.deskId || null,
      deskKey: (row.deskKey || "").slice(0, 80),
      deskName: (row.deskName || "").slice(0, 80),
      model: (row.model || "").slice(0, 80),
      tokens: Math.max(0, row.tokens ?? 0),
      purpose: row.purpose,
      gate: row.gate || "none",
      outcome: row.outcome,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : String(err);
    if (!conductorTablesMissing(err)) {
      console.warn(`[desk-trace] ${msg}`);
    }
  }
}

export async function listMessagesForDesk(deskId: string): Promise<MessageRow[]> {
  return db
    .select()
    .from(conductorMessages)
    .where(
      and(eq(conductorMessages.deskId, deskId), eq(conductorMessages.thread, "desk"))
    )
    .orderBy(asc(conductorMessages.createdAt))
    .limit(80);
}

export async function listGroupMessages(): Promise<
  (MessageRow & { deskName: string | null })[]
> {
  const rows = await db
    .select({
      message: conductorMessages,
      deskName: conductorDesks.name,
    })
    .from(conductorMessages)
    .leftJoin(conductorDesks, eq(conductorMessages.deskId, conductorDesks.id))
    .where(eq(conductorMessages.thread, "group"))
    .orderBy(asc(conductorMessages.createdAt))
    .limit(120);
  return rows.map((r) => ({ ...r.message, deskName: r.deskName }));
}

export async function insertMessage(data: {
  deskId?: string | null;
  thread: "desk" | "group";
  role: "you" | "agent";
  text: string;
}): Promise<MessageRow> {
  const [row] = await db
    .insert(conductorMessages)
    .values({
      deskId: data.deskId ?? null,
      thread: data.thread,
      role: data.role,
      text: data.text,
    })
    .returning();
  return row;
}

export async function hasAgentGreeting(deskId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: conductorMessages.id })
    .from(conductorMessages)
    .where(
      and(
        eq(conductorMessages.deskId, deskId),
        eq(conductorMessages.role, "agent"),
        eq(conductorMessages.thread, "desk")
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function hasGroupGreeting(): Promise<boolean> {
  const [row] = await db
    .select({ id: conductorMessages.id })
    .from(conductorMessages)
    .where(
      and(
        eq(conductorMessages.thread, "group"),
        eq(conductorMessages.role, "agent")
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function createRule(data: {
  title: string;
  trigger: string;
  action: string;
  gate: string;
  createdBy: string;
  deskId: string;
  actionJson?: string;
  filterJson?: string;
}): Promise<RuleRow> {
  const [row] = await db
    .insert(conductorRules)
    .values({
      title: data.title.slice(0, 80),
      trigger: data.trigger,
      action: data.action,
      gate: data.gate,
      createdBy: data.createdBy,
      deskId: data.deskId,
      actionJson: data.actionJson ?? "{}",
      filterJson: data.filterJson ?? "{}",
      enabled: false,
    })
    .returning();
  return row;
}

export async function getRule(id: string): Promise<RuleRow | null> {
  const [row] = await db
    .select()
    .from(conductorRules)
    .where(eq(conductorRules.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateRule(
  id: string,
  data: Partial<
    Pick<
      RuleRow,
      | "title"
      | "enabled"
      | "approvedAt"
      | "cadence"
      | "trigger"
      | "action"
      | "gate"
      | "actionJson"
      | "filterJson"
    >
  >
): Promise<RuleRow | null> {
  const [row] = await db
    .update(conductorRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(conductorRules.id, id))
    .returning();
  return row ?? null;
}

export async function deleteRule(id: string): Promise<void> {
  await db.delete(conductorRules).where(eq(conductorRules.id, id));
}

export async function attachOrphanRules(): Promise<void> {
  const orphans = await db
    .select()
    .from(conductorRules)
    .where(isNull(conductorRules.deskId));
  if (orphans.length === 0) return;
  const desks = await listDesks();
  const byKey = new Map(desks.map((d) => [d.key, d.id]));
  for (const row of orphans) {
    const { deskKeyForRule } = await import("./conductor-catalog");
    const deskId = byKey.get(deskKeyForRule(row.trigger, row.action));
    if (!deskId) continue;
    await db
      .update(conductorRules)
      .set({ deskId, updatedAt: new Date() })
      .where(eq(conductorRules.id, row.id));
  }
}

export function serializeDesk(
  desk: DeskRow,
  rules: RuleRow[],
  messages: MessageRow[]
) {
  const waiting = rules.filter((r) => !r.approvedAt).length;
  const on = rules.filter((r) => r.enabled && r.approvedAt).length;
  const portrait =
    desk.portrait && isAgentFigure(desk.portrait) ? desk.portrait : 1;
  return {
    id: desk.id,
    key: desk.key,
    name: desk.name,
    blurb: desk.blurb,
    accent: desk.accent,
    portrait,
    image: portraitSrc(portrait),
    seeded: !desk.key.startsWith("custom:"),
    createdAt: desk.createdAt.toISOString(),
    waiting,
    on,
    refs: [] as { url: string; kind: "ref" | "example" }[],
    rules: rules.map((r) => ({
      id: r.id,
      title: r.title,
      enabled: r.enabled,
      trigger: r.trigger,
      action: r.action,
      gate: r.gate,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      lastRanAt: r.lastRanAt?.toISOString() ?? null,
      cadence: parseCadence(r.cadence),
    })),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role === "you" ? "you" : "agent",
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function loadArmyBoard() {
  const desks = await listDesks();
  const ids = desks.map((d) => d.id);
  const rules =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(conductorRules)
          .where(inArray(conductorRules.deskId, ids));
  const messages =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(conductorMessages)
          .where(
            and(
              inArray(conductorMessages.deskId, ids),
              eq(conductorMessages.thread, "desk")
            )
          )
          .orderBy(asc(conductorMessages.createdAt));
  const serialized = desks.map((desk) =>
    serializeDesk(
      desk,
      rules.filter((r) => r.deskId === desk.id),
      messages.filter((m) => m.deskId === desk.id)
    )
  );
  return serialized;
}
