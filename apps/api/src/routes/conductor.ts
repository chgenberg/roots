/**
 * INTERNAL_ADMIN — ringen, chatten och När→gör.
 *
 *   GET    /v1/admin/conductor-desks
 *   POST   /v1/admin/conductor-desks
 *   PATCH  /v1/admin/conductor-desks/:id
 *   DELETE /v1/admin/conductor-desks/:id
 *   POST   /v1/admin/conductor-desks/:id/chat
 *   POST   /v1/admin/conductor-desks/group
 *   PATCH  /v1/admin/conductor-rules/:id
 *   DELETE /v1/admin/conductor-rules/:id
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import {
  hireFigures,
  isAgentFigure,
  isConductorCadence,
  isDeskAccent,
  unusedFigures,
  portraitSrc,
  type DeskAccent,
} from "@roots/contracts";
import { DESK_ACCENTS, ensureSeededDesks } from "../lib/orchestrator/desks";
import { ingestDeskChat, noteRuleLesson } from "../lib/orchestrator/desk-chat";
import { ingestGroupChat } from "../lib/orchestrator/group-chat";
import {
  conductorTablesMissing,
  createDesk,
  deleteCustomDesk,
  deleteRule,
  getDesk,
  getRule,
  listDesks,
  listGroupMessages,
  loadArmyBoard,
  serializeDesk,
  updateDesk,
  updateRule,
} from "../lib/orchestrator/conductor-store";

const log = childLogger("conductor");

export const conductorAdmin = new Hono();

type GuardResult =
  | { ok: true; session: SessionData }
  | { ok: false; status: 401 | 403; error: string };

async function requireInternalAdmin(c: Context): Promise<GuardResult> {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session)
    return { ok: false, status: 401, error: uiError(locale, "notLoggedIn") };
  if (session.role !== "INTERNAL_ADMIN") {
    return { ok: false, status: 403, error: uiError(locale, "permissionDenied") };
  }
  return { ok: true, session };
}

conductorAdmin.get("/conductor-desks", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  try {
    await ensureSeededDesks();
    const desks = await loadArmyBoard();
    const used = desks.map((d) => d.portrait);
    const byId = new Map(desks.map((d) => [d.id, d]));
    const groupRows = await listGroupMessages();
    return c.json({
      desks,
      figures: {
        available: hireFigures(used),
        unused: unusedFigures(used),
      },
      group: {
        messages: groupRows.map((m) => {
          const desk = m.deskId ? byId.get(m.deskId) : undefined;
          return {
            id: m.id,
            role: m.role === "you" ? "you" : "agent",
            text: m.text,
            createdAt: m.createdAt.toISOString(),
            deskId: m.deskId,
            name: m.deskName ?? desk?.name ?? null,
            image: desk?.image ?? (desk ? portraitSrc(desk.portrait) : null),
          };
        }),
      },
    });
  } catch (err) {
    if (conductorTablesMissing(err)) {
      return c.json({ desks: [], missing: true, figures: { available: [], unused: [] }, group: { messages: [] } });
    }
    log.error({ err }, "conductor-desks GET failed");
    return c.json({ error: uiError(resolveUiLocale(c), "orchestratorCouldNotLoad") }, 500);
  }
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  blurb: z.string().trim().max(160).optional(),
  accent: z.string().optional(),
  portrait: z.number().int().optional(),
});

conductorAdmin.post("/conductor-desks", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "NAME_REQUIRED" }, 400);
  }

  try {
    await ensureSeededDesks();
    const existing = await listDesks();
    const usedAccents = new Set(existing.map((d) => d.accent));
    const usedPortraits = existing
      .map((d) => d.portrait)
      .filter((n): n is number => n != null && isAgentFigure(n));
    const extras = hireFigures(usedPortraits);
    const anyFree = unusedFigures(usedPortraits);
    let portrait: number | null = null;
    if (typeof parsed.data.portrait === "number") {
      if (
        !isAgentFigure(parsed.data.portrait) ||
        usedPortraits.includes(parsed.data.portrait)
      ) {
        return c.json({ error: "PORTRAIT_TAKEN" }, 409);
      }
      portrait = parsed.data.portrait;
    } else {
      portrait = extras[0] ?? anyFree[0] ?? null;
    }
    if (!portrait) return c.json({ error: "NO_FIGURES" }, 409);
    const nextAccent: DeskAccent =
      parsed.data.accent && isDeskAccent(parsed.data.accent)
        ? parsed.data.accent
        : (DESK_ACCENTS.find((a) => !usedAccents.has(a)) ??
          DESK_ACCENTS[existing.length % DESK_ACCENTS.length]);
    const desk = await createDesk({
      key: `custom:${randomUUID()}`,
      name: parsed.data.name,
      blurb: parsed.data.blurb ?? "",
      accent: nextAccent,
      portrait,
    });
    return c.json({ ok: true, desk: serializeDesk(desk, [], []) }, 201);
  } catch (err) {
    if (conductorTablesMissing(err)) {
      return c.json({ error: "TABLES_MISSING" }, 503);
    }
    log.error({ err }, "conductor-desks POST failed");
    return c.json({ error: uiError(resolveUiLocale(c), "orchestratorCouldNotLoad") }, 500);
  }
});

conductorAdmin.post("/conductor-desks/group", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  let body: { text?: string; greet?: boolean } = {};
  try {
    body = (await c.req.json()) as { text?: string; greet?: boolean };
  } catch {
    body = {};
  }
  const result = await ingestGroupChat({
    userId: guard.session.userId,
    text: body.text,
    greet: body.greet,
  });
  return c.json(result.body, result.status as 200 | 400);
});

conductorAdmin.post("/conductor-desks/:id/chat", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  let body: { text?: string; greet?: boolean } = {};
  try {
    body = (await c.req.json()) as { text?: string; greet?: boolean };
  } catch {
    body = {};
  }
  const result = await ingestDeskChat({
    deskId: c.req.param("id"),
    userId: guard.session.userId,
    text: body.text,
    greet: body.greet,
  });
  return c.json(result.body, result.status as 200 | 400 | 404);
});

const patchDeskSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  blurb: z.string().trim().max(160).optional(),
  accent: z.string().optional(),
});

conductorAdmin.patch("/conductor-desks/:id", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const parsed = patchDeskSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "BAD_REQUEST" }, 400);
  const desk = await getDesk(c.req.param("id"));
  if (!desk) return c.json({ error: "NOT_FOUND" }, 404);
  const accent =
    parsed.data.accent && isDeskAccent(parsed.data.accent)
      ? parsed.data.accent
      : undefined;
  const updated = await updateDesk(desk.id, {
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.blurb !== undefined ? { blurb: parsed.data.blurb } : {}),
    ...(accent ? { accent } : {}),
  });
  return c.json({ ok: true, id: updated?.id, name: updated?.name });
});

conductorAdmin.delete("/conductor-desks/:id", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  const desk = await getDesk(c.req.param("id"));
  if (!desk) return c.json({ error: "NOT_FOUND" }, 404);
  if (!desk.key.startsWith("custom:")) {
    return c.json({ error: "SEEDED" }, 409);
  }
  await deleteCustomDesk(desk.id);
  return c.json({ ok: true });
});

const patchRuleSchema = z.object({
  action: z.enum(["approve", "toggle", "cadence"]),
  cadence: z.string().optional(),
});

conductorAdmin.patch("/conductor-rules/:id", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidJson") }, 400);
  }
  const parsed = patchRuleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "BAD_REQUEST" }, 400);
  const row = await getRule(c.req.param("id"));
  if (!row) return c.json({ error: "NOT_FOUND" }, 404);

  if (parsed.data.action === "approve") {
    const updated = await updateRule(row.id, {
      approvedAt: new Date(),
      enabled: true,
    });
    if (row.deskId) await noteRuleLesson(row.deskId, row.title);
    return c.json({
      ok: true,
      id: updated?.id,
      enabled: updated?.enabled,
      approvedAt: updated?.approvedAt?.toISOString() ?? null,
    });
  }

  if (parsed.data.action === "toggle") {
    const next = !row.enabled;
    if (next && (row.gate === "email" || row.gate === "money" || row.gate === "irreversible") && !row.approvedAt) {
      return c.json({ error: "NEEDS_APPROVAL" }, 409);
    }
    const updated = await updateRule(row.id, { enabled: next });
    return c.json({ ok: true, id: updated?.id, enabled: updated?.enabled });
  }

  if (!parsed.data.cadence || !isConductorCadence(parsed.data.cadence)) {
    return c.json({ error: "BAD_CADENCE" }, 400);
  }
  const updated = await updateRule(row.id, { cadence: parsed.data.cadence });
  return c.json({ ok: true, id: updated?.id, cadence: updated?.cadence });
});

conductorAdmin.delete("/conductor-rules/:id", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);
  const row = await getRule(c.req.param("id"));
  if (!row) return c.json({ error: "NOT_FOUND" }, 404);
  await deleteRule(row.id);
  return c.json({ ok: true, id: row.id });
});
