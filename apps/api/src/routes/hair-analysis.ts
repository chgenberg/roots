import { Hono } from "hono";
import { isAiConfigured } from "../lib/ai/openclaw-client";
import { runHairAnalysisVision, type HairAnswers } from "../lib/ai/hair-analysis-run";
import { hairAnalysisIpRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";

const log = childLogger("hair-analysis");

export const hairAnalysis = new Hono();

const MAX_IMAGE_CHARS = 6_500_000;
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
    notes: (body.answers?.notes || "").slice(0, 2000),
  };

  const ip = clientIp(c);
  try {
    const rl = await hairAnalysisIpRateLimit(ip);
    if (!rl.allowed) {
      return c.json(
        { error: "Du har nått maxgränsen för analyser idag. Försök igen imorgon.", retryAfter: rl.resetInSeconds },
        429
      );
    }
  } catch {
    // Redis unavailable — allow in development
  }

  const idempotencyKey =
    c.req.header("idempotency-key") || body.idempotencyKey || null;

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

  if (!isAiConfigured()) {
    return c.json({
      fallback: true,
      analysis: JSON.stringify({
        summary:
          "AI är inte konfigurerat på servern. Kontakta oss på hej@roots.se för personlig rådgivning.",
        observationsFromImages: [],
        hairProfile: { texture: "—", shine: "—", scalpNotes: "—" },
        lifestyleTips: ["Välj milda produkter och undvik överdriven värme."],
        nutritionGeneralTips: ["Ät varierat och se till att få i dig tillräckligt med vätska."],
        rootsProductRecommendation: {
          packageName: "Roots Underhåll",
          description:
            "Roots Complete Kit passar som en enkel trestegsrutin för dagligt underhåll.",
        },
        disclaimer: "Indikativ information — ersätter inte professionell vård.",
      }),
      model: "none",
    });
  }

  try {
    const result = await runHairAnalysisVision({
      backDataUrl: back.startsWith("data:") ? back : `data:image/jpeg;base64,${back}`,
      topDataUrl: top.startsWith("data:") ? top : `data:image/jpeg;base64,${top}`,
      answers,
    });
    return c.json({
      analysis: result.raw,
      model: result.model,
      disclaimer:
        "AI-genererad analys — verifiera viktig information. Ersätter inte professionell vård.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analys misslyckades";
    return c.json({ error: msg }, 502);
  }
});
