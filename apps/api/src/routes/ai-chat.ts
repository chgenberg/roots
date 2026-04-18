import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { aiRateLimit } from "../lib/rate-limit";
import {
  isAiConfigured,
  chatCompletionStream,
  chatCompletion,
  type ChatMessage,
} from "../lib/ai/openclaw-client";
import { buildSystemPrompt } from "../lib/ai/system-prompt";
import { childLogger } from "../lib/logger";
import { flags } from "../lib/flags";

const log = childLogger("ai-chat");

export const aiChat = new Hono();

const FALLBACK_RESPONSES = [
  "Just nu är AI-assistenten inte tillgänglig. Kontakta oss på hej@roots.se så hjälper vi dig.",
  "Vår AI-assistent är tillfälligt nedstängd. Du hittar vanliga frågor på vår hemsida, eller maila hej@roots.se.",
];

const DISCLAIMER = "AI-genererat svar — verifiera viktig information";

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

/**
 * Strip any `system` messages from client-supplied history. Clients can
 * only contribute `user` / `assistant` turns; allowing `system` would let
 * a prompt-injection attacker override our real system prompt for the
 * remainder of the conversation.
 */
function sanitizeHistory(
  history: ChatMessage[] | undefined,
  maxMessages = 10,
  maxChars = 2000
): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  const clean: ChatMessage[] = [];
  for (const m of history.slice(-maxMessages)) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content.slice(0, maxChars) : "";
    if (!content) continue;
    clean.push({ role, content });
  }
  return clean;
}

function pickFallback(): string {
  return FALLBACK_RESPONSES[
    Math.floor(Math.random() * FALLBACK_RESPONSES.length)
  ];
}

aiChat.post("/chat", async (c) => {
  const cookieHeader = c.req.header("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return c.json({ error: "Inte inloggad." }, 401);
  }

  let session;
  try {
    session = await getSession(sessionId);
  } catch (err) {
    log.error({ err }, "Session lookup failed");
    return c.json({ error: "Sessionsfel." }, 500);
  }
  if (!session) {
    return c.json({ error: "Sessionen har gått ut." }, 401);
  }

  const rateCheck = await aiRateLimit(session.userId);
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
    body.message.length > 2000
  ) {
    return c.json({ error: "Meddelandet saknas eller är för långt." }, 400);
  }

  // Master AI kill switch. Returns a deterministic fallback immediately so
  // that rolling AI off does not break any UI that assumes the endpoint
  // responds 200.
  if (!flags.aiEnabled() || !isAiConfigured()) {
    const fallback = pickFallback();
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          data: JSON.stringify({ content: fallback, fallback: true }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      });
    }
    return c.json({ reply: fallback, disclaimer: DISCLAIMER, fallback: true });
  }

  const systemPrompt = buildSystemPrompt(
    session.role,
    session.demoProfile?.name
  );
  const sanitizedHistory = sanitizeHistory(body.history);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...sanitizedHistory,
    { role: "user", content: body.message },
  ];

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of chatCompletionStream(messages)) {
          await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
        }
        await stream.writeSSE({ data: "[DONE]" });
      } catch (err) {
        log.error({ err }, "Streaming error");
        await stream.writeSSE({
          data: JSON.stringify({
            error: "AI tillfälligt otillgänglig.",
            fallback: true,
          }),
        });
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  }

  try {
    const response = await chatCompletion(messages);
    return c.json({
      reply: response.content,
      disclaimer: DISCLAIMER,
      model: response.model,
    });
  } catch (err) {
    log.error({ err }, "Completion error");
    return c.json({
      reply: pickFallback(),
      disclaimer: DISCLAIMER,
      fallback: true,
    });
  }
});

aiChat.get("/status", async (c) => {
  return c.json({
    enabled: flags.aiEnabled() && isAiConfigured(),
    provider: "OpenAI",
  });
});
