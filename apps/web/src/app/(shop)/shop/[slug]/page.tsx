"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

const PRODUCT_IMAGES: Record<string, string> = {
  shampoo: "/images/p1.jpg",
  conditioner: "/images/p5.jpg",
  "body-wash": "/images/p6.jpg",
};

export default function SellerShopPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});

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

  function updateCart(productId: string, delta: number) {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  }

  const totalItems = Object.values(cart).reduce((sum, q) => sum + q, 0);
  const totalOre = shop
    ? Object.entries(cart).reduce((sum, [id, qty]) => {
        const p = shop.products.find((p) => p.id === id);
        return sum + (p ? p.priceOre * qty : 0);
      }, 0)
    : 0;

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
          {shop.products.map((product) => {
            const qty = cart[product.id] || 0;
            const imgSrc = PRODUCT_IMAGES[product.slug] || "/images/p1.jpg";

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
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-semibold">
                        {(product.priceOre / 100).toLocaleString("sv-SE")} kr
                      </p>
                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateCart(product.id, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {qty > 0 && (
                          <span className="w-6 text-center text-sm font-medium">
                            {qty}
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant={qty > 0 ? "outline" : "default"}
                          className="h-8 w-8"
                          onClick={() => updateCart(product.id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bundle card */}
        <Card className="mt-6 border-brand-200 bg-brand-50/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-brand-600" />
              <div>
                <p className="font-medium">Komplett paket — 399 kr</p>
                <p className="text-sm text-muted-foreground">
                  Schampo + Balsam + Body Wash. Spara genom att köpa alla tre.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                ? ` Fri frakt över ${(shop.campaign.shippingThresholdOre / 100).toLocaleString("sv-SE")} kr.`
                : ""}
            </p>
          </div>
        </div>
      </main>

      {/* Sticky cart bar */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {totalItems} {totalItems === 1 ? "produkt" : "produkter"}
              </p>
              <p className="text-lg font-semibold">
                {(totalOre / 100).toLocaleString("sv-SE")} kr
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => {
                window.location.href = `/shop/${slug}/kassa?${new URLSearchParams(
                  Object.entries(cart).map(([id, qty]) => [`item_${id}`, String(qty)])
                ).toString()}`;
              }}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              Till kassan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
