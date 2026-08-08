import { RootsLoader } from "@/components/brand";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function MarketingLoading() {
  const locale = await getRequestLocale();
  return (
    <RootsLoader
      className="min-h-[60vh]"
      label={locale === "en" ? "Loading…" : "Laddar…"}
    />
  );
}
