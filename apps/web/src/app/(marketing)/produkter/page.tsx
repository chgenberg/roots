import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Leaf, Droplets, Sparkles } from "lucide-react";
import { BreadcrumbJsonLd, ItemListJsonLd, WebPageJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { pageMetadata } from "@/lib/seo";
import { BUNDLE_SLUG, productImage } from "@/lib/product-catalog";
import { getPage, getProduct, getProductListingExtras } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";
import type { Metadata } from "next";

const VALUE_ICONS = [Leaf, Droplets, Sparkles] as const;

const PRODUCT_SLUGS = ["shampoo", "conditioner", "body-wash", BUNDLE_SLUG] as const;

function formatPriceSek(priceSek: number, locale: "sv" | "en") {
  return locale === "en" ? `SEK ${priceSek}` : `${priceSek} kr`;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getPage("produkter", locale);
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: "/produkter",
    locale,
  });
}

export default async function ProdukterPage() {
  const locale = await getRequestLocale();
  const t = getPage("produkter", locale);

  const products = PRODUCT_SLUGS.map((slug) => {
    const copy = getProduct(slug, locale);
    const listing = getProductListingExtras(slug, locale);
    return {
      slug,
      name: slug === "shampoo" ? "Roots Schampoo" : copy.name,
      subtitle: copy.subtitle,
      tagline: listing.listingTagline,
      image: productImage(slug),
      price: formatPriceSek(copy.priceSek, locale),
      badge: copy.badge,
      highlights: listing.listingHighlights,
    };
  });

  const values = t.values.map((label, i) => ({
    icon: VALUE_ICONS[i] ?? Leaf,
    label,
  }));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t.breadcrumbHome, url: withLocale("/", locale) },
          { name: t.title, url: withLocale("/produkter", locale) },
        ]}
      />
      <WebPageJsonLd
        type="CollectionPage"
        name={t.title}
        description={t.description}
        url={withLocale("/produkter", locale)}
        locale={locale}
      />
      <ItemListJsonLd
        name={t.itemListName}
        items={products.map((p) => ({
          name: p.name,
          url: withLocale(`/produkter/${p.slug}`, locale),
        }))}
      />
      <section className="bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-[length:var(--font-size-hero)] font-bold tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{t.heroBody}</p>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            {values.map((v) => (
              <div
                key={v.label}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-sm"
              >
                <v.icon className="h-4 w-4 text-muted-foreground" />
                {v.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="space-y-24">
            {products.map((product, idx) => (
              <div
                key={product.slug}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <LocaleLink
                  href={`/produkter/${product.slug}`}
                  className={`group relative ${idx % 2 === 1 ? "lg:order-2" : ""}`}
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
                    {product.badge && (
                      <div className="absolute left-4 top-4">
                        <Badge>{product.badge}</Badge>
                      </div>
                    )}
                  </div>
                </LocaleLink>

                <div className={idx % 2 === 1 ? "lg:order-1" : ""}>
                  <p className="text-sm font-medium text-muted-foreground">
                    {product.subtitle}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">
                    {product.name}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {product.tagline}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.highlights.map((h) => (
                      <Badge key={h} variant="outline">
                        {h}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <span className="text-2xl font-bold">{product.price}</span>
                    <Button asChild>
                      <LocaleLink href={`/produkter/${product.slug}`}>
                        {t.readMore}
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </LocaleLink>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-brand-50/40 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 text-center md:px-10">
          <Card className="mx-auto inline-flex max-w-md items-center gap-6 border-0 p-8 shadow-md">
            <CardContent className="p-0">
              <p className="text-3xl font-bold">{t.ctaTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.ctaBody}</p>
              <Button className="mt-6" asChild>
                <LocaleLink href="/foreningsliv">{t.ctaButton}</LocaleLink>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
