const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_DEFAULT_MODEL || "gpt-5.4-mini";
const TIMEOUT_MS = Number(process.env.OPENAI_MCP_TIMEOUT_MS) || 10000;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export function isAiConfigured(): boolean {
  return (
    !!OPENAI_API_KEY &&
    !OPENAI_API_KEY.includes("REPLACE-ME") &&
    !OPENAI_API_KEY.startsWith("sk-stub")
  );
}

/**
 * P3.38 (audit 2026-05-26): tidigare blev alla OpenAI-fel till en
 * generisk `Error("OpenAI API error: ${status}")` utan att skilja på
 * 429/503/410. Callers kunde inte göra retry-with-backoff eller välja
 * fallback-modell. OpenAiError exponerar status och retryAfter så
 * routes kan svara "snälla vänta" istället för att 500:a omedelbart.
 */
export class OpenAiError extends Error {
  public readonly status: number;
  public readonly retryAfterMs: number | null;
  public readonly body: string;

  constructor(status: number, body: string, retryAfterMs: number | null) {
    super(`OpenAI API error: ${status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    this.name = "OpenAiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.body = body;
  }

  /** True när retry har en realistisk chans att lyckas. */
  public isRetryable(): boolean {
    return this.status === 429 || this.status === 503 || this.status >= 500;
  }
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asNumber = Number(header);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function postWithRetry(
  body: object,
  signal: AbortSignal,
  maxRetries = 2
): Promise<Response> {
  let lastErr: OpenAiError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const res = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return res;

    const text = await res.text().catch(() => "");
    const err = new OpenAiError(
      res.status,
      text,
      parseRetryAfterMs(res.headers.get("retry-after"))
    );
    if (!err.isRetryable() || attempt === maxRetries) throw err;

    lastErr = err;
    const backoffMs =
      err.retryAfterMs ?? Math.min(2000 * (attempt + 1), 5000);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, backoffMs);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        },
        { once: true }
      );
    });
  }
  throw lastErr || new OpenAiError(500, "unknown", null);
}

export async function chatCompletion(
  messages: ChatMessage[]
): Promise<AiResponse> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await postWithRetry(
      {
        model: OPENAI_MODEL,
        messages,
        max_completion_tokens: 1024,
      },
      controller.signal
    );

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      model: data.model || OPENAI_MODEL,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function* chatCompletionStream(
  messages: ChatMessage[],
  // P2.31 (audit 2026-05-26): caller kan skicka in en upstream-signal
  // (typiskt c.req.raw.signal i en SSE-route) så att vi avbryter
  // OpenAI-anropet när klienten stänger. Tidigare körde OpenAI-
  // streaming vidare till TIMEOUT_MS*3 även när browsern var död →
  // bränd pengar på tokens ingen läser.
  upstreamSignal?: AbortSignal
): AsyncGenerator<string> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS * 3);
  const onUpstreamAbort = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", onUpstreamAbort, { once: true });
  }

  try {
    const res = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_completion_tokens: 1024,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", onUpstreamAbort);
    }
  }
}
