import { isAiConfigured } from "./ai/openclaw-client";
import { isValidReviewerUrl, readReviewerImage } from "./reviewer-media";
import { childLogger } from "./logger";

const log = childLogger("reviewer-llm");

const TIMEOUT_MS = 55_000;
const MAX_IMAGE_BYTES = 3_500_000;
const MAX_IMAGES = 8;

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL =
  process.env.OPENAI_REVIEWER_MODEL ||
  process.env.OPENAI_VISION_MODEL ||
  process.env.OPENAI_DEFAULT_MODEL ||
  "gpt-4o-mini";

export type ReviewerChatMessage = {
  role: "user" | "assistant";
  body: string;
  imageUrls: string[];
};

export type ReviewerLlmResult = {
  phase: "ask" | "ready";
  reply: string;
  cursorPrompt: string;
};

const CHAT_SYSTEM = `Du är agenten på Roots. Du pratar bara med granskaren, som beskriver vad som ska ändras i produkten.

Du kallar ALDRIG dig själv AI, Fable eller en modell. Säg "jag" eller "agenten".

Din uppgift i chatten:
1. Förstå vad granskaren vill ändra. Läs hens text OCH alla skärmdumpar noga.
2. Om något är otydligt: ställ 1–3 korta följdfrågor på svenska. En fråga i taget när det går. Fråga bara det som faktiskt saknas för att en ingenjör ska kunna bygga rätt.
3. När du förstår tillräckligt: bekräfta kort vad som ska ändras och be hen klicka på Skicka. Skriv ALDRIG något implementerarprompt, kod eller filnamn till hen.

Ställ följdfrågor om du saknar något av detta (skippa det hen redan svarat på):
- Vilken sida/URL eller vy (publik sajt, inloggad portal, förening, lag, shop, admin, kassa, e-post, PDF, mobil/desktop)?
- Vilken roll ser det (föreningsadmin, säljare, lagledare, intern admin, utloggad besökare)?
- Vad händer nu, och vad ska hända istället?
- Är det text, layout, färg, flöde, en bugg, eller ny funktion?
- Finns det undantag (bara mobil, bara engelska, bara en förening…)?

När phase är "ask": reply = dina följdfrågor på svenska.
När phase är "ready": reply = 2–4 svenska meningar som återger vad du förstått och säger att hen kan klicka på Skicka (eller skriva mer om något saknas). Nämn inte Cursor, Grok, Claude, AI eller modeller.

Svara ALLTID med ENDAST JSON, inget annat:
{"phase":"ask"|"ready","reply":"..."}`;

const PROMPT_SYSTEM = `Du skriver ett implementerarprompt som Christopher klistrar in i Cursor för Roots.

Du har granskarens hela chatt och skärmdumpar. Skriv ett LÅNGT, extremt detaljerat prompt på SVENSKA (minst 400 ord) så att en annan LLM kan utföra ändringen utan att gissa och utan att förstöra det som redan fungerar.

Följ EXAKT denna struktur:

# Uppgift
En mening som säger vad som ska bli sant när jobbet är klart.

# Produkt
Roots är plattformen för föreningsförsäljning av hårvård (shop, lag, förening, säljportal, kassa, utbetalningar). Stack: Next.js 15 App Router, Hono/tRPC API, Drizzle/Postgres, Railway. OpenAI för AI. Ändra bara det som behövs. Repot ligger på skrivbordet som Roots.

# Vad granskaren sett
Återge hens feedback i egna ord, plus en detaljerad beskrivning av varje skärmdump (layout, text, färger, vad som är fel, ungefär var på sidan). En ingenjör som inte ser bilden ska ändå förstå.

# Nuvarande beteende
# Önskat beteende
# Var i produkten
- URL/route om känd, annars bästa gissning uttalad som gissning
- Roll som berörs (förening / säljare / lag / admin / publik)
- Mobil / desktop / båda

# Acceptanskriterier
Numrerad lista. Varje punkt är observerbar.

# Vad du INTE får ändra
- Inget orelaterat flöde, ingen refaktor "på köpet"
- Rör inte QueenCloud och inte AWS-deploys
- Lägg inte till nya dependencies utan skäl

# Föreslagen implementation
Konkreta filer/komponenter om du kan gissa (märk gissningar). Annars beskriv ytan så en agent hittar filerna.

# Verifiering
Hur man klickar igenom ändringen i webbläsaren, plus en regression att kolla (närliggande sida/flöde).

Svara med ENDAST promptet, ingen JSON, ingen ingress.`;

type OpenAiContent = Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
>;

function mimeFor(contentType: string): string {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("gif")) return "image/gif";
  return "image/jpeg";
}

async function loadDataUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    if (out.length >= MAX_IMAGES) break;
    if (!isValidReviewerUrl(url)) continue;
    const upload = await readReviewerImage(url);
    if (!upload) continue;
    if (upload.bytes.length > MAX_IMAGE_BYTES) continue;
    const mime = mimeFor(upload.contentType);
    out.push(`data:${mime};base64,${upload.bytes.toString("base64")}`);
  }
  return out;
}

async function buildMessages(
  history: ReviewerChatMessage[]
): Promise<Array<{ role: "user" | "assistant"; content: OpenAiContent | string }> | null> {
  const recent = history.slice(-16);
  const imageBudget = new Map<number, string[]>();
  let imagesLeft = MAX_IMAGES;
  for (let i = recent.length - 1; i >= 0 && imagesLeft > 0; i--) {
    const msg = recent[i];
    if (msg.role !== "user" || msg.imageUrls.length === 0) continue;
    const take = msg.imageUrls.slice(0, imagesLeft);
    imageBudget.set(i, take);
    imagesLeft -= take.length;
  }

  const messages: Array<{
    role: "user" | "assistant";
    content: OpenAiContent | string;
  }> = [];
  for (let i = 0; i < recent.length; i++) {
    const msg = recent[i];
    if (msg.role === "assistant") {
      messages.push({ role: "assistant", content: msg.body || "…" });
      continue;
    }
    const take = imageBudget.get(i) ?? [];
    const dataUrls = take.length > 0 ? await loadDataUrls(take) : [];
    const skipped = msg.imageUrls.length - take.length;
    const text =
      msg.body.trim() || (dataUrls.length > 0 ? "(Skärmdump bifogad, ingen text.)" : "…");
    const note =
      skipped > 0
        ? `${text}\n(${skipped} tidigare skärmdump${skipped === 1 ? "" : "ar"} utelämnad${
            skipped === 1 ? "" : "e"
          } av storleksskäl.)`
        : text;
    if (dataUrls.length === 0) {
      messages.push({ role: "user", content: note });
      continue;
    }
    const content: OpenAiContent = [{ type: "text", text: note }];
    for (const url of dataUrls) {
      content.push({ type: "image_url", image_url: { url } });
    }
    messages.push({ role: "user", content });
  }
  return messages.length > 0 ? messages : null;
}

export function parseChat(raw: string): ReviewerLlmResult | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<ReviewerLlmResult>;
    const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
    if (!reply) return null;
    return {
      phase: obj.phase === "ready" ? "ready" : "ask",
      reply,
      cursorPrompt: "",
    };
  } catch {
    return null;
  }
}

export function transcriptFallback(history: ReviewerChatMessage[]): string {
  const lines = history
    .map((m) => {
      const who = m.role === "user" ? "Granskaren" : "Agenten";
      const pics = m.imageUrls.length ? ` [${m.imageUrls.length} skärmdump(ar)]` : "";
      return `${who}${pics}:\n${m.body || "(ingen text)"}`;
    })
    .join("\n\n");
  return [
    "# Uppgift",
    "Genomför ändringen som granskaren beskriver i chatten nedan, utan att röra orelaterade flöden.",
    "",
    "# Produkt",
    "Roots — föreningsförsäljning av hårvård. Stack: Next.js 15, Drizzle/Postgres, Railway. Repot: Roots på skrivbordet.",
    "",
    "# Vad granskaren sett",
    lines || "(tom tråd)",
    "",
    "# Nuvarande beteende",
    "Se chatten. Bekräfta i koden innan du ändrar.",
    "",
    "# Önskat beteende",
    "Det granskaren ber om, observerbart i UI.",
    "",
    "# Vad du INTE får ändra",
    "- Inget orelaterat flöde, ingen refaktor på köpet",
    "- Rör inte QueenCloud",
    "",
    "# Verifiering",
    "Klicka igenom den berörda ytan och en närliggande sida så inget annat gick sönder.",
  ].join("\n");
}

async function callModel(
  messages: Array<{ role: "user" | "assistant"; content: OpenAiContent | string }>,
  system: string,
  maxTokens: number
): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const payload = {
    model: OPENAI_MODEL,
    temperature: 0.3,
    max_completion_tokens: maxTokens,
    messages: [{ role: "system" as const, content: system }, ...messages],
  };
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error({ status: res.status, body: body.slice(0, 200) }, "openai reviewer failed");
      if (messages.some((m) => Array.isArray(m.content))) {
        const textOnly = messages.map((m) => ({
          role: m.role,
          content: Array.isArray(m.content)
            ? m.content
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("\n") || "…"
            : m.content,
        }));
        const retry = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            ...payload,
            messages: [{ role: "system" as const, content: system }, ...textOnly],
          }),
          signal: controller.signal,
        });
        if (!retry.ok) return null;
        const retryData = (await retry.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return retryData.choices?.[0]?.message?.content?.trim() || null;
      }
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    log.error({ err }, "openai reviewer threw");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function llmReviewerTurn(
  history: ReviewerChatMessage[]
): Promise<ReviewerLlmResult | null> {
  const messages = await buildMessages(history);
  if (!messages) return null;
  const raw = await callModel(messages, CHAT_SYSTEM, 800);
  if (!raw) {
    return {
      phase: history.filter((m) => m.role === "user").length >= 2 ? "ready" : "ask",
      reply:
        history.filter((m) => m.role === "user").length >= 2
          ? "Jag har antecknat det. Om det stämmer kan du klicka på Skicka — eller skriv mer om något saknas."
          : "Kan du förtydliga lite mer — vilken sida gäller det, och vad ska hända istället?",
      cursorPrompt: "",
    };
  }
  const parsed = parseChat(raw);
  if (parsed) return parsed;
  return {
    phase: "ask",
    reply:
      raw.replace(/```[\s\S]*?```/g, "").trim().slice(0, 1200) ||
      "Kan du förtydliga lite mer — vilken sida gäller det, och vad ska hända istället?",
    cursorPrompt: "",
  };
}

export async function llmReviewerPrompt(
  history: ReviewerChatMessage[]
): Promise<string | null> {
  const messages = await buildMessages(history);
  if (!messages) return transcriptFallback(history);
  messages.push({
    role: "user",
    content: "Skriv nu det fullständiga implementerarpromptet utifrån hela samtalet och skärmdumparna.",
  });
  const raw = await callModel(messages, PROMPT_SYSTEM, 6000);
  const prompt = raw?.replace(/^```[a-z]*\n?|\n?```$/g, "").trim() ?? "";
  if (prompt.length >= 200) return prompt;
  return transcriptFallback(history);
}
