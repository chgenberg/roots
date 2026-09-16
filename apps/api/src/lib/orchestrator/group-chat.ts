import {
  actionAllowedForDesk,
  defaultGateFor,
  deskKeyForRule,
  draftRuleFromText,
  isConductorAction,
  isConductorEvent,
} from "./conductor-catalog";
import { createDraftRule } from "./desk-chat";
import { deskBrainEnabled, thinkGroupTurn } from "./desk-brain";
import { guardDrafts } from "./desk-guard";
import {
  followUpForText,
  greetingForDesk,
  intakeFallback,
  looksLikeAutomation,
  replyForDraft,
} from "./desks";
import {
  createRule,
  hasGroupGreeting,
  insertMessage,
  listDesks,
  listRulesForDesk,
  writeDeskTrace,
} from "./conductor-store";

export async function ingestGroupChat(args: {
  userId: string;
  text?: string;
  greet?: boolean;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const text = args.text?.trim().slice(0, 400) ?? "";
  const desks = await listDesks();
  if (desks.length === 0) {
    return { status: 200, body: { ok: true, messages: [] } };
  }

  if (args.greet && !text) {
    if (await hasGroupGreeting()) {
      return { status: 200, body: { ok: true, messages: [] } };
    }
    const lead = desks[0];
    const rules = await listRulesForDesk(lead.id);
    const reply = `Vi är ${desks.map((d) => d.name).join(", ")}. ${greetingForDesk({
      name: "gruppen",
      on: rules.filter((r) => r.enabled && r.approvedAt).length,
      waiting: rules.filter((r) => !r.approvedAt).length,
      titles: [],
    })}`;
    const message = await insertMessage({
      deskId: lead.id,
      thread: "group",
      role: "agent",
      text: reply,
    });
    return { status: 200, body: { ok: true, messages: [message] } };
  }

  if (!text) return { status: 400, body: { error: "TEXT_REQUIRED" } };

  await insertMessage({ thread: "group", role: "you", text });

  if (deskBrainEnabled()) {
    const brain = await thinkGroupTurn({
      desks: desks.map((d) => ({
        name: d.name,
        key: d.key,
        blurb: d.blurb,
        briefing: d.briefing,
      })),
      text,
    });
    if (brain) {
      const guarded = guardDrafts(brain.drafts);
      const usable = brain.ready && guarded.ok ? brain.drafts : [];
      if (brain.ready && !guarded.ok && brain.replies[0]) {
        brain.replies[0] = {
          ...brain.replies[0],
          text: `${brain.replies[0].text}\n\nJag lade inget utkast. ${guarded.reason}`.slice(
            0,
            1600
          ),
        };
      }
      const messages = [];
      for (const line of brain.replies) {
        const speaker = desks.find((d) => d.name === line.name) ?? desks[0];
        messages.push(
          await insertMessage({
            deskId: speaker.id,
            thread: "group",
            role: "agent",
            text: line.text,
          })
        );
        await writeDeskTrace({
          deskId: speaker.id,
          deskKey: speaker.key,
          deskName: speaker.name,
          model: brain.model,
          tokens: brain.tokens,
          purpose: "task",
          outcome: !guarded.ok
            ? "blocked"
            : brain.ready && usable.length
              ? "draft"
              : brain.ready
                ? "ok"
                : "questions",
        });
      }
      let firstRule = null;
      for (const draft of usable) {
        const speaker = desks.find((d) => d.name === draft.name);
        if (!speaker) continue;
        const rule = await createDraftRule(speaker, args.userId, draft.title, draft);
        firstRule ??= rule;
      }
      return { status: 200, body: { ok: true, messages, rule: firstRule } };
    }
  }

  const follow = followUpForText(text);
  if (follow && !looksLikeAutomation(text)) {
    const message = await insertMessage({
      deskId: desks[0].id,
      thread: "group",
      role: "agent",
      text: follow,
    });
    return { status: 200, body: { ok: true, messages: [message] } };
  }

  if (looksLikeAutomation(text) || /när /.test(text.toLowerCase())) {
    const blocked = guardDrafts([{ title: text }]);
    if (!blocked.ok) {
      const message = await insertMessage({
        deskId: desks[0].id,
        thread: "group",
        role: "agent",
        text: `Jag kan inte ta det. ${blocked.reason}`,
      });
      return { status: 200, body: { ok: true, messages: [message] } };
    }
    const draft = draftRuleFromText(text);
    const key = deskKeyForRule(draft.trigger, draft.action);
    const desk = desks.find((d) => d.key === key) ?? desks[0];
    let action = isConductorAction(draft.action) ? draft.action : "card.open";
    if (!actionAllowedForDesk(desk.key, desk.name, action)) action = "card.open";
    const trigger = isConductorEvent(draft.trigger)
      ? draft.trigger
      : "order.created";
    const rule = await createRule({
      title: draft.title,
      trigger,
      action,
      gate: defaultGateFor(action),
      createdBy: args.userId,
      deskId: desk.id,
      actionJson: JSON.stringify(draft.actionJson),
    });
    const message = await insertMessage({
      deskId: desk.id,
      thread: "group",
      role: "agent",
      text: `${desk.name}: ${replyForDraft({ title: rule.title, trigger, action })}`,
    });
    return { status: 200, body: { ok: true, messages: [message], rule } };
  }

  const message = await insertMessage({
    deskId: desks[0].id,
    thread: "group",
    role: "agent",
    text: intakeFallback("gruppen", text),
  });
  return { status: 200, body: { ok: true, messages: [message] } };
}
