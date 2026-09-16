import { appendLesson, stampBlocks } from "./briefing-blocks";
import {
  actionAllowedForDesk,
  defaultGateFor,
  draftRuleFromText,
  isConductorAction,
  isConductorEvent,
} from "./conductor-catalog";
import {
  briefingIsReady,
  briefingNeedsIntake,
  followUpForText,
  greetingForDesk,
  intakeFallback,
  looksLikeAutomation,
  looksLikeOpenJob,
  looksLikeTraining,
  openBriefingStub,
  replyForDraft,
} from "./desks";
import {
  type DeskBrainDraft,
  type DeskBrainOut,
  deskBrainEnabled,
  thinkDeskTurn,
} from "./desk-brain";
import { guardDrafts } from "./desk-guard";
import {
  createRule,
  getDesk,
  getDeskByKey,
  hasAgentGreeting,
  insertMessage,
  listRecentDeskMessages,
  listRulesForDesk,
  updateDesk,
  writeDeskTrace,
  type DeskRow,
  type RuleRow,
} from "./conductor-store";

async function deskForAction(
  desk: { id: string; key: string; name: string },
  action: "card.open" | "email.draft" | "fortnox.draft"
): Promise<{ id: string; key: string; name: string }> {
  if (actionAllowedForDesk(desk.key, desk.name, action)) return desk;
  if (action === "fortnox.draft") {
    const pengar = await getDeskByKey("pengar");
    if (pengar) return pengar;
  }
  return desk;
}

export async function createDraftRule(
  desk: { id: string; key: string; name: string },
  userId: string,
  text: string,
  hint?: DeskBrainDraft
): Promise<RuleRow> {
  if (
    hint &&
    isConductorEvent(hint.trigger) &&
    isConductorAction(hint.action)
  ) {
    const home = await deskForAction(desk, hint.action);
    const action = actionAllowedForDesk(home.key, home.name, hint.action)
      ? hint.action
      : "card.open";
    return createRule({
      title: hint.title.slice(0, 80),
      trigger: hint.trigger,
      action,
      gate: defaultGateFor(action),
      createdBy: userId,
      deskId: home.id,
      actionJson: JSON.stringify(
        action === "card.open" ? { title: hint.title.slice(0, 80) } : {}
      ),
    });
  }
  const draft = draftRuleFromText(text);
  let action = isConductorAction(draft.action) ? draft.action : "card.open";
  const home = await deskForAction(desk, action);
  if (!actionAllowedForDesk(home.key, home.name, action)) action = "card.open";
  const trigger = isConductorEvent(draft.trigger)
    ? draft.trigger
    : "order.created";
  return createRule({
    title: draft.title,
    trigger,
    action,
    gate: defaultGateFor(action),
    createdBy: userId,
    deskId: home.id,
    actionJson: JSON.stringify(draft.actionJson),
    filterJson: JSON.stringify(draft.filter),
  });
}

async function persistBrain(
  desk: DeskRow,
  brain: DeskBrainOut,
  rewriteReady = false
): Promise<void> {
  const data: { blurb?: string; briefing?: string } = {};
  if (brain.blurb && brain.blurb !== desk.blurb) data.blurb = brain.blurb;
  if (brain.briefing && brain.briefing !== desk.briefing) {
    const clobber =
      briefingIsReady(desk.briefing) &&
      briefingNeedsIntake(brain.briefing) &&
      !rewriteReady;
    if (!clobber) data.briefing = brain.briefing;
  }
  if (Object.keys(data).length === 0) return;
  await updateDesk(desk.id, data);
}

export async function ingestDeskChat(args: {
  deskId: string;
  userId: string;
  text?: string;
  greet?: boolean;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const text = args.text?.trim().slice(0, 400) ?? "";
  const desk = await getDesk(args.deskId);
  if (!desk) return { status: 404, body: { error: "NOT_FOUND" } };

  const rules = await listRulesForDesk(desk.id);
  const waiting = rules.filter((r) => !r.approvedAt).length;
  const on = rules.filter((r) => r.enabled && r.approvedAt).length;

  if (args.greet && !text) {
    if (await hasAgentGreeting(desk.id)) {
      return { status: 200, body: { ok: true, message: null, rule: null } };
    }
    const reply = greetingForDesk({
      name: desk.name,
      on,
      waiting,
      titles: rules.map((r) => r.title),
    });
    const message = await insertMessage({
      deskId: desk.id,
      thread: "desk",
      role: "agent",
      text: reply,
    });
    return { status: 200, body: { ok: true, message, rule: null } };
  }

  if (!text) return { status: 400, body: { error: "TEXT_REQUIRED" } };

  await insertMessage({
    deskId: desk.id,
    thread: "desk",
    role: "you",
    text,
  });

  if (deskBrainEnabled()) {
    const prior = await listRecentDeskMessages(desk.id, 10);
    const training = looksLikeTraining(text) || briefingNeedsIntake(desk.briefing);
    const brain = await thinkDeskTurn({
      desk: {
        name: desk.name,
        key: desk.key,
        blurb: desk.blurb,
        briefing: desk.briefing,
      },
      text,
      history: prior.map((m) => ({
        role: m.role === "you" ? "you" : "agent",
        text: m.text,
      })),
      rules: rules.map((r) => ({
        title: r.title,
        approved: Boolean(r.approvedAt),
      })),
      mode: training ? "train" : "task",
    });
    if (brain) {
      await persistBrain(desk, brain, training);
      const guarded = guardDrafts(brain.drafts);
      const usable = brain.ready && guarded.ok ? brain.drafts : [];
      let reply = brain.reply;
      if (brain.ready && !guarded.ok) {
        reply = `${brain.reply}\n\nJag lade inget utkast. ${guarded.reason}`.slice(
          0,
          1600
        );
      }
      await writeDeskTrace({
        deskId: desk.id,
        deskKey: desk.key,
        deskName: desk.name,
        model: brain.model,
        tokens: brain.tokens,
        purpose: training ? "train" : "task",
        outcome: !guarded.ok
          ? "blocked"
          : brain.ready && usable.length
            ? "draft"
            : brain.ready
              ? "ok"
              : "questions",
      });
      let firstRule: RuleRow | null = null;
      for (const draft of usable) {
        const rule = await createDraftRule(desk, args.userId, draft.title, draft);
        firstRule ??= rule;
      }
      const message = await insertMessage({
        deskId: desk.id,
        thread: "desk",
        role: "agent",
        text: reply,
      });
      return { status: 200, body: { ok: true, message, rule: firstRule } };
    }
  }

  if (looksLikeTraining(text)) {
    const briefing =
      openBriefingStub(text, desk.briefing) ??
      stampBlocks({
        existing: desk.briefing,
        jag: text.slice(0, 200),
        ready: false,
      });
    await updateDesk(desk.id, { briefing });
    const reply = briefingNeedsIntake(briefing)
      ? intakeFallback(desk.name, text, desk)
      : `Jag har antecknat det. Jag är ${desk.name}. Säg när något ska hända så lägger jag ett utkast.`;
    const message = await insertMessage({
      deskId: desk.id,
      thread: "desk",
      role: "agent",
      text: reply,
    });
    return { status: 200, body: { ok: true, message, rule: null } };
  }

  const follow = followUpForText(text);
  if (follow && !looksLikeAutomation(text)) {
    const message = await insertMessage({
      deskId: desk.id,
      thread: "desk",
      role: "agent",
      text: follow,
    });
    return { status: 200, body: { ok: true, message, rule: null } };
  }

  if (looksLikeAutomation(text) || /när /.test(text.toLowerCase())) {
    const blocked = guardDrafts([{ title: text }]);
    if (!blocked.ok) {
      const reply = `Jag kan inte ta det. ${blocked.reason}`;
      const message = await insertMessage({
        deskId: desk.id,
        thread: "desk",
        role: "agent",
        text: reply,
      });
      await writeDeskTrace({
        deskId: desk.id,
        deskKey: desk.key,
        deskName: desk.name,
        purpose: "guard",
        outcome: "blocked",
      });
      return { status: 200, body: { ok: true, message, rule: null } };
    }
    const rule = await createDraftRule(desk, args.userId, text);
    const action = isConductorAction(rule.action) ? rule.action : "card.open";
    const trigger = isConductorEvent(rule.trigger)
      ? rule.trigger
      : "order.created";
    const reply = replyForDraft({
      title: rule.title,
      trigger,
      action,
    });
    const message = await insertMessage({
      deskId: desk.id,
      thread: "desk",
      role: "agent",
      text: reply,
    });
    return { status: 200, body: { ok: true, message, rule } };
  }

  if (looksLikeOpenJob(text) || briefingNeedsIntake(desk.briefing)) {
    const reply = briefingNeedsIntake(desk.briefing)
      ? `${desk.name} här. Jag har antecknat. Just nu når jag inte tanken — svara igen om en stund, eller fyll i det som saknas.`
      : intakeFallback(desk.name, text, desk);
    const stub = openBriefingStub(text, desk.briefing);
    if (stub) await updateDesk(desk.id, { briefing: stub });
    const message = await insertMessage({
      deskId: desk.id,
      thread: "desk",
      role: "agent",
      text: reply,
    });
    await writeDeskTrace({
      deskId: desk.id,
      deskKey: desk.key,
      deskName: desk.name,
      purpose: "intake",
      outcome: "questions",
    });
    return { status: 200, body: { ok: true, message, rule: null } };
  }

  const reply = briefingIsReady(desk.briefing)
    ? `Jag har det jag behöver. Säg “när …” så lägger jag ett utkast till höger.`
    : intakeFallback(desk.name, text, desk);
  const message = await insertMessage({
    deskId: desk.id,
    thread: "desk",
    role: "agent",
    text: reply,
  });
  return { status: 200, body: { ok: true, message, rule: null } };
}

export async function noteRuleLesson(
  deskId: string,
  title: string
): Promise<void> {
  const desk = await getDesk(deskId);
  if (!desk) return;
  await updateDesk(deskId, {
    briefing: appendLesson(desk.briefing, `Godkände “${title}”.`),
  });
}
