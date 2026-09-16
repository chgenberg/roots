/**
 * Chatten i ringen: samma OpenAI-nyckel som portalchatten.
 * Kataloghänder är fortfarande tre. PAID, Fortnox-skick, bank, deploy
 * och lyft av mejlpaus finns inte.
 */

import { chatCompletion, isAiConfigured } from "../ai/openclaw-client";
import { flags } from "../flags";
import { childLogger } from "../logger";
import {
  compactBriefingForModel,
  compactHistory,
  stampBlocks,
} from "./briefing-blocks";
import {
  CONDUCTOR_EVENTS,
  actionsForDesk,
  isConductorAction,
  isConductorEvent,
  toolNoteForDesk,
} from "./conductor-catalog";
import { REPLY_SHAPE, topicFor, topicQuestions, type DeskTopic } from "./desk-topics";

const log = childLogger("desk-brain");

const DESK_TIMEOUT_MS = 20_000;
const DESK_MAX_TOKENS = 2048;

export type DeskBrainDraft = {
  title: string;
  trigger: string;
  action: string;
};

export type DeskBrainOut = {
  reply: string;
  blurb: string | null;
  briefing: string | null;
  drafts: DeskBrainDraft[];
  questions: string[];
  ready: boolean;
  model: string;
  tokens: number;
};

export type GroupBrainLine = { name: string; text: string };

export type GroupBrainOut = {
  replies: GroupBrainLine[];
  drafts: (DeskBrainDraft & { name: string })[];
  questions: string[];
  ready: boolean;
  model: string;
  tokens: number;
};

const INTAKE =
  "Ett uppdrag är inte klart förrän du kan utföra det. Säg inte ja och släpp. Ställ 3–6 konkreta motfrågor tills underlaget räcker. Använd fragor_tills_klart för ämnet. Be aldrig om API-nycklar, tokens eller lösen i chatten — fråga vem som håller åtkomsten. Skriv svaren du redan har i briefing. Avsluta briefing med KLART: nej och SAKNAS: … så länge något fattas. När allt finns: KLART: ja och ta bort SAKNAS. ready=true bara då. drafts bara när ready=true och chefen gav När→gör ur katalogen. Åtgärder: card.open, email.draft, fortnox.draft. fortnox.draft bara på Pengar. Mejl går inte ut. PAID, Fortnox-skick, bank, deploy och lyft av mejlpaus finns inte.";

const TRAIN_SYSTEM = `Du utbildar en anställd på Roots. Svara som den personen, på svenska.

Regler:
- Kalla dig vid namn eller "jag". Skriv aldrig AI, AI:n, modellnamn eller Grok.
- ${INTAKE}
- Briefing i block: JAG / GÖR / VET / SAKNAS / LÄRDOM / KLART. Behåll lärdomar.
- Exempel: "sköt föreningar" → fråga vilken händelse, första leverans, vem godkänner. Fortnox → vad som ska i utkastet, när, vem som trycker bokför. Inte "jag tar det".
- blurb: en rad, max 160 tecken.
- Svara ENDAST JSON: {"reply":"...","blurb":"...","briefing":"...","questions":["..."],"ready":false,"drafts":[]}
- reply: ${REPLY_SHAPE} Inga emojis.`;

const TASK_SYSTEM = `Du är en anställd på Roots. Svara som den personen, på svenska.

Regler:
- Kalla dig vid namn eller "jag". Skriv aldrig AI eller modellnamn.
- Följ briefing (JAG/GÖR/VET/SAKNAS/LÄRDOM). Om något saknas: fråga. Uppdatera briefing med nya svar. Behåll lärdomar.
- ${INTAKE}
- Svara ENDAST JSON: {"reply":"...","blurb":null,"briefing":null,"questions":["..."],"ready":false,"drafts":[]}
- reply: ${REPLY_SHAPE} Inga emojis.`;

const GROUP_SYSTEM = `Du är rummet med anställda på Roots. Svara som 1–3 av dem, på svenska.

Regler:
- Varje replik är en namngiven anställd ur listan. Kalla er vid namn. Skriv aldrig AI eller modellnamn.
- Ledaren planerar. Andra utför. Enkla jobb: en. Breda: två till tre. Aldrig fler.
- Den som tar uppdraget ställer 3–6 motfrågor tills underlaget räcker. Använd fragor_tills_klart. Be aldrig om nycklar i chatten. Säg inte ja och släpp. ready=true bara när ni kan utföra det.
- drafts tomma tills ready. Inte PAID, Fortnox-skick, bank, deploy eller lyft av mejlpaus.
- Varje text: ${REPLY_SHAPE}
- Svara ENDAST JSON: {"replies":[{"name":"...","text":"..."}],"questions":["..."],"ready":false,"drafts":[]}`;

export function deskBrainEnabled(): boolean {
  return flags.aiEnabled() && isAiConfigured();
}

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function scrubDeskText(text: string): string {
  return text
    .replace(/\b(?:Grok|Fable|Claude|GPT-?\d*(?:\.\d+)?(?:-mini)?)\b/gi, "agenten")
    .replace(/\bAI:n\b/gi, "agenten")
    .replace(/\bAI-?\b/gi, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function asDraft(row: unknown): DeskBrainDraft | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
  const trigger = typeof o.trigger === "string" ? o.trigger : "";
  const action = typeof o.action === "string" ? o.action : "";
  if (!title || !isConductorEvent(trigger) || !isConductorAction(action)) {
    return null;
  }
  return { title, trigger, action };
}

function asQuestions(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((row): row is string => typeof row === "string" && row.trim().length > 6)
    .map((row) => scrubDeskText(row).replace(/\?+$/, "").slice(0, 200))
    .filter(Boolean)
    .slice(0, 6);
}

function withQuestions(reply: string, questions: string[], ready: boolean): string {
  if (ready || questions.length === 0) return reply;
  const marks = (reply.match(/\?/g) || []).length;
  if (marks >= Math.min(2, questions.length)) return reply;
  const lines = questions.map((q, i) => `${i + 1}. ${q}?`).join("\n");
  return `${reply}\n\n${lines}`.slice(0, 1600);
}

function stampOpenBriefing(
  briefing: string | null,
  questions: string[],
  ready: boolean,
  fallback: string
): string | null {
  const existing = (briefing || fallback).trim();
  if (!existing && !ready) return null;
  return stampBlocks({
    existing: existing || briefing,
    saknas: ready
      ? ""
      : questions.length > 0
        ? questions.join("; ")
        : "mer om uppdraget",
    ready,
  });
}

export function parseDeskOut(
  obj: Record<string, unknown> | null,
  fallbackBrief: string,
  allowed: string[],
  meta: { model: string; tokens: number },
  topic: DeskTopic
): DeskBrainOut | null {
  if (!obj) return null;
  const reply = typeof obj.reply === "string" ? scrubDeskText(obj.reply).slice(0, 1600) : "";
  if (reply.length < 8) return null;
  const blurb =
    typeof obj.blurb === "string" && obj.blurb.trim()
      ? scrubDeskText(obj.blurb).slice(0, 160)
      : null;
  const rawBriefing =
    typeof obj.briefing === "string" && obj.briefing.trim()
      ? scrubDeskText(obj.briefing).slice(0, 2400)
      : null;
  const asked = asQuestions(obj.questions);
  const ready = obj.ready === true && asked.length === 0;
  const questions =
    ready || asked.length > 0
      ? asked
      : topicQuestions(topic).map((q) => q.replace(/\?+$/, ""));
  const briefing = stampOpenBriefing(rawBriefing, questions, ready, fallbackBrief);
  const drafts =
    ready && Array.isArray(obj.drafts)
      ? obj.drafts
          .map(asDraft)
          .filter((d): d is DeskBrainDraft => d !== null && allowed.includes(d.action))
          .slice(0, 4)
      : [];
  return {
    reply: withQuestions(reply, questions, ready),
    blurb,
    briefing,
    drafts,
    questions,
    ready,
    model: meta.model,
    tokens: meta.tokens,
  };
}

function scaleForJob(text: string): number {
  const lower = text.toLowerCase();
  if (/alla|hela ringen|alla anställda/.test(lower)) return 3;
  if (/\boch\b|både |två /.test(lower)) return 2;
  return 1;
}

type BrainCall = { obj: Record<string, unknown> | null; model: string; tokens: number };

async function completeJson(system: string, user: string): Promise<BrainCall> {
  if (!deskBrainEnabled()) {
    return { obj: null, model: "", tokens: 0 };
  }
  try {
    const res = await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { timeoutMs: DESK_TIMEOUT_MS, maxTokens: DESK_MAX_TOKENS }
    );
    const tokens =
      (res.usage?.promptTokens ?? 0) + (res.usage?.completionTokens ?? 0);
    return {
      obj: res.content ? parseJsonObject(res.content) : null,
      model: res.model,
      tokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 160) : String(err);
    log.warn({ msg }, "desk-brain call failed");
    return { obj: null, model: "", tokens: 0 };
  }
}

export async function thinkDeskTurn(input: {
  desk: { name: string; key: string; blurb: string; briefing?: string };
  text: string;
  history: { role: "you" | "agent"; text: string }[];
  rules: { title: string; approved: boolean }[];
  mode?: "train" | "task";
}): Promise<DeskBrainOut | null> {
  const allowed = actionsForDesk(input.desk.key, input.desk.name);
  const mode = input.mode ?? "task";
  const topic = topicFor(input.text || "", input.desk);
  const call = await completeJson(
    mode === "train" ? TRAIN_SYSTEM : TASK_SYSTEM,
    JSON.stringify({
      anstalld: {
        name: input.desk.name,
        key: input.desk.key,
        blurb: input.desk.blurb,
      },
      utbildning: compactBriefingForModel(input.desk.briefing),
      verktyg: toolNoteForDesk(input.desk.key, input.desk.name),
      tillatna: allowed,
      uppdrag: input.rules,
      chatt: compactHistory(input.history, 4),
      meddelande: input.text || null,
      katalog: { events: CONDUCTOR_EVENTS, actions: allowed },
      fragor_tills_klart: topicQuestions(topic),
    })
  );
  const fallback = [input.desk.briefing, input.text].filter(Boolean).join("\n").slice(0, 800);
  return parseDeskOut(
    call.obj,
    fallback,
    allowed,
    { model: call.model, tokens: call.tokens },
    topic
  );
}

export async function thinkGroupTurn(input: {
  desks: { name: string; key: string; blurb: string; briefing?: string }[];
  text: string;
}): Promise<GroupBrainOut | null> {
  const cap = scaleForJob(input.text);
  const topic = topicFor(input.text);
  const call = await completeJson(
    GROUP_SYSTEM,
    JSON.stringify({
      anstallda: input.desks.map((d) => ({
        name: d.name,
        key: d.key,
        blurb: d.blurb,
        utbildning: compactBriefingForModel(d.briefing),
        verktyg: toolNoteForDesk(d.key, d.name),
        tillatna: actionsForDesk(d.key, d.name),
      })),
      max_anstallda: cap,
      meddelande: input.text,
      katalog: { events: CONDUCTOR_EVENTS },
      fragor_tills_klart: topicQuestions(topic),
    })
  );
  const obj = call.obj;
  if (!obj) return null;
  const names = new Set(input.desks.map((d) => d.name));
  const replies: GroupBrainLine[] = [];
  if (Array.isArray(obj.replies)) {
    for (const row of obj.replies) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const text = typeof o.text === "string" ? scrubDeskText(o.text).slice(0, 600) : "";
      if (!name || !names.has(name) || text.length < 8) continue;
      replies.push({ name, text });
      if (replies.length >= cap) break;
    }
  }
  if (replies.length === 0) return null;
  const asked = asQuestions(obj.questions);
  const ready = obj.ready === true && asked.length === 0;
  const questions =
    ready || asked.length > 0
      ? asked
      : topicQuestions(topic).map((q) => q.replace(/\?+$/, ""));
  if (replies[0] && !ready) {
    replies[0] = {
      ...replies[0],
      text: withQuestions(replies[0].text, questions, ready).slice(0, 1600),
    };
  }
  const drafts: (DeskBrainDraft & { name: string })[] = [];
  if (ready && Array.isArray(obj.drafts)) {
    for (const row of obj.drafts) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const speaker = input.desks.find((d) => d.name === name);
      const draft = asDraft(row);
      if (!name || !names.has(name) || !draft || !speaker) continue;
      if (!actionsForDesk(speaker.key, speaker.name).includes(draft.action as never)) {
        continue;
      }
      drafts.push({ ...draft, name });
      if (drafts.length >= cap) break;
    }
  }
  return {
    replies,
    drafts,
    questions,
    ready,
    model: call.model,
    tokens: call.tokens,
  };
}
