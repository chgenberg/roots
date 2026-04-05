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

export async function chatCompletion(
  messages: ChatMessage[]
): Promise<AiResponse> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

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
  messages: ChatMessage[]
): AsyncGenerator<string> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS * 3);

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
  }
}
