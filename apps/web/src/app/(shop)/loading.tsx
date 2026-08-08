import { RootsLoader } from "@/components/brand";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function ShopLoading() {
  const locale = await getRequestLocale();
  return (
    <RootsLoader label={locale === "en" ? "Loading…" : "Laddar…"} />
  );
}
