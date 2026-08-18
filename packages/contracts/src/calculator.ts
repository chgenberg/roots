import { z } from "zod";

/**
 * Föreningskalkylator (räknesnurra).
 *
 * Delad matematik + scheman som används av BÅDE säljarens portal-widget
 * och den publika, prospekt-specifika delningssidan. Genom att räkna på
 * exakt samma sätt på båda ytorna kan siffrorna aldrig glida isär.
 *
 * Vi räknar i hela kronor (inte öre) eftersom det är ett uppskattnings-
 * verktyg, inte en bokföringspost. När en lead sparas konverterar vi
 * `earningsKr` till öre (× 100) så det matchar resten av plattformens
 * öre-baserade fält.
 *
 * Formeln speglar plattformens avräkning:
 *   earnings = round(grossSales * marginPercent / 100)
 * (se apps/api/src/routes/settlement.ts och dashboard.ts).
 */

/**
 * Föreningens marginal är en fast affärsterm: föreningen behåller 35 % av
 * försäljningen. Låst (ej justerbart) i kalkylatorn så siffran alltid
 * speglar det faktiska erbjudandet.
 */
export const LOCKED_MARGIN_PERCENT = 35;

export const CalculatorInputsSchema = z.object({
  /** Antal aktiva säljare (spelare/medlemmar som faktiskt säljer). */
  sellers: z.number().int().min(0).max(100_000),
  /** Snittförsäljning per säljare i kronor under kampanjen. */
  avgPerSellerKr: z.number().min(0).max(10_000_000),
  /** Föreningens marginal i hela procent. Låst till 35 %. */
  marginPercent: z.number().int().min(0).max(100).default(LOCKED_MARGIN_PERCENT),
  /** Valfritt: antal medlemmar i föreningen (kontext, ej i beräkningen). */
  members: z.number().int().min(0).max(1_000_000).optional(),
  /** Valfritt: föreningens förtjänst-mål i kronor. */
  goalKr: z.number().int().min(0).max(100_000_000).optional(),
});

export type CalculatorInputs = z.infer<typeof CalculatorInputsSchema>;

/** Antaganden som en säljare sparar på en delbar länk. Samma form som inputs. */
export const CalculatorPresetSchema = CalculatorInputsSchema;
export type CalculatorPreset = z.infer<typeof CalculatorPresetSchema>;

/** Skapa en delbar kalkyl-länk (säljare i portalen). */
export const CreateCalculatorSchema = z.object({
  associationName: z.string().trim().min(2, "Club name is required").max(160),
  presets: CalculatorPresetSchema,
});
export type CreateCalculator = z.infer<typeof CreateCalculatorSchema>;

/** Uppdatera en befintlig länk. */
export const UpdateCalculatorSchema = z.object({
  associationName: z.string().trim().min(2).max(160).optional(),
  presets: CalculatorPresetSchema.optional(),
});
export type UpdateCalculator = z.infer<typeof UpdateCalculatorSchema>;

/** Mjuk lead-capture från den publika sidan. */
export const CalculatorLeadSchema = z.object({
  email: z.string().trim().email("En giltig e-postadress krävs"),
  contactName: z.string().trim().max(160).optional(),
  message: z.string().trim().max(2000).optional(),
  newsletterConsent: z.boolean().optional().default(false),
  /** Snapshot av de inputs föreningen räknade med när de lämnade leaden. */
  inputs: CalculatorInputsSchema,
  idempotencyKey: z.string().max(64).optional(),
});
export type CalculatorLead = z.infer<typeof CalculatorLeadSchema>;

export interface CalculatorResult {
  sellers: number;
  marginPercent: number;
  /** Total bruttoförsäljning i kronor. */
  grossKr: number;
  /** Föreningens förtjänst i kronor. */
  earningsKr: number;
  /** Förtjänst per säljare i kronor. */
  earningsPerSellerKr: number;
  /** Roots andel i kronor (brutto − förtjänst). */
  rootsShareKr: number;
  /** Echo av målet (kr) om satt. */
  goalKr: number | null;
  /** Måluppfyllnad i procent (förtjänst / mål), 0–100, eller null. */
  goalPct: number | null;
}

/**
 * Ren, deterministisk beräkning. Inga sidoeffekter — kan köras både i
 * webläsaren (live medan man drar i reglagen) och på servern (när en
 * lead sparas) med identiskt resultat.
 */
export function computeCalculator(input: CalculatorInputs): CalculatorResult {
  const sellers = Math.max(0, Math.floor(input.sellers || 0));
  const avgPerSellerKr = Math.max(0, input.avgPerSellerKr || 0);
  const marginPercent = Math.min(
    100,
    Math.max(0, Math.floor(input.marginPercent ?? LOCKED_MARGIN_PERCENT))
  );

  const grossKr = Math.round(sellers * avgPerSellerKr);
  const earningsKr = Math.round((grossKr * marginPercent) / 100);
  const rootsShareKr = grossKr - earningsKr;
  const earningsPerSellerKr = sellers > 0 ? Math.round(earningsKr / sellers) : 0;

  const goalKr =
    typeof input.goalKr === "number" && input.goalKr > 0 ? input.goalKr : null;
  const goalPct =
    goalKr && goalKr > 0
      ? Math.min(100, Math.round((earningsKr / goalKr) * 100))
      : null;

  return {
    sellers,
    marginPercent,
    grossKr,
    earningsKr,
    earningsPerSellerKr,
    rootsShareKr,
    goalKr,
    goalPct,
  };
}

/** Föreslagna standardvärden (härledda från demodata + brandbok). */
export const CALCULATOR_DEFAULTS: CalculatorInputs = {
  sellers: 50,
  avgPerSellerKr: 1500,
  marginPercent: LOCKED_MARGIN_PERCENT,
};
