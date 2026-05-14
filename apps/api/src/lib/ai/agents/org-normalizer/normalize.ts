/**
 * Pure, DB-free normalisation helpers for the organisation-normalizer agent.
 *
 * "normalized_name" is the canonical lower-case, diacritic-stripped form used
 * as a join/dedupe key (see `docs/feedback-plans/01-master-data/03_organization_upgrade.txt`
 * → "B) Hierarki" + "normalized_name varchar nullable + index — backfill via
 * delad normaliseringsfunktion").
 *
 * It is intentionally **not** the same as a URL slug:
 *  - keeps spaces (single space) for readability.
 *  - drops trailing/leading whitespace, NFKC + diacritic strip.
 *  - lowercases via sv-SE locale (handles 'I' vs 'i' edge cases).
 *  - collapses internal whitespace to a single space.
 *
 * Pure → testable without Postgres or OpenAI.
 */

/** Suffixes commonly attached to Swedish sport clubs; stripping them produces
 * a cleaner matchable form ("IFK Göteborg" ↔ "Göteborg IFK"). Keep this list
 * conservative — over-eager stripping risks merging distinct organisations.
 */
const CLUB_SUFFIXES = new Set([
  "if",
  "ifk",
  "bk",
  "fk",
  "ff",
  "sk",
  "ik",
  "fc",
  "hk",
  "tk",
  "kfum",
  "fbk",
  "khk",
  "foreningen", // diacritic-stripped form is what we compare against
  "klubb",
  "klubben",
]);

export function nfkcLower(input: string): string {
  return input.normalize("NFKC").toLocaleLowerCase("sv-SE");
}

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Canonical normalized_name used by the dedupe index and the AI matcher.
 * Idempotent: `normalizeName(normalizeName(x)) === normalizeName(x)`.
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return collapseWhitespace(
    stripDiacritics(nfkcLower(raw))
      // Replace anything that isn't a letter/digit/whitespace with a space so
      // "P-10/Svart" still matches "P10 Svart". Letters here include the basic
      // Latin range after diacritic strip.
      .replace(/[^a-z0-9\s]+/g, " ")
  );
}

/**
 * Stripped variant used as a secondary lookup key for fuzzy riksorg matching.
 * Removes common Swedish club suffixes after normalisation.
 *
 * E.g. `"ifk göteborg fk"` → `"goteborg"`.
 */
export function normalizeWithoutClubSuffix(raw: string | null | undefined): string {
  const base = normalizeName(raw);
  if (!base) return "";
  const tokens = base.split(" ").filter((t) => !CLUB_SUFFIXES.has(t));
  return tokens.join(" ").trim();
}

export interface RiksorganisationMatchInput {
  /** Free-text "national federation" string from the legacy column. */
  nationalFederation?: string | null;
  /** Org display name — used as a secondary signal when federation is empty. */
  name?: string | null;
}

export interface RiksorganisationCandidate {
  id: string;
  /** `master_riksorganisation.name` after normalisation. */
  normalizedName: string;
}

export interface RiksorganisationMatch {
  riksorganisationId: string | null;
  matchedOn: "national_federation" | "name" | null;
}

/**
 * Deterministic riksorganisation matcher. v1 only does exact normalised
 * matches against the masterdata table. The LLM fallback (plan 04/01) will be
 * wired into a later step.
 */
export function matchRiksorganisation(
  input: RiksorganisationMatchInput,
  candidates: ReadonlyArray<RiksorganisationCandidate>
): RiksorganisationMatch {
  if (candidates.length === 0) {
    return { riksorganisationId: null, matchedOn: null };
  }
  const byNormalized = new Map(
    candidates.map((c) => [c.normalizedName, c.id])
  );

  const fedKey = normalizeName(input.nationalFederation);
  if (fedKey) {
    const hit = byNormalized.get(fedKey);
    if (hit) return { riksorganisationId: hit, matchedOn: "national_federation" };
  }

  const nameKey = normalizeName(input.name);
  if (nameKey) {
    const hit = byNormalized.get(nameKey);
    if (hit) return { riksorganisationId: hit, matchedOn: "name" };
  }

  return { riksorganisationId: null, matchedOn: null };
}
