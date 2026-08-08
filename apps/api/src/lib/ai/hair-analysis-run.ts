import { isAiConfigured } from "./openclaw-client";

/**
 * Scout fix 2026-05-26 (AI-CRIT-03): EXIF + extra metadata strippas
 * från JPEG/PNG/WEBP bilder INNAN vi skickar dem till OpenAI Vision.
 *
 * Tidigare forwardades base64 verbatim → GPS-koordinater, enhetsinfo
 * och tidsstämplar följde med till tredje part. Detta är ett juridiskt
 * problem (biometrisk data + lokationsspårning) och en användarintegri-
 * tetsfråga.
 *
 * Implementation utan deps:
 *   - JPEG (FFD8): ta bort alla APP-markers (FFE0..FFEF) som innehåller
 *     EXIF/XMP/IPTC. Bildens scan-data är intakt.
 *   - PNG (89504E47): ta bort tEXt/iTXt/zTXt/eXIf/tIME-chunks.
 *   - WEBP (RIFF): ta bort EXIF + XMP-chunks.
 *
 * Funktionen är "best-effort" — en korrupt bild som inte matchar
 * magic-bytes returneras oförändrad och avvisas senare av OpenAI
 * istället för att vi failar tyst.
 */
function stripJpegAppMarkers(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) {
      out.push(...buf.subarray(i).values());
      break;
    }
    const marker = buf[i + 1];
    // SOS (FFDA) → resten är bildscan-data, kopiera oförändrat
    if (marker === 0xda) {
      out.push(...buf.subarray(i).values());
      break;
    }
    // Standalone markers (FF01, FFD0-FFD7, FFD8, FFD9) saknar payload
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const size = buf.readUInt16BE(i + 2);
    if (marker >= 0xe0 && marker <= 0xef) {
      // APP0-APP15 — innehåller EXIF/JFIF/XMP/etc, hoppa över
      i += 2 + size;
      continue;
    }
    out.push(...buf.subarray(i, i + 2 + size).values());
    i += 2 + size;
  }
  return Buffer.from(out);
}

function stripPngTextChunks(buf: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) return buf;
  const stripped: Buffer[] = [Buffer.from(sig)];
  let i = 8;
  const TEXT_TYPES = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME", "iCCP"]);
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const total = 12 + len; // length + type + data + crc
    if (i + total > buf.length) break;
    if (!TEXT_TYPES.has(type)) {
      stripped.push(buf.subarray(i, i + total));
    }
    i += total;
  }
  return Buffer.concat(stripped);
}

function stripWebpMetadataChunks(buf: Buffer): Buffer {
  if (
    buf.length < 12 ||
    buf.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buf.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return buf;
  }
  const out: Buffer[] = [buf.subarray(0, 12)];
  let i = 12;
  const STRIP = new Set(["EXIF", "XMP "]);
  while (i + 8 <= buf.length) {
    const fourcc = buf.subarray(i, i + 4).toString("ascii");
    const size = buf.readUInt32LE(i + 4);
    const padded = size + (size % 2); // chunk-padding
    if (i + 8 + padded > buf.length) break;
    if (!STRIP.has(fourcc)) {
      out.push(buf.subarray(i, i + 8 + padded));
    }
    i += 8 + padded;
  }
  // Reskriv total file-size header
  const total = out.slice(1).reduce((s, b) => s + b.length, 4);
  out[0].writeUInt32LE(total, 4);
  return Buffer.concat(out);
}

export function stripImageMetadata(dataUrl: string): string {
  try {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) return dataUrl;
    const mime = m[1].toLowerCase();
    const buf = Buffer.from(m[2], "base64");
    // Node-typningen har skärpts (Buffer<ArrayBuffer> vs <ArrayBufferLike>).
    // Funktionerna returnerar tekniskt sett samma byte-buffert; vi normali-
    // serar via Uint8Array för att slippa fightas med strict generics.
    let cleaned: Uint8Array = buf;
    if (mime === "image/jpeg" || mime === "image/jpg") {
      cleaned = stripJpegAppMarkers(buf);
    } else if (mime === "image/png") {
      cleaned = stripPngTextChunks(buf);
    } else if (mime === "image/webp") {
      cleaned = stripWebpMetadataChunks(buf);
    } else {
      return dataUrl;
    }
    return `data:${mime};base64,${Buffer.from(cleaned).toString("base64")}`;
  } catch {
    // Fail-soft: ogiltig data → låt OpenAI avvisa istället för att vi
    // failar tyst innan request når validatorn.
    return dataUrl;
  }
}

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
  usage?: { promptTokens: number; completionTokens: number };
}

function buildBranchingContext(answers: HairAnswers, locale: "sv" | "en"): string {
  const hints: string[] = [];
  const en = locale === "en";

  if (answers.hairType === "torrt" || answers.notes?.toLowerCase().includes("torrt")) {
    hints.push(
      en
        ? "The user reports dry hair — prioritise moisture and gentle cleansing in recommendations."
        : "Användaren rapporterar torrt hår — prioritera fukt och mild rengöring i rekommendationer."
    );
  }
  if (answers.scalpCondition === "kliar" || answers.scalpCondition === "flagnar") {
    hints.push(
      en
        ? "The user has scalp concerns — include seeing a qualified dermatologist if symptoms persist."
        : "Användaren har hårbottenbesvär — inkludera att söka legitimerad hudläkare vid ihållande symtom."
    );
  }
  if (answers.chemicalTreatment === "blek" || answers.chemicalTreatment === "annat") {
    hints.push(
      en
        ? "Chemically treated hair — emphasise repairing and protective care."
        : "Kemiskt belastat hår — betona reparerande och skyddande vård."
    );
  }
  if (Number(answers.stressSleep) >= 4) {
    hints.push(
      en
        ? "High stress level — mention the stress/hair link and general sleep advice."
        : "Hög stressnivå — nämn samband stress/hår och allmänna råd om sömn."
    );
  }
  if (answers.swimFrequency === "regelbundet" || answers.swimFrequency === "dagligen") {
    hints.push(
      en
        ? "Frequent chlorine/salt exposure — recommend gentle cleansing and moisturising after swimming."
        : "Frekvent exponering för klor/salt — rekommendera mild rengöring och återfuktning efter simning."
    );
  }

  if (hints.length === 0) return "";
  return en
    ? "\n\nBRANCHING CONTEXT (prioritise these in the reply):\n" + hints.join("\n")
    : "\n\nBRANCHING-KONTEXT (prioritera dessa i svaret):\n" + hints.join("\n");
}

function buildUserPrompt(answers: HairAnswers, locale: "sv" | "en"): string {
  if (locale === "en") {
    return [
      "You receive two user photos: hair from behind and hair from above.",
      "",
      "STEP 1 — IMAGE VALIDATION:",
      "First check that the images show hair/head. If not, reply with:",
      '{"imageValidationFailed": true, "message": "We could not identify hair in the photos. Please upload new photos that clearly show your hair."}',
      "",
      "STEP 2 — ANALYSIS (if the images show hair):",
      "Clearly separate OBSERVATION (what you actually see) and HYPOTHESIS (a reasonable interpretation).",
      "Make NO medical diagnoses (e.g. alopecia, psoriasis). Instead phrase: 'may suggest … see a qualified dermatologist if concerns persist.'",
      "",
      "STEP 3 — PRODUCT MAPPING:",
      "Map to ONE of three Roots packs based on the analysis:",
      "- 'Roots Maintenance' — for normal hair without major concerns. Roots Schampoo (shampoo with SyriCalm® + low-sulphate surfactants) + Roots Conditioner (with SyriCalm®, Pro-Vitamin B5 and vitamin E) + Roots Body Wash (with SyriCalm® and panthenol)",
      "- 'Roots Extra Moisture' — for dry, chemically treated or stressed hair. Emphasise Pro-Vitamin B5 (panthenol) in Roots Conditioner and Beta Vulgaris betaine (deep moisture, elasticity) plus vitamin E/antioxidants for protection",
      "- 'Roots Balanced Routine' — for combination/oily hair or active people who swim/train often. Emphasise SyriCalm® (Phragmites Communis + Poria Cocos) which soothes and balances the scalp and Polyquaternium in Roots Schampoo which detangles without weighing hair down",
      "",
      "Reply strictly as JSON with these keys:",
      `{
  "summary": "string (3 sentences in professional British English)",
  "observationsFromImages": ["string (start each with OBSERVATION: or HYPOTHESIS:)"],
  "hairProfile": { "texture": "string", "shine": "string", "scalpNotes": "string" },
  "lifestyleTips": ["string"],
  "nutritionGeneralTips": ["string (general health advice, not individual dietitian assessment)"],
  "rootsProductRecommendation": {
    "packageName": "Roots Maintenance | Roots Extra Moisture | Roots Balanced Routine",
    "description": "string (why this pack fits, linked to shampoo/conditioner/body wash)"
  },
  "disclaimer": "string (short: indicative, does not replace professional care)"
}`,
      "",
      "Questionnaire answers (context):",
      JSON.stringify(answers, null, 0),
      buildBranchingContext(answers, "en"),
    ].join("\n");
  }

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
    "- 'Roots Underhåll' — för normalt hår utan stora besvär. Roots Schampoo (schampo med SyriCalm® + sulfatsnåla tvättämnen) + Roots Conditioner (balsam med SyriCalm®, Pro-Vitamin B5 och E-vitamin) + Roots Body Wash (body wash med SyriCalm® och panthenol)",
    "- 'Roots Extra Fukt' — för torrt, kemiskt behandlat eller stressat hår. Betona Pro-Vitamin B5 (panthenol) i Roots Conditioner och Beta Vulgaris-betain (djupfukt, elasticitet) samt E-vitamin/antioxidanter som skyddar",
    "- 'Roots Balanserad Rutin' — för blandat/fett hår eller aktiva som simmar/tränar ofta. Betona SyriCalm® (Phragmites Communis + Poria Cocos) som lugnar och balanserar hårbotten och Polyquaternium i Roots Schampoo som reder ut utan att tynga",
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
    buildBranchingContext(answers, "sv"),
  ].join("\n");
}

export async function runHairAnalysisVision(input: {
  backDataUrl: string;
  topDataUrl: string;
  answers: HairAnswers;
  locale?: "sv" | "en";
}): Promise<HairAnalysisResult> {
  if (!isAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const locale = input.locale === "en" ? "en" : "sv";

  // Scout fix 2026-05-26 (AI-CRIT-03): strippa EXIF/metadata innan
  // bilden skickas vidare till OpenAI. stripImageMetadata är fail-soft
  // — okänd format passerar oförändrad.
  const cleanBack = stripImageMetadata(input.backDataUrl);
  const cleanTop = stripImageMetadata(input.topDataUrl);

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: buildUserPrompt(input.answers, locale) },
    { type: "image_url", image_url: { url: cleanBack } },
    { type: "image_url", image_url: { url: cleanTop } },
  ];

  const system =
    locale === "en"
      ? "You are an experienced hair and scalp adviser for consumers in the Nordics. " +
        "You make OBSERVATIONS based on the photos and combine them with the user's reported habits. " +
        "You always clearly separate what you SEE (observation) from what you INTERPRET (hypothesis). " +
        "You NEVER make medical diagnoses — if a dermatological condition is suspected, refer to a qualified dermatologist. " +
        "You always recommend one of the three Roots packs (Maintenance, Extra Moisture, Balanced Routine). " +
        "All nutrition tips are general health advice, not individual dietitian assessment. " +
        "ALWAYS reply in professional British English. Reply ONLY with valid JSON — no text outside the JSON object."
      : "Du är en erfaren hår- och hårbottenrådgivare för konsumenter i Norden. " +
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
      // P3.35: exponera usage så routern kan loggge `ai.usage`.
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens as number,
            completionTokens: data.usage.completion_tokens as number,
          }
        : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}
