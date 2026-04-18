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
import { flags } from "../lib/flags";

export const publicChat = new Hono();

const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 1000;

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

  const history = (body.history || []).slice(-MAX_HISTORY).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m.content).slice(0, MAX_MESSAGE_LENGTH),
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: PUBLIC_CHAT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: body.message },
  ];

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of chatCompletionStream(messages)) {
          await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
        }
        await stream.writeSSE({ data: "[DONE]" });
      } catch {
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
    return c.json({ reply: response.content, model: response.model });
  } catch {
    return c.json({
      reply:
        "Något gick fel. Försök igen eller kontakta oss på hej@roots.se.",
      fallback: true,
    });
  }
});
