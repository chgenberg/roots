/**
 * INTERNAL_ADMIN — agentens tavla.
 *
 *   GET   /v1/admin/orchestrator
 *   PATCH /v1/admin/orchestrator  { id, action: "approve"|"reject"|"move", status? }
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { auditLog, requestContext } from "../lib/audit";
import { resolveUiLocale, uiError, type ErrorKey } from "../lib/ui-locale";
import {
  applyAdminAction,
  loadOrchestratorBoard,
} from "../lib/orchestrator/admin-board";
import { tablesMissing } from "../lib/orchestrator/store";

const log = childLogger("orchestrator");

export const orchestratorAdmin = new Hono();

type GuardResult =
  | { ok: true; session: SessionData }
  | { ok: false; status: 401 | 403; error: string };

async function requireInternalAdmin(c: Context): Promise<GuardResult> {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return { ok: false, status: 401, error: uiError(locale, "notLoggedIn") };
  if (session.role !== "INTERNAL_ADMIN") {
    return { ok: false, status: 403, error: uiError(locale, "permissionDenied") };
  }
  return { ok: true, session };
}

const patchSchema = z.object({
  id: z.string().min(1).max(180),
  action: z.enum(["approve", "reject", "move"]),
  status: z.enum(["inbox", "ready", "doing", "blocked", "done"]).optional(),
});

orchestratorAdmin.get("/orchestrator", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  try {
    const board = await loadOrchestratorBoard();
    return c.json(board);
  } catch (err) {
    if (tablesMissing(err)) {
      return c.json({ error: uiError(resolveUiLocale(c), "orchestratorTablesMissing") }, 500);
    }
    log.error({ err }, "orchestrator GET failed");
    return c.json({ error: uiError(resolveUiLocale(c), "orchestratorCouldNotLoad") }, 500);
  }
});

orchestratorAdmin.patch("/orchestrator", async (c) => {
  const guard = await requireInternalAdmin(c);
  if (!guard.ok) return c.json({ error: guard.error }, guard.status);

  const locale = resolveUiLocale(c);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(locale, "invalidJson") }, 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: uiError(locale, "orchestratorInvalidAction") }, 400);
  }

  try {
    const result = await applyAdminAction(parsed.data);
    if (!result.ok) {
      return c.json(
        { error: uiError(locale, result.error as ErrorKey) },
        result.status
      );
    }
    void auditLog({
      userId: guard.session.userId,
      action: `orchestrator.${parsed.data.action}`,
      entityType: "orchestrator_card",
      entityId: null,
      meta: {
        ...requestContext((n) => c.req.header(n)),
        key: parsed.data.id,
        status: result.card.status,
      },
    });
    return c.json({ card: result.card });
  } catch (err) {
    log.error({ err }, "orchestrator PATCH failed");
    return c.json({ error: uiError(locale, "orchestratorCouldNotUpdate") }, 500);
  }
});
