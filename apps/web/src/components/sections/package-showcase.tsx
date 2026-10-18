import { Check } from "lucide-react";
import { SoftImage } from "@/components/soft-image";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { LocaleLink } from "@/components/locale-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUNDLE_SLUG, PACKAGE_SLUGS, productImage } from "@/lib/product-catalog";
import {
  getPackageShowcase,
  getProduct,
  isProductSlug,
} from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

function kr(n: number, locale: "sv" | "en") {
  return locale === "en" ? `SEK ${n}` : `${n} kr`;
}

/** Basic, Premium och Exclusive sida vid sida. Premium är det paket vi lyfter. */
export async function PackageShowcase({
  id,
  className,
}: {
  id?: string;
  className?: string;
}) {
  const locale = await getRequestLocale();
  const t = getPackageShowcase(locale);

  const packs = PACKAGE_SLUGS.map((slug) => {
    const copy = getProduct(slug, locale);
    const contains = copy.contains ?? [];
    const compareAt = contains.reduce(
      (sum, item) =>
        isProductSlug(item.slug)
          ? sum + getProduct(item.slug, locale).priceSek * (item.qty ?? 1)
          : sum,
      0
    );
    return {
      slug,
      featured: slug === BUNDLE_SLUG,
      label: t.tiers[slug].label,
      pitch: t.tiers[slug].pitch,
      name: copy.name,
      price: copy.priceSek,
      compareAt,
      saving: compareAt - copy.priceSek,
      contains: contains.map((item) => item.label),
      image: productImage(slug),
    };
  });

  return (
    <section id={id} className={cn("py-20 md:py-28", className)}>
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{t.eyebrow}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">{t.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t.body}</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-[1120px] gap-6 md:grid-cols-[1fr_1.15fr_1fr] md:gap-5 lg:gap-8">
          {packs.map((pack) => (
            <article
              key={pack.slug}
              className={cn(
                "relative flex flex-col rounded-3xl bg-background",
                pack.featured
                  ? "order-first z-10 p-6 shadow-2xl shadow-brand-900/10 ring-2 ring-brand-700 md:order-none md:-my-6 md:p-7"
                  : "p-5 shadow-lg shadow-brand-900/5 ring-1 ring-border md:p-6"
              )}
            >
              {pack.featured && (
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-brand-700 px-4 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white">
                  {t.popular}
                </span>
              )}

              <LocaleLink
                href={`/produkter/${pack.slug}`}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                tabIndex={-1}
                aria-hidden
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-50">
                  <SoftImage
                    src={pack.image}
                    alt={pack.name}
                    fill
                    className="scale-[1.2] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.24]"
                    sizes={pack.featured ? "(max-width: 768px) 100vw, 400px" : "(max-width: 768px) 100vw, 340px"}
                  />
                </div>
              </LocaleLink>

              <div className="mt-6 flex items-baseline justify-between gap-3">
                <h3
                  className={cn(
                    "font-semibold tracking-tight",
                    pack.featured ? "text-2xl" : "text-xl"
                  )}
                >
                  {pack.label}
                </h3>
                <p className="whitespace-nowrap text-sm text-muted-foreground">
                  <s className="decoration-muted-foreground/60">{kr(pack.compareAt, locale)}</s>{" "}
                  {t.compareAt}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pack.pitch}</p>

              <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "font-bold tracking-tight",
                    pack.featured ? "text-4xl" : "text-3xl"
                  )}
                >
                  {kr(pack.price, locale)}
                </span>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                  {t.save.replace("{n}", String(pack.saving))}
                </span>
              </div>

              <ul className="mb-7 mt-5 space-y-2 text-sm">
                {pack.contains.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={pack.featured ? "default" : "outline"}
                className="mt-auto w-full"
              >
                <LocaleLink href={`/produkter/${pack.slug}`}>
                  {t.cta}
                  <span className="sr-only">: {pack.name}</span>
                </LocaleLink>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
