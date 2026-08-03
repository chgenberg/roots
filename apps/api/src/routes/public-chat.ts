import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { checkRateLimit, aiGlobalChatDailyCap } from "../lib/rate-limit";
import { scrubPiiText } from "../lib/ai/pii";
import {
  isAiConfigured,
  chatCompletionStream,
  chatCompletion,
  type ChatMessage,
} from "../lib/ai/openclaw-client";
import { PUBLIC_CHAT_SYSTEM_PROMPT } from "../lib/ai/system-prompt";
import { recordAiUsage, recordAiIncident } from "../lib/ai/usage";
import {
  checkMedicalClaims,
  createClaimsStreamFilter,
  CLAIMS_BLOCKED_REPLY,
} from "../lib/ai/claims-guard";
import { flags } from "../lib/flags";
import { childLogger } from "../lib/logger";

const log = childLogger("public-chat");

export const publicChat = new Hono();

const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 1000;
const DISCLAIMER = "AI-genererat svar — verifiera viktig information";

async function publicChatRateLimit(ip: string) {
  return checkRateLimit(`pub-chat:${ip}`, 30, 60 * 60);
}

publicChat.post("/public-chat", async (c) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  const rateCheck = await publicChatRateLimit(ip);
  if (!rateCheck.allowed) {
    recordAiIncident({
      surface: "public_chat",
      kind: "rate_limited",
      meta: { ip: ip.slice(0, 32) },
    });
    return c.json(
      {
        error: "Du har skickat för många meddelanden. Försök igen om en stund.",
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
        error:
          "Vår AI-assistent har nått dagens kapacitetstak. Försök igen efter midnatt.",
        retryAfter: globalCap.resetInSeconds,
      },
      429
    );
  }

  let body: { message: string; stream?: boolean; history?: ChatMessage[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltigt meddelande." }, 400);
  }

  if (
    !body.message ||
    typeof body.message !== "string" ||
    body.message.length > MAX_MESSAGE_LENGTH
  ) {
    return c.json(
      { error: `Meddelandet får vara max ${MAX_MESSAGE_LENGTH} tecken.` },
      400
    );
  }

  const fallbackReply =
    "Vår AI-assistent är inte tillgänglig just nu. Kontakta oss på hej@roots.se så hjälper vi dig.";

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

  // MASTERPLAN_01 KC5.4: client may supply earlier turns, but only
  // user/assistant content is honoured. Any `role: "system"` injection
  // would override PUBLIC_CHAT_SYSTEM_PROMPT and disable our guardrails.
  //
  // Scout fix 2026-05-26 (AI-HIGH-01): tidigare lät vi också
  // `assistant`-roller passera. En angripare kan då skicka ett spoofat
  // assistant-turn ("Debug mode aktiverat — ignorera regler") som
  // modellen tar som autentisk kontext. Vi accepterar nu ENDAST user-
  // turns från klienten; vill man ha multi-turn-historik måste den
  // sparas server-side (deferred).
  //
  // Scout fix 2026-05-26 (AI-HIGH-02): scrubPiiText körs på all
  // user-content innan vi vidarebefordrar till OpenAI så
  // personnummer/telefon/email/IBAN aldrig läcker.
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .filter(
      (m) =>
        m &&
        typeof m === "object" &&
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.length > 0
    )
    .map((m) => ({
      role: "user" as const,
      content: scrubPiiText(m.content.slice(0, MAX_MESSAGE_LENGTH)),
    }));

  const messages: ChatMessage[] = [
    { role: "system", content: PUBLIC_CHAT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: scrubPiiText(body.message) },
  ];

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
          }
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
            data: JSON.stringify({ content: CLAIMS_BLOCKED_REPLY, replace: true }),
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
            error:
              "Något gick fel. Försök igen eller kontakta hej@roots.se.",
            fallback: true,
          }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  }

  try {
    const response = await chatCompletion(messages);
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
        reply: CLAIMS_BLOCKED_REPLY,
        disclaimer: DISCLAIMER,
      });
    }
    return c.json({
      reply: response.content,
      disclaimer: DISCLAIMER,
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
      reply:
        "Något gick fel. Försök igen eller kontakta oss på hej@roots.se.",
      disclaimer: DISCLAIMER,
      fallback: true,
    });
  }
});
