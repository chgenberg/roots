/**
 * Köraren. Godkända regler lägger kort. Mejl och Fortnox är utkast.
 * PAID, Fortnox-skick, bank, deploy och lyft av mejlpaus finns inte.
 */

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@roots/db";
import { conductorJobs, conductorRules } from "@roots/db/schema";
import { childLogger } from "../logger";
import { jobKey } from "./conductor-cadence";
import {
  actionLabel,
  defaultGateFor,
  deskKeyForRule,
  eventLabel,
  isConductorAction,
  isConductorEvent,
  type ConductorAction,
  type ConductorEvent,
} from "./conductor-catalog";
import { conductorTablesMissing } from "./conductor-store";
import { upsertArmyCard } from "./store";
import type { DomainId } from "./graph";

const log = childLogger("conductor-rules");

const CARD_JOB_CAP = 8;

export type EventContext = {
  event: ConductorEvent;
  entityId: string;
  extra?: Record<string, unknown>;
};

export function domainForEvent(event: string, action: string): DomainId {
  const desk = deskKeyForRule(event, action);
  if (desk === "pengar") return "money";
  if (desk === "mejl") return "email";
  if (desk === "forening") return "fundraising";
  if (desk === "orderliv") return "shop";
  return "admin";
}

export function cardPlan(args: {
  action: ConductorAction;
  ruleId: string;
  title: string;
  entityId: string;
  event: string;
}): {
  key: string;
  title: string;
  body: string;
  domainId: DomainId;
  gate: string;
} {
  const when = eventLabel(args.event);
  const then = actionLabel(args.action);
  if (args.action === "email.draft") {
    return {
      key: `email-draft:${args.ruleId}:${args.entityId}`.slice(0, 180),
      title: `Mejlutkast: ${args.title}`.slice(0, 240),
      body: `När ${when} → ${then}. ${args.entityId}. Utkast. Inget skickat. Mejlpausen lyfter jag inte.`,
      domainId: "email",
      gate: "email",
    };
  }
  if (args.action === "fortnox.draft") {
    return {
      key: `fortnox-draft:${args.ruleId}:${args.entityId}`.slice(0, 180),
      title: `Fortnox-utkast: ${args.title}`.slice(0, 240),
      body: `När ${when} → ${then}. ${args.entityId}. Utkast. Inget skickat till Fortnox. Du trycker bokför.`,
      domainId: "money",
      gate: "money",
    };
  }
  return {
    key: `rule-card:${args.ruleId}:${args.entityId}`.slice(0, 180),
    title: args.title.slice(0, 240),
    body: `När ${when} → ${then}. ${args.entityId}.`,
    domainId: domainForEvent(args.event, args.action),
    gate: "none",
  };
}

export async function emitConductorEvent(ctx: EventContext): Promise<string[]> {
  try {
    if (!isConductorEvent(ctx.event) || !ctx.entityId) return [];
    const rules = await db
      .select()
      .from(conductorRules)
      .where(
        and(
          eq(conductorRules.trigger, ctx.event),
          eq(conductorRules.enabled, true),
          isNotNull(conductorRules.approvedAt)
        )
      );
    const queued: string[] = [];
    for (const rule of rules) {
      const key = jobKey(rule.id, ctx.entityId, ctx.event, rule.cadence);
      const [existing] = await db
        .select({ id: conductorJobs.id })
        .from(conductorJobs)
        .where(eq(conductorJobs.key, key))
        .limit(1);
      if (existing) continue;
      const [job] = await db
        .insert(conductorJobs)
        .values({
          key,
          ruleId: rule.id,
          entityId: ctx.entityId.slice(0, 80),
          event: ctx.event,
          status: "queued",
          payload: JSON.stringify(ctx.extra ?? {}),
        })
        .returning({ id: conductorJobs.id });
      if (job) queued.push(job.id);
      await db
        .update(conductorRules)
        .set({ lastLookedAt: new Date(), updatedAt: new Date() })
        .where(eq(conductorRules.id, rule.id));
    }
    return queued;
  } catch (err) {
    if (conductorTablesMissing(err)) return [];
    log.warn(
      { msg: err instanceof Error ? err.message.slice(0, 160) : String(err) },
      "emit failed"
    );
    return [];
  }
}

export async function enqueueRuleJob(args: {
  ruleId: string;
  entityId: string;
  event: ConductorEvent;
  payload?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const [rule] = await db
      .select({ cadence: conductorRules.cadence })
      .from(conductorRules)
      .where(eq(conductorRules.id, args.ruleId))
      .limit(1);
    const key = jobKey(args.ruleId, args.entityId, args.event, rule?.cadence);
    const [existing] = await db
      .select({ id: conductorJobs.id })
      .from(conductorJobs)
      .where(eq(conductorJobs.key, key))
      .limit(1);
    if (existing) return existing.id;
    const [job] = await db
      .insert(conductorJobs)
      .values({
        key,
        ruleId: args.ruleId,
        entityId: args.entityId.slice(0, 80),
        event: args.event,
        status: "queued",
        payload: JSON.stringify(args.payload ?? {}),
      })
      .returning({ id: conductorJobs.id });
    return job?.id ?? null;
  } catch (err) {
    if (conductorTablesMissing(err)) return null;
    throw err;
  }
}

export async function executeRuleJob(
  jobId: string
): Promise<{ ok: boolean; did: string }> {
  const [job] = await db
    .select()
    .from(conductorJobs)
    .where(eq(conductorJobs.id, jobId))
    .limit(1);
  if (!job) return { ok: false, did: "Jobbet saknas." };
  if (job.status === "done") return { ok: true, did: "Redan kört." };

  const [rule] = await db
    .select()
    .from(conductorRules)
    .where(eq(conductorRules.id, job.ruleId))
    .limit(1);
  if (!rule || !rule.enabled || !rule.approvedAt) {
    await db
      .update(conductorJobs)
      .set({
        status: "gated",
        error: "Uppgiften är inte godkänd och på.",
        updatedAt: new Date(),
      })
      .where(eq(conductorJobs.id, job.id));
    return { ok: false, did: "Väntar på att du godkänner och slår på uppgiften." };
  }

  const action = isConductorAction(rule.action) ? rule.action : null;
  if (!action) {
    await db
      .update(conductorJobs)
      .set({
        status: "error",
        error: "Okänd åtgärd.",
        updatedAt: new Date(),
      })
      .where(eq(conductorJobs.id, job.id));
    return { ok: false, did: "Okänd åtgärd." };
  }

  await db
    .update(conductorJobs)
    .set({ status: "running", error: null, updatedAt: new Date() })
    .where(eq(conductorJobs.id, job.id));

  try {
    const plan = cardPlan({
      action,
      ruleId: rule.id,
      title: rule.title,
      entityId: job.entityId,
      event: job.event,
    });
    await upsertArmyCard({
      ...plan,
      gate: defaultGateFor(action) === "none" ? "none" : plan.gate,
    });
    await db
      .update(conductorJobs)
      .set({
        status: "done",
        ranAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(conductorJobs.id, job.id));
    await db
      .update(conductorRules)
      .set({ lastRanAt: new Date(), updatedAt: new Date() })
      .where(eq(conductorRules.id, rule.id));
    if (action === "email.draft") {
      return { ok: true, did: "Agenten lade ett mejlutkast. Inget skickades." };
    }
    if (action === "fortnox.draft") {
      return { ok: true, did: "Agenten skrev ett Fortnox-utkast. Inget skickades." };
    }
    return { ok: true, did: "Agenten öppnade ett kort på tavlan." };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 180) : "JOB_FAILED";
    await db
      .update(conductorJobs)
      .set({ status: "error", error: msg, updatedAt: new Date() })
      .where(eq(conductorJobs.id, job.id));
    return { ok: false, did: msg };
  }
}

export async function processDueConductorJobs(): Promise<string[]> {
  const opened: string[] = [];
  try {
    const jobs = await db
      .select()
      .from(conductorJobs)
      .where(inArray(conductorJobs.status, ["queued", "gated"]))
      .orderBy(asc(conductorJobs.createdAt))
      .limit(40);
    let cards = 0;
    for (const job of jobs) {
      if (cards >= CARD_JOB_CAP) break;
      cards += 1;
      const result = await executeRuleJob(job.id);
      if (result.ok) opened.push(`rule-job:${job.id}`);
    }
  } catch (err) {
    if (!conductorTablesMissing(err)) {
      log.warn(
        { msg: err instanceof Error ? err.message.slice(0, 160) : String(err) },
        "process failed"
      );
    }
  }
  return opened;
}

export async function noteConductorEvent(
  event: ConductorEvent,
  entityId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const ids = await emitConductorEvent({ event, entityId, extra });
    for (const id of ids.slice(0, 3)) {
      await executeRuleJob(id).catch(() => {});
    }
  } catch {
    // Händelsen får aldrig fälla kassan eller inbjudan.
  }
}

export async function runRuleNow(args: {
  ruleId: string;
  entityId?: string;
}): Promise<{ ok: boolean; did: string; jobId?: string }> {
  const [rule] = await db
    .select()
    .from(conductorRules)
    .where(eq(conductorRules.id, args.ruleId))
    .limit(1);
  if (!rule) return { ok: false, did: "Uppgiften saknas." };
  if (!rule.approvedAt || !rule.enabled) {
    return { ok: false, did: "Godkänn och slå på först." };
  }
  const event = isConductorEvent(rule.trigger) ? rule.trigger : "order.created";
  const entityId = (args.entityId || `manual:${Date.now().toString(36)}`).slice(
    0,
    80
  );
  const jobId = await enqueueRuleJob({
    ruleId: rule.id,
    entityId,
    event,
  });
  if (!jobId) return { ok: false, did: "Kunde inte lägga jobbet." };
  const result = await executeRuleJob(jobId);
  return { ...result, jobId };
}
