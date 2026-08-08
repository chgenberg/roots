import { headers } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";

export const LOCALE_HEADER = "x-roots-locale";

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Server Components: locale set by middleware on every request. */
export async function getRequestLocale(): Promise<Locale> {
  const h = await headers();
  const value = h.get(LOCALE_HEADER);
  return isLocale(value) ? value : defaultLocale;
}
