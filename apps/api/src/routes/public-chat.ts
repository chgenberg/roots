import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { checkRateLimit } from "../lib/rate-limit";
import {
  isAiConfigured,
  chatCompletionStream,
  chatCompletion,
  type ChatMessage,
} from "../lib/ai/openclaw-client";
import { PUBLIC_CHAT_SYSTEM_PROMPT } from "../lib/ai/system-prompt";
import { recordAiUsage, recordAiIncident } from "../lib/ai/usage";
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
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .filter(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0
    )
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  const messages: ChatMessage[] = [
    { role: "system", content: PUBLIC_CHAT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: body.message },
  ];

  if (body.stream) {
    // P2.31 (audit 2026-05-26): forwarda klientens disconnect-signal
    // till upstream OpenAI så vi inte fortsätter token-spend efter
    // att en publik chatt-flik stängts.
    const upstreamSignal = c.req.raw.signal;
    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of chatCompletionStream(messages, upstreamSignal)) {
          if (upstreamSignal.aborted) break;
          await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
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
