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
import { SYSTEM_PROMPT } from "../lib/ai/system-prompt";

export const aiChat = new Hono();

const FALLBACK_RESPONSES = [
  "Just nu ar AI-assistenten inte tillganglig. Kontakta oss pa support@roots.se sa hjalper vi dig.",
  "Var AI-assistent ar tillfalligt nedstangd. Du hittar vanliga fragor pa var hemsida, eller maila support@roots.se.",
];

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

aiChat.post("/chat", async (c) => {
  const cookieHeader = c.req.header("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let session;
  try {
    session = await getSession(sessionId);
  } catch {
    return c.json({ error: "Session lookup failed" }, 500);
  }
  if (!session) {
    return c.json({ error: "Session expired" }, 401);
  }

  const rateCheck = await aiRateLimit(session.userId);
  if (!rateCheck.allowed) {
    return c.json(
      {
        error: "Rate limited",
        retryAfter: rateCheck.resetInSeconds,
      },
      429
    );
  }

  let body: { message: string; stream?: boolean; history?: ChatMessage[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.message || body.message.length > 2000) {
    return c.json({ error: "Invalid message" }, 400);
  }

  if (!isAiConfigured()) {
    const fallback =
      FALLBACK_RESPONSES[
        Math.floor(Math.random() * FALLBACK_RESPONSES.length)
      ];
    return c.json({
      reply: fallback,
      disclaimer: "AI-genererat svar -- verifiera viktig information",
      fallback: true,
    });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(body.history || []),
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
        console.error("[ai-chat] Streaming error:", err instanceof Error ? err.message : err);
        await stream.writeSSE({
          data: JSON.stringify({
            error: "AI temporarily unavailable",
            fallback: true,
          }),
        });
      }
    });
  }

  try {
    const response = await chatCompletion(messages);
    return c.json({
      reply: response.content,
      disclaimer: "AI-genererat svar -- verifiera viktig information",
      model: response.model,
    });
  } catch (err) {
    console.error("[ai-chat] Completion error:", err instanceof Error ? err.message : err);
    const fallback =
      FALLBACK_RESPONSES[
        Math.floor(Math.random() * FALLBACK_RESPONSES.length)
      ];
    return c.json({
      reply: fallback,
      disclaimer: "AI-genererat svar -- verifiera viktig information",
      fallback: true,
    });
  }
});

aiChat.get("/status", async (c) => {
  return c.json({
    enabled: isAiConfigured(),
    provider: "OpenAI",
  });
});
