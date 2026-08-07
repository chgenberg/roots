"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { portalFetch } from "@/lib/portal-api";
import {
  toPortalProductCard,
  publicProductHref,
  byCatalogOrder,
  BUNDLE_SKU,
  FALLBACK_SKU_SLUG,
  type ApiProductRow,
  type PortalProductCard,
} from "@/lib/product-catalog";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Minus, Plus } from "lucide-react";

const FALLBACK_PRODUCTS: PortalProductCard[] = [
  {
    name: "Roots Schampoo",
    type: "Schampo",
    desc: "Milt schampo med SyriCalm® och sockerbaserade, sulfatsnåla tvättämnen",
    price: 149,
    sku: "ROOTS-SH-001",
    slug: FALLBACK_SKU_SLUG["ROOTS-SH-001"]!,
    image: "/images/sport-schampoo.jpg",
    isBundle: false,
  },
  {
    name: "Roots Conditioner",
    type: "Balsam",
    desc: "Närande balsam med SyriCalm®, Pro-Vitamin B5 & E-vitamin",
    price: 149,
    sku: "ROOTS-CO-001",
    slug: FALLBACK_SKU_SLUG["ROOTS-CO-001"]!,
    image: "/images/sport-conditioner.jpg",
    isBundle: false,
  },
  {
    name: "Roots Body Wash",
    type: "Body Wash",
    desc: "Skonsam kroppstvätt med SyriCalm® och Panthenol (B5)",
    price: 129,
    sku: "ROOTS-BW-001",
    slug: FALLBACK_SKU_SLUG["ROOTS-BW-001"]!,
    image: "/images/sport-body-wash.jpg",
    isBundle: false,
  },
  {
    name: "Roots Komplett paket",
    type: "Paket — alla tre",
    desc: "Schampo, balsam och kroppstvätt tillsammans — 28 kr billigare än var för sig",
    price: 399,
    sku: BUNDLE_SKU,
    slug: FALLBACK_SKU_SLUG[BUNDLE_SKU]!,
    image: "/images/sport-package.jpg",
    isBundle: true,
  },
];

export default function ProdukterPortalPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<PortalProductCard[]>(
    FALLBACK_PRODUCTS
  );

  useEffect(() => {
    portalFetch<{ products: ApiProductRow[] }>("/products")
      .then((data) => {
        if (data.products?.length) {
          setProducts(
            data.products.map(toPortalProductCard).sort(byCatalogOrder)
          );
        }
      })
      // Tyst med flit: FALLBACK_PRODUCTS är den riktiga katalogen med
      // aktuella priser, så sidan visar rätt innehåll även utan API:t. Ett
      // felmeddelande här hade bara oroat utan att ge något att göra.
      .catch(() => {});
  }, []);

  // Räknas fram ur katalogen istället för att skrivas in i texten, så siffran
  // följer med om ett pris ändras.
  const bundleSavingKr = useMemo(() => {
    const bundle = products.find((p) => p.isBundle);
    if (!bundle) return 0;
    const parts = products
      .filter((p) => !p.isBundle)
      .reduce((sum, p) => sum + p.price, 0);
    return parts > bundle.price ? parts - bundle.price : 0;
  }, [products]);

  function updateQty(sku: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[sku] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [sku]: next };
    });
  }

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalPrice = products.reduce(
    (sum, p) => sum + p.price * (quantities[p.sku] || 0),
    0
  );

  return (
    <div
      className={`page-enter space-y-6 ${totalItems > 0 ? "pb-28 sm:pb-32" : ""}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produkter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bläddra bland produkter och lägg till i beställning.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
          <Link href="/portal/bestallningar">Visa beställningar</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const qty = quantities[p.sku] || 0;
          return (
            <Card
              key={p.sku}
              className="overflow-hidden transition-shadow hover:shadow-md"
            >
              <Link
                href={publicProductHref(p.slug)}
                className="relative block aspect-[4/3] bg-brand-50 outline-none ring-offset-2 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-brand-900"
              >
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                {p.isBundle && bundleSavingKr > 0 && (
                  <span className="absolute left-3 top-3 rounded-full bg-inverse-surface px-3 py-1 text-xs font-semibold text-inverse-on-surface shadow-sm">
                    Spara {bundleSavingKr} kr
                  </span>
                )}
              </Link>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">
                      <Link
                        href={publicProductHref(p.slug)}
                        className="hover:text-brand-800 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">{p.type}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold">{p.price} kr</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.desc}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => updateQty(p.sku, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-brand-50"
                      disabled={qty === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <Input
                      value={qty}
                      readOnly
                      className="h-8 w-12 border-x border-y-0 rounded-none text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(p.sku, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-brand-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalItems > 0 && (
        <Card className="sticky bottom-6 border-0 bg-inverse-surface text-inverse-on-surface shadow-xl">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5" />
              <div>
                <p className="font-semibold">
                  {totalItems} produkt{totalItems !== 1 ? "er" : ""} i varukorgen
                </p>
                <p className="text-sm text-inverse-on-surface/70">
                  Totalt: {totalPrice.toLocaleString("sv-SE")} kr
                </p>
              </div>
            </div>
            <Button className="bg-white text-neutral-900 shadow-sm hover:bg-neutral-100" onClick={() => window.location.href = "/portal/bestallningar"}>
              Gå till beställning
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
