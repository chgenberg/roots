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
function buildFallbackAnalysis(reason: "ai-off" | "ai-error"): string {
  const summary =
    reason === "ai-off"
      ? "AI är inte konfigurerat på servern. Kontakta oss på hej@roots.se för personlig rådgivning."
      : "Vi kunde inte göra en fullständig analys just nu, men du kan börja här. Maila hej@roots.se så återkommer vi med personlig rådgivning.";

  return JSON.stringify({
    summary,
    observationsFromImages: [],
    hairProfile: { texture: "—", shine: "—", scalpNotes: "—" },
    lifestyleTips: [
      "Tvätta håret 2–3 gånger i veckan med ett milt schampo.",
      "Undvik överdriven värme (föna på låg temp, hoppa över plattången när det går).",
      "Använd balsam regelbundet — fokusera på längderna, inte hårbotten.",
    ],
    nutritionGeneralTips: [
      "Drick tillräckligt med vatten varje dag.",
      "Ät varierat med fokus på protein, omega-3 och järnrika livsmedel.",
    ],
    rootsProductRecommendation: {
      packageName: "Roots Underhåll",
      description:
        "Roots Complete Kit fungerar som en enkel trestegsrutin för dagligt underhåll.",
    },
    disclaimer:
      "Indikativ information — ersätter inte professionell vård av frisör eller hudläkare.",
  });
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
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON" }, 400);
  }

  if (!body.consentAccepted) {
    return c.json({ error: "Samtycke krävs" }, 400);
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: "En giltig e-postadress krävs" }, 400);
  }

  const back = body.backImage?.trim();
  const top = body.topImage?.trim();
  if (!back || !top) {
    return c.json({ error: "Båda bilderna krävs" }, 400);
  }
  if (back.length > MAX_IMAGE_CHARS || top.length > MAX_IMAGE_CHARS) {
    return c.json({ error: "Bilderna är för stora. Prova mindre filer." }, 413);
  }
  if (!isValidImageDataUrl(back) || !isValidImageDataUrl(top)) {
    return c.json({ error: "Ogiltigt bildformat. Använd JPEG, PNG eller WebP." }, 400);
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
        error: rl.degraded
          ? "Tjänsten är tillfälligt överbelastad. Försök igen om en stund."
          : "Du har nått maxgränsen för analyser idag. Försök igen imorgon.",
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
        error:
          "Vision-analysen har nått dagens kapacitetstak. Försök igen efter midnatt eller kontakta oss.",
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
      ageConfirmed: body.ageConfirmed ?? false,
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
      analysis: buildFallbackAnalysis("ai-off"),
      model: "none",
      disclaimer:
        "Indikativ information — ersätter inte professionell vård.",
    });
  }

  try {
    const result = await runHairAnalysisVision({
      backDataUrl: back.startsWith("data:") ? back : `data:image/jpeg;base64,${back}`,
      topDataUrl: top.startsWith("data:") ? top : `data:image/jpeg;base64,${top}`,
      answers,
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
      disclaimer:
        "AI-genererad analys — verifiera viktig information. Ersätter inte professionell vård.",
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
      analysis: buildFallbackAnalysis("ai-error"),
      model: "fallback",
      disclaimer:
        "Indikativ information — ersätter inte professionell vård.",
    });
  }
});
