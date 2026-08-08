import { defaultLocale, locales, type Locale } from "./config";

function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Read the active locale from a pathname (`/en/...` → `en`, else default). */
export function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : defaultLocale;
}

/** Remove a leading `/sv` or `/en` segment, leaving the locale-agnostic path. */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/");
  if (!isLocale(segments[1])) {
    return pathname || "/";
  }
  const rest = segments.slice(2).join("/");
  return rest ? `/${rest}` : "/";
}

/**
 * Prefix an internal href with the locale when needed.
 * Default locale (`sv`) stays unprefixed; `en` becomes `/en/...`.
 * Absolute URLs, protocol-relative URLs, and bare hashes are left unchanged.
 */
export function withLocale(href: string, locale: Locale): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;

  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  const bare = stripLocalePrefix(path || "/");
  const localized =
    locale === defaultLocale
      ? bare
      : bare === "/"
        ? `/${locale}`
        : `/${locale}${bare}`;

  return `${localized}${search}${hash}`;
}

/** Toggle the pathname between Swedish (unprefixed) and English (`/en/...`). */
export function switchLocalePath(pathname: string): string {
  const current = getLocaleFromPathname(pathname);
  const target: Locale = current === "sv" ? "en" : "sv";
  return withLocale(stripLocalePrefix(pathname), target);
}
