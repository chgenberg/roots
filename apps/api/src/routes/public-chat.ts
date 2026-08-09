import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { checkRateLimit, aiGlobalChatDailyCap } from "../lib/rate-limit";
import { scrubPiiText } from "../lib/ai/pii";
import {
  isAiConfigured,
  chatCompletionStream,
  chatCompletion,
  PUBLIC_CHAT_MODEL,
  type ChatMessage,
} from "../lib/ai/openclaw-client";
import { publicChatSystemPrompt } from "../lib/ai/system-prompt";
import { recordAiUsage, recordAiIncident } from "../lib/ai/usage";
import {
  checkMedicalClaims,
  createClaimsStreamFilter,
  CLAIMS_BLOCKED_REPLY,
  CLAIMS_BLOCKED_REPLY_EN,
} from "../lib/ai/claims-guard";
import { flags } from "../lib/flags";
import { childLogger } from "../lib/logger";

const log = childLogger("public-chat");

export const publicChat = new Hono();

const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 1000;

function chatCopy(locale: string | undefined) {
  const en = locale === "en";
  return {
    rateLimited: en
      ? "You have sent too many messages. Please try again in a moment."
      : "Du har skickat för många meddelanden. Försök igen om en stund.",
    dailyCap: en
      ? "Our AI assistant has reached today's capacity. Please try again after midnight."
      : "Vår AI-assistent har nått dagens kapacitetstak. Försök igen efter midnatt.",
    invalid: en ? "Invalid message." : "Ogiltigt meddelande.",
    tooLong: en
      ? `Messages may be at most ${MAX_MESSAGE_LENGTH} characters.`
      : `Meddelandet får vara max ${MAX_MESSAGE_LENGTH} tecken.`,
    fallback: en
      ? "Our AI assistant is unavailable right now. Contact us at info@roots.nu and we will help you."
      : "Vår AI-assistent är inte tillgänglig just nu. Kontakta oss på info@roots.nu så hjälper vi dig.",
    streamError: en
      ? "Something went wrong. Please try again or contact info@roots.nu."
      : "Något gick fel. Försök igen eller kontakta info@roots.nu.",
    completionError: en
      ? "Something went wrong. Please try again or contact us at info@roots.nu."
      : "Något gick fel. Försök igen eller kontakta oss på info@roots.nu.",
    disclaimer: en
      ? "AI-generated reply — please verify important information"
      : "AI-genererat svar — verifiera viktig information",
    claimsBlocked: en ? CLAIMS_BLOCKED_REPLY_EN : CLAIMS_BLOCKED_REPLY,
  };
}

async function publicChatRateLimit(ip: string) {
  return checkRateLimit(`pub-chat:${ip}`, 30, 60 * 60);
}

/**
 * Build a safe alternating user/assistant history for multi-turn chat.
 * Drops system roles, empty turns, and consecutive same-role messages
 * (anti-spoof for stacked fake assistant turns).
 */
function sanitizePublicChatHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || content.trim().length === 0) continue;
    const text = scrubPiiText(content.slice(0, MAX_MESSAGE_LENGTH));
    if (!text) continue;
    if (out.length === 0) {
      if (role !== "user") continue;
      out.push({ role, content: text });
      continue;
    }
    const prev = out[out.length - 1]!;
    if (prev.role === role) {
      if (role === "user") {
        prev.content = `${prev.content}\n${text}`.slice(0, MAX_MESSAGE_LENGTH);
      }
      // Skip consecutive assistant — likely spoofed context injection.
      continue;
    }
    out.push({ role, content: text });
  }
  return out;
}

publicChat.post("/public-chat", async (c) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  let body: {
    message: string;
    stream?: boolean;
    history?: ChatMessage[];
    locale?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    const headerLocale =
      c.req.header("x-roots-locale") === "en" ? "en" : "sv";
    return c.json(
      {
        error:
          headerLocale === "en" ? "Invalid message." : "Ogiltigt meddelande.",
      },
      400
    );
  }

  const locale = body.locale === "en" ? "en" : "sv";
  const copy = chatCopy(locale);

  const rateCheck = await publicChatRateLimit(ip);
  if (!rateCheck.allowed) {
    recordAiIncident({
      surface: "public_chat",
      kind: "rate_limited",
      meta: { ip: ip.slice(0, 32) },
    });
    return c.json(
      {
        error: copy.rateLimited,
        retryAfter: rateCheck.resetInSeconds,
      },
      429
    );
  }

  // Scout fix 2026-05-26 (AI-CRIT-01): globalt dygnstak. Per-IP räcker
  // inte mot botnet eller delade kontorsnätverk. Taket över hela
  // plattformen sätts i rate-limit.ts och justeras via env.
  const globalCap = await aiGlobalChatDailyCap();
  if (!globalCap.allowed) {
    recordAiIncident({
      surface: "public_chat",
      kind: "rate_limited",
      meta: { reason: "global_daily_cap" },
    });
    return c.json(
      {
        error: copy.dailyCap,
        retryAfter: globalCap.resetInSeconds,
      },
      429
    );
  }

  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: copy.invalid }, 400);
  }
  if (body.message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: copy.tooLong }, 400);
  }

  const fallbackReply = copy.fallback;

  if (!flags.aiEnabled() || !isAiConfigured()) {
    recordAiIncident({
      surface: "public_chat",
      kind: "fallback",
      meta: { reason: !flags.aiEnabled() ? "kill_switch" : "not_configured" },
    });
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          data: JSON.stringify({ content: fallbackReply, fallback: true }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      });
    }
    return c.json({ reply: fallbackReply, fallback: true });
  }

  // MASTERPLAN_01 KC5.4: client may supply earlier turns, but never
  // `role: "system"` (would override PUBLIC_CHAT_SYSTEM_PROMPT).
  //
  // Multi-turn needs both user and assistant turns. We accept assistant
  // content only when it alternates after a user turn (spoofed stacked
  // assistant messages are dropped). System prompt + claims-guard still
  // override any jailbreak text smuggled into history.
  //
  // Scout fix 2026-05-26 (AI-HIGH-02): scrubPiiText on all forwarded text.
  const history = sanitizePublicChatHistory(body.history);

  const messages: ChatMessage[] = [
    { role: "system", content: publicChatSystemPrompt(locale) },
    ...history,
    { role: "user", content: scrubPiiText(body.message) },
  ];
  const claimsBlockedReply = copy.claimsBlocked;
  const modelOpts = {
    model: PUBLIC_CHAT_MODEL,
    // Sonnet 5 can take longer on first token than mini models.
    timeoutMs: Number(process.env.OPENAI_PUBLIC_CHAT_TIMEOUT_MS) || 45000,
  };

  if (body.stream) {
    // P2.31 (audit 2026-05-26): forwarda klientens disconnect-signal
    // till upstream OpenAI så vi inte fortsätter token-spend efter
    // att en publik chatt-flik stängts.
    const upstreamSignal = c.req.raw.signal;
    const guard = createClaimsStreamFilter();
    return streamSSE(c, async (stream) => {
      try {
        const generator = chatCompletionStream(
          messages,
          upstreamSignal,
          (usage) => {
            recordAiUsage({
              surface: "public_chat",
              model: usage.model,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              meta: { streamed: true, aborted: usage.aborted },
            });
          },
          modelOpts
        );
        let blocked = false;
        for await (const chunk of generator) {
          if (upstreamSignal.aborted) break;
          const result = guard.push(chunk);
          if (result.blocked) {
            blocked = true;
            recordAiIncident({
              surface: "public_chat",
              kind: "claims_blocked",
              meta: { matched: result.matched ?? null },
            });
            await generator.return(undefined as never);
            break;
          }
          if (result.emit) {
            await stream.writeSSE({ data: JSON.stringify({ content: result.emit }) });
          }
        }
        if (!blocked) {
          const tail = guard.flush();
          if (tail.blocked) {
            blocked = true;
            recordAiIncident({ surface: "public_chat", kind: "claims_blocked" });
          } else if (tail.emit) {
            await stream.writeSSE({ data: JSON.stringify({ content: tail.emit }) });
          }
        }
        if (blocked) {
          await stream.writeSSE({
            data: JSON.stringify({
              content: claimsBlockedReply,
              replace: true,
            }),
          });
        }
        if (!upstreamSignal.aborted) {
          await stream.writeSSE({ data: "[DONE]" });
        }
      } catch (err) {
        if (upstreamSignal.aborted) return;
        log.error({ err, ip }, "public-chat streaming error");
        await stream.writeSSE({
          data: JSON.stringify({
            error: copy.streamError,
            fallback: true,
          }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  }

  try {
    const response = await chatCompletion(messages, modelOpts);
    recordAiUsage({
      surface: "public_chat",
      model: response.model,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
    });
    const claims = checkMedicalClaims(response.content);
    if (!claims.ok) {
      recordAiIncident({
        surface: "public_chat",
        kind: "claims_blocked",
        meta: { matched: claims.matched ?? null },
      });
      return c.json({
        reply: claimsBlockedReply,
        disclaimer: copy.disclaimer,
      });
    }
    return c.json({
      reply: response.content,
      disclaimer: copy.disclaimer,
      model: response.model,
    });
  } catch (err) {
    log.error({ err, ip }, "public-chat completion error");
    recordAiIncident({
      surface: "public_chat",
      kind: "upstream_error",
      status: (err as { status?: number })?.status,
      meta: { message: (err as Error)?.message },
    });
    return c.json({
      reply: copy.completionError,
      disclaimer: copy.disclaimer,
      fallback: true,
    });
  }
});
