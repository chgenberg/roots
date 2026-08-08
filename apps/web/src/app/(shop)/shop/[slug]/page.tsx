"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
import { useCart } from "@/lib/use-cart";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/json-ld";
import { formatKrValue } from "@/lib/format";
import {
  productImage,
  byCatalogOrder,
  isBundleSlug,
  BUNDLE_SLUG,
} from "@/lib/product-catalog";

const API_URL = getBrowserApiBase();

/** Marketing product pages that exist under /produkter/[slug]. */
const MARKETING_PRODUCT_SLUGS = new Set([
  "shampoo",
  "conditioner",
  "body-wash",
  BUNDLE_SLUG,
]);

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

  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { cart, update: updateCart, totalItems, toQueryString } = useCart(slug);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/shop/by-slug/${slug}`);
        if (!res.ok) {
          setError("Denna shop finns inte.");
          return;
        }
        const data = await res.json();
        setShop(data);
      } catch {
        setError("Kunde inte ladda shoppen.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const totalOre = shop
    ? Object.entries(cart).reduce((sum, [id, qty]) => {
        const p = shop.products.find((p) => p.id === id);
        return sum + (p ? p.priceOre * qty : 0);
      }, 0)
    : 0;

  // API:et sorterar på namn; paketet hör sist så supportern ser de enskilda
  // produkterna först.
  const sortedProducts = useMemo(
    () => [...(shop?.products ?? [])].sort(byCatalogOrder),
    [shop?.products]
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
  const campaignStatus = shop?.campaign?.status ?? null;
  const campaignAcceptsOrders = campaignStatus === "ACTIVE";

  const goalProgress =
    shop?.seller.individualGoal && shop.seller.individualGoal > 0
      ? Math.min(
          100,
          Math.round(
            (shop.stats.totalSoldOre / (shop.seller.individualGoal * 100)) *
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

  if (error || !shop) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{error || "Shop hittades inte"}</h1>
        <p className="text-sm text-muted-foreground">
          Kontrollera att länken stämmer
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50/30">
      <BreadcrumbJsonLd
        items={[
          { name: "Hem", url: "/" },
          { name: "Shop", url: `/shop/${slug}` },
          {
            name: shop.seller.displayName || slug,
            url: `/shop/${slug}`,
          },
        ]}
      />
      {/* P3.54 (audit 2026-05-26): emit Product JSON-LD per produkt så
          shop-sidor får samma rich-result-stöd som marketing/produkter.
          URL pekar på marknadsproduktsidan när den finns, annars shoppen. */}
      {shop.products.map((p) => (
        <ProductJsonLd
          key={p.id}
          name={p.name}
          description={p.description}
          sku={p.sku}
          price={p.priceOre}
          currency={p.currency || "SEK"}
          image={productImage(p.slug)}
          url={productSeoUrl(p.slug, slug)}
        />
      ))}
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {shop.team?.name}
              {shop.organization ? ` · ${shop.organization.name}` : ""}
            </p>
            <h1 className="text-lg font-semibold">
              Köp av {shop.seller.displayName}
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
        {shop.campaign && !campaignAcceptsOrders && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {campaignStatus === "ENDED" || campaignStatus === "SETTLED"
                  ? "Säljperioden är avslutad"
                  : "Säljperioden har inte startat ännu"}
              </p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                Du kan läsa om föreningens projekt, men det går inte att lägga
                en beställning just nu. Kontakta laget eller föreningen för
                nästa steg.
              </p>
            </div>
          </div>
        )}

        {/* Campaign story */}
        {shop.campaign?.story && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <div>
                  <p className="font-medium">{shop.campaign.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {shop.campaign.story}
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
                Framsteg mot målet
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
              {shop.stats.orderCount} beställningar hittills
            </p>
          </div>
        )}

        {/* Products */}
        <h2 className="mb-4 text-lg font-semibold">Produkter</h2>
        <div className="grid gap-4">
          {sortedProducts.map((product) => {
            const qty = cart[product.id] || 0;
            const imgSrc = productImage(product.slug);
            const isBundle = isBundleSlug(product.slug);

            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex">
                  <div className="relative h-32 w-32 shrink-0 bg-brand-50 sm:h-40 sm:w-40">
                    <Image
                      src={imgSrc}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{product.name}</h3>
                        {isBundle && bundleSavingOre > 0 && (
                          <Badge variant="secondary" className="bg-brand-100 text-brand-800">
                            Spara {formatKrValue(bundleSavingOre)} kr
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-semibold">
                        {formatKrValue(product.priceOre)} kr
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
                            aria-label={`Ta bort en ${product.name}`}
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
                              ? `Lägg till ${product.name}`
                              : "Säljperioden är inte aktiv"
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
            <p className="font-medium">Leveransinformation</p>
            <p className="text-muted-foreground">
              {shop.campaign?.deliveryType === "BULK"
                ? "Produkterna samlas ihop och levereras till lagansvarig efter säljperioden."
                : shop.campaign?.deliveryType === "DIRECT"
                ? "Produkterna skickas direkt hem till dig."
                : "Du kan välja hemleverans eller samleverans i kassan."}
              {shop.campaign?.shippingThresholdOre
                ? ` Fri frakt över ${formatKrValue(shop.campaign.shippingThresholdOre)} kr.`
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
                {totalItems} {totalItems === 1 ? "produkt" : "produkter"}
              </p>
              <p className="text-lg font-semibold">
                {formatKrValue(totalOre)} kr
              </p>
            </div>
            <Button size="lg" asChild>
              <Link href={`/shop/${slug}/kassa?${toQueryString()}`}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Till kassan
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
