import { Hono } from "hono";
import { isAiConfigured } from "../lib/ai/openclaw-client";
import { runHairAnalysisVision, type HairAnswers } from "../lib/ai/hair-analysis-run";
import { recordAiUsage, recordAiIncident } from "../lib/ai/usage";
import { hairAnalysisIpRateLimit, aiGlobalVisionDailyCap } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";
import { flags } from "../lib/flags";
import { redis } from "../lib/redis";
// Scout fix 2026-05-26 (AI-HIGH-02): sanitizeNotes + scrubPii flyttade
// till delad `lib/ai/pii.ts` så public-chat / portal-chat kan använda
// samma regex-bank. Ingen logisk förändring av semantiken.
import { sanitizeNotes, scrubPiiText as scrubPii } from "../lib/ai/pii";

const log = childLogger("hair-analysis");

export const hairAnalysis = new Hono();

// P2.32 (audit 2026-05-26): Redis-cache för hair-analysis-resultat
// keyed på idempotencyKey. TTL 60 min — tillräckligt för retries och
// duplicate submits men inte så långt att stale resultat blir
// problem. Fail-soft: en cache-fel ska aldrig bryta vision-anropet.
type CachedVisionResult = {
  analysis: string;
  model: string;
  disclaimer: string;
  fallback?: boolean;
};
const VISION_CACHE_TTL_S = 60 * 60;
const visionResultCache = {
  async get(key: string): Promise<CachedVisionResult | null> {
    try {
      const raw = await redis.get(`hair-vision:${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as CachedVisionResult;
    } catch {
      return null;
    }
  },
  async set(key: string, value: CachedVisionResult): Promise<void> {
    try {
      await redis.set(
        `hair-vision:${key}`,
        JSON.stringify(value),
        "EX",
        VISION_CACHE_TTL_S
      );
    } catch {
      // ignore — cache-fail får inte blockera response
    }
  },
};

// P2.33 (audit 2026-05-26): 6.5 MB base64 var avsiktligt generöst
// för iPhone-orörda bilder, men det är fortfarande ~4.8 MB binärt
// och varje request konsumerar lika mycket OpenAI-Vision-tokens.
// Sänker till 2.5 MB base64 (~1.8 MB binärt) vilket täcker normala
// telefonfoton men stoppar uppladdning av RAW/4K-fotos.
const MAX_IMAGE_CHARS = 2_500_000;
const VALID_MIME_PREFIXES = [
  "data:image/jpeg",
  "data:image/png",
  "data:image/webp",
  "data:image/jpg",
];

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const xf = c.req.header("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return c.req.header("x-real-ip") || "unknown";
}

function isValidImageDataUrl(s: string): boolean {
  if (!s.startsWith("data:")) return true; // raw base64 without prefix is allowed
  return VALID_MIME_PREFIXES.some((p) => s.startsWith(p));
}

/**
 * MASTERPLAN_01 KC5.1: strukturerad fallback som matchar samma JSON-form
 * som AI-svaret. Wizard:en kan rendera den utan att krascha; supportern
 * får i värsta fall en generisk men hjälpsam Roots-rekommendation
 * istället för en blank 502-skärm.
 */
function buildFallbackAnalysis(
  reason: "ai-off" | "ai-error",
  locale: "sv" | "en" = "sv"
): string {
  const en = locale === "en";
  const summary =
    reason === "ai-off"
      ? en
        ? "AI is not configured on the server. Contact us at hej@roots.se for personal advice."
        : "AI är inte konfigurerat på servern. Kontakta oss på hej@roots.se för personlig rådgivning."
      : en
        ? "We could not complete a full analysis right now, but you can start here. Email hej@roots.se and we will get back with personal advice."
        : "Vi kunde inte göra en fullständig analys just nu, men du kan börja här. Maila hej@roots.se så återkommer vi med personlig rådgivning.";

  return JSON.stringify({
    summary,
    observationsFromImages: [],
    hairProfile: { texture: "—", shine: "—", scalpNotes: "—" },
    lifestyleTips: en
      ? [
          "Wash your hair 2–3 times a week with a mild shampoo.",
          "Avoid excessive heat (blow-dry on low heat, skip the straightener when you can).",
          "Use conditioner regularly — focus on the lengths, not the scalp.",
        ]
      : [
          "Tvätta håret 2–3 gånger i veckan med ett milt schampo.",
          "Undvik överdriven värme (föna på låg temp, hoppa över plattången när det går).",
          "Använd balsam regelbundet — fokusera på längderna, inte hårbotten.",
        ],
    nutritionGeneralTips: en
      ? [
          "Drink enough water every day.",
          "Eat a varied diet with protein, omega-3 and iron-rich foods.",
        ]
      : [
          "Drick tillräckligt med vatten varje dag.",
          "Ät varierat med fokus på protein, omega-3 och järnrika livsmedel.",
        ],
    rootsProductRecommendation: {
      packageName: en ? "Roots Maintenance" : "Roots Underhåll",
      description: en
        ? "The Roots Complete pack is a simple three-step routine for everyday maintenance."
        : "Roots Complete Kit fungerar som en enkel trestegsrutin för dagligt underhåll.",
    },
    disclaimer: en
      ? "Indicative information — does not replace professional care from a hairdresser or dermatologist."
      : "Indikativ information — ersätter inte professionell vård av frisör eller hudläkare.",
  });
}

function hairCopy(locale: "sv" | "en") {
  const en = locale === "en";
  return {
    unavailable: en
      ? "This feature is not available."
      : "Funktionen är inte tillgänglig.",
    invalidJson: en ? "Invalid JSON" : "Ogiltig JSON",
    consentRequired: en ? "Consent is required" : "Samtycke krävs",
    ageRequired: en
      ? "The analysis requires that you are 18 or older, or have a guardian's consent."
      : "Analysen kräver att du är 18 år eller äldre, eller har målsmans godkännande.",
    emailRequired: en
      ? "A valid email address is required"
      : "En giltig e-postadress krävs",
    bothImages: en ? "Both photos are required" : "Båda bilderna krävs",
    imagesTooLarge: en
      ? "The photos are too large. Please try smaller files."
      : "Bilderna är för stora. Prova mindre filer.",
    invalidImage: en
      ? "Invalid image format. Use JPEG, PNG or WebP."
      : "Ogiltigt bildformat. Använd JPEG, PNG eller WebP.",
    overloaded: en
      ? "The service is temporarily overloaded. Please try again in a moment."
      : "Tjänsten är tillfälligt överbelastad. Försök igen om en stund.",
    dailyLimit: en
      ? "You have reached today's analysis limit. Please try again tomorrow."
      : "Du har nått maxgränsen för analyser idag. Försök igen imorgon.",
    globalCap: en
      ? "Vision analysis has reached today's capacity. Please try again after midnight or contact us."
      : "Vision-analysen har nått dagens kapacitetstak. Försök igen efter midnatt eller kontakta oss.",
    disclaimerIndicative: en
      ? "Indicative information — does not replace professional care."
      : "Indikativ information — ersätter inte professionell vård.",
    disclaimerAi: en
      ? "AI-generated analysis — please verify important information. Does not replace professional care."
      : "AI-genererad analys — verifiera viktig information. Ersätter inte professionell vård.",
  };
}

hairAnalysis.post("/hair-analysis", async (c) => {
  let body: {
    consentAccepted?: boolean;
    consentVersion?: string;
    email?: string;
    newsletterConsent?: boolean;
    ageConfirmed?: boolean;
    backImage?: string;
    topImage?: string;
    answers?: Partial<HairAnswers>;
    idempotencyKey?: string;
    locale?: string;
  };
  // Funktionen är gömd i webbens UI via en konstant. Utan samma spärr här
  // ligger endpointen öppen för den som hittar den — och varje anrop är
  // vision-tokens vi betalar för.
  try {
    body = await c.req.json();
  } catch {
    const headerLocale =
      c.req.header("x-roots-locale") === "en" ? "en" : "sv";
    return c.json(
      {
        error: headerLocale === "en" ? "Invalid JSON" : "Ogiltig JSON",
      },
      400
    );
  }

  const locale = body.locale === "en" ? "en" : "sv";
  const copy = hairCopy(locale);

  if (!flags.hairAnalysisEnabled()) {
    return c.json({ error: copy.unavailable }, 404);
  }

  if (!body.consentAccepted) {
    return c.json({ error: copy.consentRequired }, 400);
  }

  // Åldersgrind. Klienten skickade tidigare alltid ageConfirmed: true utan
  // att någon kryssruta fanns, och servern sparade vad klienten sa. Det
  // innebar att porträtt av minderåriga kunde skickas till OpenAI Vision.
  // Nu krävs ett aktivt ja, och kryssrutan finns i dialogen.
  if (body.ageConfirmed !== true) {
    return c.json(
      {
        error: copy.ageRequired,
        requiresAgeConfirmation: true,
      },
      400
    );
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: copy.emailRequired }, 400);
  }

  const back = body.backImage?.trim();
  const top = body.topImage?.trim();
  if (!back || !top) {
    return c.json({ error: copy.bothImages }, 400);
  }
  if (back.length > MAX_IMAGE_CHARS || top.length > MAX_IMAGE_CHARS) {
    return c.json({ error: copy.imagesTooLarge }, 413);
  }
  if (!isValidImageDataUrl(back) || !isValidImageDataUrl(top)) {
    return c.json({ error: copy.invalidImage }, 400);
  }

  const answers: HairAnswers = {
    washFrequency: body.answers?.washFrequency || "okänt",
    heatTools: body.answers?.heatTools || "okänt",
    chemicalTreatment: body.answers?.chemicalTreatment || "okänt",
    swimFrequency: body.answers?.swimFrequency || "okänt",
    stressSleep: body.answers?.stressSleep || "okänt",
    hairType: body.answers?.hairType || "okänt",
    scalpCondition: body.answers?.scalpCondition || "okänt",
    notes: scrubPii(sanitizeNotes(body.answers?.notes || "")),
  };

  const ip = clientIp(c);
  // MASTERPLAN_01 KC5.2: rate-limit hanterar nu Redis-fel internt
  // (fail-closed i prod, fail-open i dev). Vi behöver bara honorera
  // resultatet — tidigare svalde routen rate-limit-error och släppte
  // ALLT igenom även i prod.
  const rl = await hairAnalysisIpRateLimit(ip);
  if (!rl.allowed) {
    return c.json(
      {
        error: rl.degraded ? copy.overloaded : copy.dailyLimit,
        retryAfter: rl.resetInSeconds,
      },
      429
    );
  }

  const idempotencyKey =
    c.req.header("idempotency-key") || body.idempotencyKey || null;

  // P2.32 (audit 2026-05-26): kolla cache först — om samma
  // idempotencyKey har returnerat ett vision-svar inom senaste
  // timmen, returnera det istället för en ny dyr OpenAI-Vision-
  // anrop. Hjälper också mot dubbla klick / nätverks-retries.
  if (idempotencyKey) {
    try {
      const cached = await visionResultCache.get(idempotencyKey);
      if (cached) {
        return c.json({ ...cached, cached: true });
      }
    } catch (cacheErr) {
      log.warn({ err: cacheErr }, "Vision cache lookup failed");
    }
  }

  // Scout fix 2026-05-26 (AI-CRIT-01): globalt dygnstak utöver per-IP.
  // Måste köras EFTER cache-hit-checken så vi inte räknar cached
  // resultat mot budgeten. Default 2000 vision-calls/dygn ≈ kostnads-
  // tak; justera via AI_GLOBAL_VISION_DAILY_CAP i env.
  const globalCap = await aiGlobalVisionDailyCap();
  if (!globalCap.allowed) {
    recordAiIncident({
      surface: "hair_analysis",
      kind: "rate_limited",
      meta: { reason: "global_daily_cap" },
    });
    return c.json(
      {
        error: copy.globalCap,
        retryAfter: globalCap.resetInSeconds,
      },
      429
    );
  }

  // Save lead to database (best-effort — don't block on failure)
  try {
    const { db, hairAnalysisLeads } = await import("@roots/db");
    await db.insert(hairAnalysisLeads).values({
      email: body.email!,
      consentVersion: body.consentVersion || "2026-04-02",
      newsletterConsent: body.newsletterConsent ?? false,
      ageConfirmed: true,
      ipAddress: ip,
      idempotencyKey: idempotencyKey ?? undefined,
    });
  } catch (dbErr) {
    // Idempotency-key conflict or DB issue — log but continue
    log.warn({ err: dbErr }, "Lead save failed");
  }

  // Connection-audit P1 #10: respect the master AI kill-switch. Vision
  // tokens are the most expensive AI call we make, so a flipped
  // AI_ENABLED=false must stop them — not just the chat endpoints.
  if (!flags.aiEnabled() || !isAiConfigured()) {
    return c.json({
      fallback: true,
      analysis: buildFallbackAnalysis("ai-off", locale),
      model: "none",
      disclaimer: copy.disclaimerIndicative,
    });
  }

  try {
    const result = await runHairAnalysisVision({
      backDataUrl: back.startsWith("data:") ? back : `data:image/jpeg;base64,${back}`,
      topDataUrl: top.startsWith("data:") ? top : `data:image/jpeg;base64,${top}`,
      answers,
      locale,
    });
    recordAiUsage({
      surface: "hair_analysis",
      model: result.model,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
    });
    const payload: CachedVisionResult = {
      analysis: result.raw,
      model: result.model,
      disclaimer: copy.disclaimerAi,
    };
    if (idempotencyKey) {
      void visionResultCache.set(idempotencyKey, payload);
    }
    return c.json(payload);
  } catch (e) {
    // MASTERPLAN_01 KC5.1: tidigare returnerade vi 502 med råa
    // OpenAI-felmeddelanden — wizard:en kraschade och supportern såg
    // en blank skärm. Nu loggar vi felet server-side (för ops/Sentry)
    // och returnerar samma JSON-form som ett lyckat svar, med
    // fallback=true så frontenden kan visa "vi kunde inte göra full
    // analys" istället för "OpenAI 503: …".
    log.error({ err: e, ip }, "hair-analysis vision call failed");
    recordAiIncident({
      surface: "hair_analysis",
      kind: "upstream_error",
      meta: { message: (e as Error)?.message },
    });
    return c.json({
      fallback: true,
      analysis: buildFallbackAnalysis("ai-error", locale),
      model: "fallback",
      disclaimer: copy.disclaimerIndicative,
    });
  }
});
