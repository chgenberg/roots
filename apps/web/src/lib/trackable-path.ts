/**
 * Vilka sidor som får räknas i statistik — både GA4 och vår egen anonyma
 * besöksstatistik. Bara publika sidor utan personuppgifter i adressen:
 * portalen, inbjudningslänkar med token, orderbekräftelser och delade
 * kalkyllänkar (`?saljare=`) räknas aldrig.
 */

const PUBLIC_PREFIXES = [
  "/produkter",
  "/guider",
  "/om-oss",
  "/kontakt",
  "/sa-har-gar-det-till",
  "/sa-fungerar-det",
  "/klubbar",
  "/hjalp",
  "/haranalys",
  "/intresseanmalan",
  "/prova",
  "/villkor",
  "/integritet",
  "/foreningsliv",
];
const SHOP_PATH = /^\/shop\/[^/]+(\/kassa)?\/?$/;
const SAFE_QUERY_KEY = /^(utm_[a-z]+|gclid|gbraid|wbraid|fbclid|lang)$/;

export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, "") || "/";
}

export function isTrackable(pathname: string, search: string): boolean {
  const path = stripLocale(pathname);
  const pathOk =
    path === "/" ||
    SHOP_PATH.test(path) ||
    PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (!pathOk) return false;
  return [...new URLSearchParams(search).keys()].every((k) =>
    SAFE_QUERY_KEY.test(k)
  );
}
