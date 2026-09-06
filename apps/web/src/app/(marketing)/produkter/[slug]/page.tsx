import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/json-ld";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LocaleLink } from "@/components/locale-link";
import { BUNDLE_SKU, BUNDLE_SLUG, productImage } from "@/lib/product-catalog";
import { pageMetadata } from "@/lib/seo";
import {
  getPage,
  getProduct,
  isProductSlug,
  type ProductSlug,
} from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { withLocale } from "@/i18n/paths";

const SKU_BY_SLUG: Record<ProductSlug, string> = {
  shampoo: "ROOTS-SH-001",
  conditioner: "ROOTS-CO-001",
  "body-wash": "ROOTS-BW-001",
  [BUNDLE_SLUG]: BUNDLE_SKU,
};

const IMAGE2_BY_SLUG: Record<ProductSlug, string> = {
  shampoo: "/images/sport-schampoo-lifestyle.jpg",
  conditioner: "/images/sport-conditioner-lifestyle.jpg",
  "body-wash": "/images/sport-body-wash-lifestyle.jpg",
  [BUNDLE_SLUG]: "/images/sport-hockey.jpg",
};

const INGREDIENTS: Partial<Record<ProductSlug, string[]>> = {
  shampoo: [
    "Aqua",
    "Coco-Glucoside",
    "Cocamidopropyl Betaine",
    "Disodium Lauryl Sulfosuccinate",
    "Glycerin",
    "Sodium Chloride",
    "PEG-4 Rapeseedamide",
    "Sodium Benzoate",
    "Citric Acid",
    "Potassium Sorbate",
    "Parfum",
    "Polyquaternium-10",
    "Polyquaternium-7",
    "Sodium Citrate",
    "Phragmites Communis Extract",
    "Poria Cocos Extract",
    "Octadecyl Di-t-Butyl-4-Hydroxyhydrocinnamate",
    "Sodium Hydroxide",
  ],
  conditioner: [
    "Aqua",
    "Cetearyl Alcohol",
    "Caprylic/Capric Triglyceride",
    "Distearoylethyl Hydroxyethylmonium Methosulfate",
    "Stearamidopropyl Dimethylamine",
    "Phenoxyethanol",
    "Panthenol",
    "Hydrolyzed Corn Starch",
    "Beta Vulgaris Root Extract",
    "Butylene Glycol",
    "Parfum",
    "Citric Acid",
    "Benzoic Acid",
    "Sodium Lauroyl Lactylate",
    "Sodium Caproyl Lactylate",
    "Dehydroacetic Acid",
    "Lactic Acid",
    "Ethylhexylglycerin",
    "Sodium Citrate",
    "Piper Nigrum Fruit Extract",
    "Phragmites Communis Extract",
    "Poria Cocos Extract",
    "Sodium Benzoate",
    "Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate",
    "Inga Alba Bark Extract",
    "Tocopherol",
  ],
  "body-wash": [
    "Aqua",
    "Cocamidopropyl Betaine",
    "Sodium Lauroyl Sarcosinate",
    "Sodium Chloride",
    "Citric Acid",
    "Sodium Benzoate",
    "Panthenyl Hydroxypropyl Steardimonium Chloride",
    "PEG-150 Pentaerythrityl Tetrastearate",
    "Parfum",
    "Potassium Sorbate",
    "PPG-2 Hydroxyethyl Cocamide",
    "Panthenol",
    "Sodium Citrate",
    "Phragmites Communis Extract",
    "Poria Cocos Extract",
  ],
};

function displayName(slug: ProductSlug, name: string) {
  return slug === "shampoo" ? "Roots Schampoo" : name;
}

function formatPriceSek(priceSek: number, locale: "sv" | "en") {
  return locale === "en" ? `SEK ${priceSek}` : `${priceSek} kr`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  if (!isProductSlug(slug)) {
    const ui = getProduct("shampoo", locale).ui;
    return { title: ui.notFoundTitle, robots: { index: false } };
  }
  const product = getProduct(slug, locale);
  const name = displayName(slug, product.name);
  return pageMetadata({
    title: name,
    description: product.tagline,
    path: `/produkter/${slug}`,
    locale,
    ogImage: productImage(slug),
  });
}

export function generateStaticParams() {
  return (["shampoo", "conditioner", "body-wash", BUNDLE_SLUG] as const).map(
    (slug) => ({ slug })
  );
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isProductSlug(slug)) notFound();

  const locale = await getRequestLocale();
  const product = getProduct(slug, locale);
  const produkter = getPage("produkter", locale);
  const name = displayName(slug, product.name);
  const price = formatPriceSek(product.priceSek, locale);
  const image = productImage(slug);
  const image2 = IMAGE2_BY_SLUG[slug];
  const sku = SKU_BY_SLUG[slug];
  const ingredients = INGREDIENTS[slug];
  const contains = product.contains?.map((item) => ({
    ...item,
    label:
      item.slug === "shampoo"
        ? item.label.replace("Roots Shampoo", "Roots Schampoo")
        : item.label,
  }));

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
  ).replace(/\/$/, "");
  const productUrl = `${siteUrl}${withLocale(`/produkter/${slug}`, locale)}`;

  const includes =
    contains?.map((item) => {
      if (!isProductSlug(item.slug)) {
        return {
          name: item.label,
          url: `${siteUrl}${withLocale(`/produkter/${item.slug}`, locale)}`,
          sku: item.slug,
        };
      }
      const contained = getProduct(item.slug, locale);
      return {
        name: displayName(item.slug, contained.name),
        url: `${siteUrl}${withLocale(`/produkter/${item.slug}`, locale)}`,
        sku: SKU_BY_SLUG[item.slug],
      };
    }) ?? undefined;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: produkter.breadcrumbHome, url: withLocale("/", locale) },
          { name: produkter.title, url: withLocale("/produkter", locale) },
          { name, url: withLocale(`/produkter/${slug}`, locale) },
        ]}
      />
      <ProductJsonLd
        name={name}
        description={product.description}
        sku={sku}
        price={product.priceOre}
        image={image}
        url={productUrl}
        category={product.category}
        includes={includes}
      />

      <section className="py-16 pb-28 md:py-24 lg:pb-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <Breadcrumbs
            items={[
              { label: produkter.title, href: "/produkter" },
              { label: name },
            ]}
          />

          <LocaleLink
            href="/produkter"
            className="mt-4 mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {product.ui.allProducts}
          </LocaleLink>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-4">
              <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5 md:aspect-[4/3]">
                <Image
                  src={image}
                  alt={name}
                  fill
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
              </div>
              <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand-50 shadow-xl shadow-brand-900/5 md:aspect-[3/2]">
                <Image
                  src={image2}
                  alt={`${name} ${product.ui.inUseAltSuffix}`}
                  fill
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <Badge variant="secondary" className="mb-3 w-fit">
                {product.volume}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
              <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
              <p className="mt-6 max-w-[50ch] leading-relaxed text-muted-foreground">
                {product.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {product.highlights.map((h) => (
                  <Badge key={h} variant="outline">
                    {h}
                  </Badge>
                ))}
              </div>

              <p className="mt-8 text-3xl font-bold">{price}</p>

              <Button size="lg" pulse className="mt-6 w-fit" asChild>
                <LocaleLink href="/foreningsliv">
                  {product.ui.orderViaAssociation}
                </LocaleLink>
              </Button>

              <Separator className="my-8" />

              <Card className="border-border/60 bg-brand-50/40 shadow-none">
                <CardContent className="p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {contains
                      ? product.ui.containsHeading
                      : product.ui.ingredientsHeading}
                  </h2>
                  {contains ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {contains.map((item) => (
                        <li key={item.slug}>
                          <LocaleLink
                            href={`/produkter/${item.slug}`}
                            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            {item.label}
                          </LocaleLink>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {ingredients?.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{price}</p>
          </div>
          <Button size="sm" className="shrink-0" asChild>
            <LocaleLink href="/foreningsliv">
              {product.ui.orderViaAssociation}
            </LocaleLink>
          </Button>
        </div>
      </div>
    </>
  );
}
