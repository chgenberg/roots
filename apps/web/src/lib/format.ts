/**
 * Formatering av pengar.
 *
 * Alla belopp lagras i öre. Priser är hela kronor, men härledda tal
 * (marginaler, andelar, moms) blir sällan jämna — och `(ore / 100)
 * .toLocaleString("sv-SE")` visade dem då med decimal: lagets förtjänst
 * renderades "396,3 kr" mitt bland kolumner som annars visade hela kronor.
 * Antalet decimaler varierade dessutom med värdet.
 *
 * Hjälparen fanns tidigare kopierad i sju filer. Den bor här nu så att
 * beloppen ser likadana ut oavsett vilken vy man tittar på.
 */

/** Öre → "12 300 kr" / "SEK 12,300" (inga decimaler). */
export function formatKr(ore: number, locale: "sv" | "en" = "sv"): string {
  const amount = Math.round(ore / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE"
  );
  return locale === "en" ? `SEK ${amount}` : `${amount} kr`;
}

/** Öre → "12 300" utan enhet, för när vyn sätter enheten själv. */
export function formatKrValue(ore: number, locale: "sv" | "en" = "sv"): string {
  return Math.round(ore / 100).toLocaleString(
    locale === "en" ? "en-GB" : "sv-SE"
  );
}

/** Öre → kompakt "12,3k" / "12.3k" för axel- och stapeletiketter. */
export function formatKrShort(
  ore: number,
  locale: "sv" | "en" = "sv"
): string {
  const kr = ore / 100;
  if (kr >= 1000) {
    const n = kr / 1000;
    const digits = kr >= 10000 ? 0 : 1;
    const formatted = n.toLocaleString(locale === "en" ? "en-GB" : "sv-SE", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
    return `${formatted}k`;
  }
  return `${Math.round(kr)}`;
}

/** Svensk pluralisering: `1 order` / `2 ordrar`. */
export function pluralSv(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
