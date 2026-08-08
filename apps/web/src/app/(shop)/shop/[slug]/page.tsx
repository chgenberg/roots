"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Plus,
  Minus,
  Truck,
  Heart,
  Loader2,
  Package,
  AlertCircle,
} from "lucide-react";

import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/json-ld";
import { LocaleLink } from "@/components/locale-link";
import { formatKr } from "@/lib/format";
import {
  productImage,
  byCatalogOrder,
  isBundleSlug,
  BUNDLE_SLUG,
} from "@/lib/product-catalog";
import { shop } from "@/i18n/dictionaries/shop";
import { products, type ProductCopy } from "@/i18n/dictionaries/products";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";
import type { ProductSlug } from "@/i18n/get-dictionary";

const API_URL = getBrowserApiBase();

/** Marketing product pages that exist under /produkter/[slug]. */
const MARKETING_PRODUCT_SLUGS = new Set([
  "shampoo",
  "conditioner",
  "body-wash",
  BUNDLE_SLUG,
]);

function localizedCatalogCopy(
  slug: string,
  locale: "sv" | "en"
): ProductCopy | null {
  if (!(slug in products)) return null;
  return products[slug as ProductSlug][locale];
}

function productSeoUrl(productSlug: string, shopSlug: string): string {
  if (MARKETING_PRODUCT_SLUGS.has(productSlug)) {
    return `/produkter/${productSlug}`;
  }
  return `/shop/${shopSlug}`;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  priceOre: number;
  currency: string;
}

interface ShopData {
  seller: {
    id: string;
    displayName: string;
    shopSlug: string;
    individualGoal: number | null;
  };
  team: { id: string; name: string } | null;
  campaign: {
    id: string;
    name: string;
    story: string;
    description: string;
    goalType: string;
    goalValue: number;
    deliveryType: string;
    shippingThresholdOre: number | null;
    shippingFeeOre: number | null;
    status: string;
  } | null;
  organization: { name: string } | null;
  products: Product[];
  stats: {
    totalSoldOre: number;
    orderCount: number;
  };
}

export default function SellerShopPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { locale, href } = useLocale();
  const t = shop.storefront[locale];

  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { cart, update: updateCart, totalItems, toQueryString } = useCart(slug);

  useEffect(() => {
    async function load() {
      try {
        const res = await rootsFetch(`${API_URL}/v1/shop/by-slug/${slug}`);
        if (!res.ok) {
          setError(t.notFound);
          return;
        }
        const data = await res.json();
        setShopData(data);
      } catch {
        setError(t.loadFailed);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, t.notFound, t.loadFailed]);

  const totalOre = shopData
    ? Object.entries(cart).reduce((sum, [id, qty]) => {
        const p = shopData.products.find((p) => p.id === id);
        return sum + (p ? p.priceOre * qty : 0);
      }, 0)
    : 0;

  // API:et sorterar på namn; paketet hör sist så supportern ser de enskilda
  // produkterna först.
  const sortedProducts = useMemo(
    () => [...(shopData?.products ?? [])].sort(byCatalogOrder),
    [shopData?.products]
  );

  // Vad paketet sparar jämfört med att köpa delarna var för sig. Räknas ur
  // katalogen så siffran inte kan bli fel när ett pris ändras.
  const bundleSavingOre = useMemo(() => {
    const bundle = sortedProducts.find((p) => isBundleSlug(p.slug));
    if (!bundle) return 0;
    const parts = sortedProducts
      .filter((p) => !isBundleSlug(p.slug))
      .reduce((sum, p) => sum + p.priceOre, 0);
    return parts > bundle.priceOre ? parts - bundle.priceOre : 0;
  }, [sortedProducts]);

  // Shop accepts orders only while the campaign is ACTIVE. Showing the
  // campaign card and products is fine in any status so supporters can
  // learn about the cause, but the CTA must be gated to prevent a failed
  // checkout surfacing only at payment time.
  const campaignStatus = shopData?.campaign?.status ?? null;
  const campaignAcceptsOrders = campaignStatus === "ACTIVE";

  const goalProgress =
    shopData?.seller.individualGoal && shopData.seller.individualGoal > 0
      ? Math.min(
          100,
          Math.round(
            (shopData.stats.totalSoldOre /
              (shopData.seller.individualGoal * 100)) *
              100
          )
        )
      : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !shopData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">
          {error || t.notFoundFallback}
        </h1>
        <p className="text-sm text-muted-foreground">{t.checkLink}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50/30">
      <BreadcrumbJsonLd
        items={[
          { name: t.breadcrumbHome, url: href("/") },
          { name: t.breadcrumbShop, url: href(`/shop/${slug}`) },
          {
            name: shopData.seller.displayName || slug,
            url: href(`/shop/${slug}`),
          },
        ]}
      />
      {/* P3.54 (audit 2026-05-26): emit Product JSON-LD per produkt så
          shop-sidor får samma rich-result-stöd som marketing/produkter.
          URL pekar på marknadsproduktsidan när den finns, annars shoppen. */}
      {shopData.products.map((p) => {
        const copy = localizedCatalogCopy(p.slug, locale);
        return (
          <ProductJsonLd
            key={p.id}
            name={copy?.name ?? p.name}
            description={copy?.description ?? p.description}
            sku={p.sku}
            price={p.priceOre}
            currency={p.currency || "SEK"}
            image={productImage(p.slug)}
            url={productSeoUrl(p.slug, slug)}
          />
        );
      })}
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {shopData.team?.name}
              {shopData.organization ? ` · ${shopData.organization.name}` : ""}
            </p>
            <h1 className="text-lg font-semibold">
              {tFill(t.buyFrom, { name: shopData.seller.displayName })}
            </h1>
          </div>
          <Badge variant="secondary" className="text-xs">
            Roots
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Campaign status banner — shown when the campaign is not accepting
            orders so supporters see this up-front rather than at checkout. */}
        {shopData.campaign && !campaignAcceptsOrders && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {campaignStatus === "ENDED" || campaignStatus === "SETTLED"
                  ? t.campaignEnded
                  : t.campaignNotStarted}
              </p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                {t.campaignInactiveBody}
              </p>
            </div>
          </div>
        )}

        {/* Campaign story */}
        {shopData.campaign?.story && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <div>
                  <p className="font-medium">{shopData.campaign.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {shopData.campaign.story}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress bar */}
        {goalProgress !== null && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t.progressTowardsGoal}
              </span>
              <span className="font-medium">{goalProgress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-700 transition-all duration-700"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {tFill(t.ordersSoFar, { count: shopData.stats.orderCount })}
            </p>
          </div>
        )}

        {/* Products */}
        <h2 className="mb-4 text-lg font-semibold">{t.productsHeading}</h2>
        <div className="grid gap-4">
          {sortedProducts.map((product) => {
            const qty = cart[product.id] || 0;
            const imgSrc = productImage(product.slug);
            const isBundle = isBundleSlug(product.slug);
            const copy = localizedCatalogCopy(product.slug, locale);
            const displayName = copy?.name ?? product.name;
            const displayDescription =
              copy?.description ?? product.description;

            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex">
                  <div className="relative h-32 w-32 shrink-0 bg-brand-50 sm:h-40 sm:w-40">
                    <Image
                      src={imgSrc}
                      alt={displayName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{displayName}</h3>
                        {isBundle && bundleSavingOre > 0 && (
                          <Badge
                            variant="secondary"
                            className="bg-brand-100 text-brand-800"
                          >
                            {tFill(t.saveAmount, {
                              amount: formatKr(bundleSavingOre, locale),
                            })}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {displayDescription}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-semibold">
                        {formatKr(product.priceOre, locale)}
                      </p>
                      {/* MASTERPLAN_01 KC6.1: qty-steppers behöver 44x44
                          så supportern (oftast på mobil) inte trycker
                          på fel knapp i shop-listan. */}
                      <div className="flex items-center gap-1">
                        {qty > 0 && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-11 w-11"
                            onClick={() => updateCart(product.id, -1)}
                            disabled={!campaignAcceptsOrders}
                            aria-label={tFill(t.removeOne, {
                              name: displayName,
                            })}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                        {qty > 0 && (
                          <span
                            className="min-w-[2rem] text-center text-sm font-medium tabular-nums"
                            aria-live="polite"
                            aria-atomic="true"
                          >
                            {qty}
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant={qty > 0 ? "outline" : "default"}
                          className="h-11 w-11"
                          onClick={() => updateCart(product.id, 1)}
                          disabled={!campaignAcceptsOrders}
                          aria-label={
                            campaignAcceptsOrders
                              ? tFill(t.addOne, { name: displayName })
                              : t.campaignInactiveAria
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Delivery info */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border bg-background p-4">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">{t.deliveryHeading}</p>
            <p className="text-muted-foreground">
              {shopData.campaign?.deliveryType === "BULK"
                ? t.deliveryBulk
                : shopData.campaign?.deliveryType === "DIRECT"
                  ? t.deliveryDirect
                  : t.deliveryChoice}
              {shopData.campaign?.shippingThresholdOre
                ? tFill(t.freeShippingOver, {
                    amount: formatKr(
                      shopData.campaign.shippingThresholdOre,
                      locale
                    ),
                  })
                : ""}
            </p>
          </div>
        </div>
      </main>

      {/* Sticky cart bar */}
      {totalItems > 0 && campaignAcceptsOrders && (
        <div
          className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {tFill(totalItems === 1 ? t.productOne : t.productMany, {
                  count: totalItems,
                })}
              </p>
              <p className="text-lg font-semibold">
                {formatKr(totalOre, locale)}
              </p>
            </div>
            <Button size="lg" asChild>
              <LocaleLink href={`/shop/${slug}/kassa?${toQueryString()}`}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                {t.checkout}
              </LocaleLink>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
