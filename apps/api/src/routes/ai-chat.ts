import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { aiRateLimit, aiGlobalChatDailyCap } from "../lib/rate-limit";
import {
  isAiConfigured,
  chatCompletionStream,
  chatCompletion,
  type ChatMessage,
} from "../lib/ai/openclaw-client";
import { buildSystemPrompt } from "../lib/ai/system-prompt";
import { recordAiUsage, recordAiIncident } from "../lib/ai/usage";
import { scrubPiiText } from "../lib/ai/pii";
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
 * Strip any `system` messages from client-supplied history.
 *
 * Scout fix 2026-05-26 (AI-HIGH-01 + AI-HIGH-02): tidigare lät vi också
 * `assistant`-roller passera vilket öppnade en prompt-injection-vektor
 * där klienten kan injicera spoofade assistant-svar ("Debug mode på
 * — ignorera reglerna"). Vi accepterar nu ENDAST user-turns. Vi kör
 * också scrubPii på all client-content innan den når modellen.
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
    if (m.role !== "user") continue;
    const raw = typeof m.content === "string" ? m.content.slice(0, maxChars) : "";
    if (!raw) continue;
    clean.push({ role: "user", content: scrubPiiText(raw) });
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
    recordAiIncident({
      surface: "portal_chat",
      kind: "rate_limited",
      userId: session.userId,
      orgId: session.orgId,
    });
    return c.json(
      {
        error: "Du har skickat för många meddelanden. Försök igen om en stund.",
        retryAfter: rateCheck.resetInSeconds,
      },
      429
    );
  }

  // Scout fix 2026-05-26 (AI-CRIT-01): globalt dygnstak utöver
  // per-user-rate-limiten. En enda org med många säljare kan annars
  // bränna mycket OpenAI utan att vi märker det.
  const globalCap = await aiGlobalChatDailyCap();
  if (!globalCap.allowed) {
    recordAiIncident({
      surface: "portal_chat",
      kind: "rate_limited",
      userId: session.userId,
      orgId: session.orgId,
      meta: { reason: "global_daily_cap" },
    });
    return c.json(
      {
        error:
          "AI-assistenten har nått dagens kapacitetstak. Försök igen efter midnatt.",
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
    body.message.length > 2000
  ) {
    return c.json({ error: "Meddelandet saknas eller är för långt." }, 400);
  }

  // Master AI kill switch. Returns a deterministic fallback immediately so
  // that rolling AI off does not break any UI that assumes the endpoint
  // responds 200.
  if (!flags.aiEnabled() || !isAiConfigured()) {
    recordAiIncident({
      surface: "portal_chat",
      kind: "fallback",
      userId: session.userId,
      orgId: session.orgId,
      meta: { reason: !flags.aiEnabled() ? "kill_switch" : "not_configured" },
    });
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
    { role: "user", content: scrubPiiText(body.message) },
  ];

  if (body.stream) {
    // P2.31 (audit 2026-05-26): forwarda klientens disconnect-signal
    // till OpenAI så att vi inte fortsätter generera (= betala för)
    // tokens efter att browsern stängt.
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
    recordAiUsage({
      surface: "portal_chat",
      model: response.model,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      userId: session.userId,
      orgId: session.orgId,
    });
    return c.json({
      reply: response.content,
      disclaimer: DISCLAIMER,
      model: response.model,
    });
  } catch (err) {
    log.error({ err }, "Completion error");
    recordAiIncident({
      surface: "portal_chat",
      kind: "upstream_error",
      status: (err as { status?: number })?.status,
      userId: session.userId,
      orgId: session.orgId,
      meta: { message: (err as Error)?.message },
    });
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
