/**
 * Swedish-aware slug generator.
 *
 * MASTERPLAN_01 KC3.5: the previous slug logic used
 *   name.toLowerCase().replace(/[^a-z0-9]/g, "-")
 * which broke for every Swedish name containing å/ä/ö. "Åsa Söderström"
 * collapsed to "---", leaving the seller with an unreadable shop URL
 * and a useless social-share link.
 *
 * This helper:
 *   - lowercases
 *   - transliterates Swedish + common Nordic + accented chars (NFD)
 *   - removes everything that isn't [a-z0-9-]
 *   - collapses repeated hyphens
 *   - trims leading/trailing hyphens
 *   - caps length to `maxLength` (default 40)
 *
 * If the input is empty after normalisation we return `"seller"` so the
 * caller can still append a uniqueness-suffix.
 */
export function slugify(input: string, maxLength = 40): string {
  if (!input) return "seller";

  const mapped = input
    .toLowerCase()
    // Common Swedish + Nordic letters
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ü/g, "u")
    .replace(/é|è|ê|ë/g, "e")
    .replace(/á|à|â|ã/g, "a")
    .replace(/í|ì|î|ï/g, "i")
    .replace(/ó|ò|ô|õ/g, "o")
    .replace(/ú|ù|û/g, "u")
    .replace(/ý|ÿ/g, "y")
    .replace(/ñ/g, "n")
    .replace(/ç/g, "c");

  // Strip remaining accents via NFD decomposition, then drop the marks.
  const stripped = mapped.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const slug = stripped
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : "seller";
}

/** Append a short random suffix so the slug stays unique per seller. */
export function shopSlug(displayName: string): string {
  const base = slugify(displayName, 28);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${base}-${suffix}`;
}
