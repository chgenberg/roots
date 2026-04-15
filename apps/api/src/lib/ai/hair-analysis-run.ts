import { isAiConfigured } from "./openclaw-client";

const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ||
  process.env.OPENAI_DEFAULT_MODEL ||
  "gpt-5.4-mini";

const TIMEOUT_MS = Math.min(
  Number(process.env.OPENAI_HAIR_ANALYSIS_TIMEOUT_MS) || 120000,
  180000
);

export interface HairAnswers {
  washFrequency: string;
  heatTools: string;
  chemicalTreatment: string;
  swimFrequency: string;
  stressSleep: string;
  hairType: string;
  scalpCondition: string;
  notes: string;
}

export interface HairAnalysisResult {
  raw: string;
  model: string;
}

function buildBranchingContext(answers: HairAnswers): string {
  const hints: string[] = [];

  if (answers.hairType === "torrt" || answers.notes?.toLowerCase().includes("torrt")) {
    hints.push("Användaren rapporterar torrt hår — prioritera fukt och mild rengöring i rekommendationer.");
  }
  if (answers.scalpCondition === "kliar" || answers.scalpCondition === "flagnar") {
    hints.push("Användaren har hårbottenbesvär — inkludera att söka legitimerad hudläkare vid ihållande symtom.");
  }
  if (answers.chemicalTreatment === "blek" || answers.chemicalTreatment === "annat") {
    hints.push("Kemiskt belastat hår — betona reparerande och skyddande vård.");
  }
  if (Number(answers.stressSleep) >= 4) {
    hints.push("Hög stressnivå — nämn samband stress/hår och allmänna råd om sömn.");
  }
  if (answers.swimFrequency === "regelbundet" || answers.swimFrequency === "dagligen") {
    hints.push("Frekvent exponering för klor/salt — rekommendera mild rengöring och återfuktning efter simning.");
  }

  return hints.length > 0 ? "\n\nBRANCHING-KONTEXT (prioritera dessa i svaret):\n" + hints.join("\n") : "";
}

function buildUserPrompt(answers: HairAnswers): string {
  return [
    "Du får två användarbilder: hår bakifrån och hår uppifrån.",
    "",
    "STEG 1 — BILDVALIDERING:",
    "Kontrollera först att bilderna visar hår/huvud. Om inte, svara med:",
    '{"imageValidationFailed": true, "message": "Vi kunde inte identifiera hår i bilderna. Ladda upp nya bilder som tydligt visar ditt hår."}',
    "",
    "STEG 2 — ANALYS (om bilderna visar hår):",
    "Skilja tydligt mellan OBSERVATION (vad du faktiskt ser) och HYPOTES (rimlig tolkning).",
    "Gör INGA medicinska diagnoser (t.ex. alopeci, psoriasis). Formulera istället: 'kan tyda på … sök legitimerad hudläkare vid ihållande besvär.'",
    "",
    "STEG 3 — PRODUKTMAPPNING:",
    "Mappa till ETT av tre Roots-paket baserat på analysen:",
    "- 'Roots Underhåll' — för normalt hår utan stora besvär. First Growth (schampo med björkextrakt, panthenol, niacinamid) + Pure Root (balsam med havtornsolja, sheabutter, argan) + Soft Rinse (body wash med lingonextrakt, kamomill)",
    "- 'Roots Extra Fukt' — för torrt, kemiskt behandlat eller stressat hår. Betona Pure Roots havtornsolja (omega 3/6/7/9, vitamin A/C/E) och First Growths panthenol (djupfukt, elasticitet)",
    "- 'Roots Balanserad Rutin' — för blandat/fett hår eller aktiva som simmar/tränar ofta. Betona First Growths björkextrakt (balanserar hårbotten, antibakteriellt) och Soft Rinses lingonextrakt (antioxidanter, lugnande)",
    "",
    "Svara strikt som JSON med dessa nycklar:",
    `{
  "summary": "string (3 meningar på svenska, professionell ton)",
  "observationsFromImages": ["string (börja varje med OBSERVATION: eller HYPOTES:)"],
  "hairProfile": { "texture": "string", "shine": "string", "scalpNotes": "string" },
  "lifestyleTips": ["string"],
  "nutritionGeneralTips": ["string (allmänna hälsoråd, inte individuell dietistbedömning)"],
  "rootsProductRecommendation": {
    "packageName": "Roots Underhåll | Roots Extra Fukt | Roots Balanserad Rutin",
    "description": "string (varför detta paket passar, kopplat till schampo/balsam/body wash)"
  },
  "disclaimer": "string (kort: indikativt, ersätter inte professionell vård)"
}`,
    "",
    "Frågesvar (kontext):",
    JSON.stringify(answers, null, 0),
    buildBranchingContext(answers),
  ].join("\n");
}

export async function runHairAnalysisVision(input: {
  backDataUrl: string;
  topDataUrl: string;
  answers: HairAnswers;
}): Promise<HairAnalysisResult> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: buildUserPrompt(input.answers) },
    { type: "image_url", image_url: { url: input.backDataUrl } },
    { type: "image_url", image_url: { url: input.topDataUrl } },
  ];

  const system =
    "Du är en erfaren hår- och hårbottenrådgivare för konsumenter i Norden. " +
    "Du gör OBSERVATIONER baserat på bilderna och kombinerar dessa med användarens rapporterade vanor. " +
    "Du skiljer alltid tydligt på vad du SER (observation) och vad du TOLKAR (hypotes). " +
    "Du ställer ALDRIG medicinska diagnoser — vid misstänkt dermatologiskt tillstånd hänvisar du till legitimerad hudläkare. " +
    "Du rekommenderar alltid ett av de tre Roots-paketen (Underhåll, Extra Fukt, Balanserad Rutin). " +
    "Alla kosttips är allmänna hälsoråd, inte individuell dietistbedömning. " +
    "Svara alltid på svenska. Svara ENDAST med giltig JSON — ingen text utanför JSON-objektet.";

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
        model: VISION_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 2500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API error: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return {
      raw,
      model: data.model || VISION_MODEL,
    };
  } finally {
    clearTimeout(timeout);
  }
}
