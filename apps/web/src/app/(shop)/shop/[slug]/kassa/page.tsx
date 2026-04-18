"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Package, Truck } from "lucide-react";
import Link from "next/link";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

interface CheckoutProduct {
  id: string;
  name: string;
  priceOre: number;
}

interface CheckoutShop {
  products: CheckoutProduct[];
  campaign: { status: string } | null;
}

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [shop, setShop] = useState<CheckoutShop | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"BULK" | "DIRECT">("BULK");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [klarnaHtml, setKlarnaHtml] = useState("");
  const klarnaRef = useRef<HTMLDivElement>(null);

  const items = Array.from(searchParams.entries())
    .filter(([key]) => key.startsWith("item_"))
    .map(([key, val]) => ({
      productId: key.replace("item_", ""),
      qty: parseInt(val, 10),
    }))
    .filter((i) => Number.isFinite(i.qty) && i.qty > 0);

  useEffect(() => {
    async function loadShop() {
      try {
        const res = await fetch(`${API_URL}/v1/shop/by-slug/${slug}`);
        if (!res.ok) return;
        const data = (await res.json()) as CheckoutShop;
        setShop(data);
      } catch {
        // non-fatal: order summary will degrade to item count only
      }
    }
    loadShop();
  }, [slug]);

  const resolvedLines = shop
    ? items
        .map((line) => {
          const p = shop.products.find((p) => p.id === line.productId);
          if (!p) return null;
          return {
            productId: p.id,
            name: p.name,
            qty: line.qty,
            unitPriceOre: p.priceOre,
            totalOre: p.priceOre * line.qty,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)
    : [];

  const subtotalOre = resolvedLines.reduce((s, l) => s + l.totalOre, 0);
  // Prices on Roots are inclusive of 25% VAT (momssats för hygienprodukter).
  // The VAT portion is therefore subtotal * 25 / 125.
  const vatOre = Math.round((subtotalOre * 25) / 125);
  const campaignAcceptsOrders = shop?.campaign?.status === "ACTIVE";

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/v1/checkout/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerSlug: slug,
          customerName,
          customerEmail,
          customerPhone: customerPhone || undefined,
          deliveryType,
          shippingAddressLine1: deliveryType === "DIRECT" ? addressLine1 : undefined,
          shippingCity: deliveryType === "DIRECT" ? city : undefined,
          shippingPostalCode: deliveryType === "DIRECT" ? postalCode : undefined,
          items,
          note: note || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Något gick fel.");
        return;
      }

      setKlarnaHtml(data.htmlSnippet);
    } catch {
      setError("Kunde inte nå servern.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (klarnaHtml && klarnaRef.current) {
      klarnaRef.current.innerHTML = klarnaHtml;
      const scripts = klarnaRef.current.querySelectorAll("script");
      scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) =>
          newScript.setAttribute(attr.name, attr.value)
        );
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  }, [klarnaHtml]);

  if (klarnaHtml) {
    return (
      <div className="min-h-screen bg-brand-50/30">
        <header className="border-b bg-background">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <h1 className="text-lg font-semibold">Slutför din beställning</h1>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div ref={klarnaRef} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href={`/shop/${slug}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
          <h1 className="text-lg font-semibold">Kassa</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-6">
          {/* Order summary — the supporter can verify what they are about
              to pay for before being redirected to Klarna. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Din beställning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resolvedLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Din varukorg är tom.{" "}
                  <Link
                    href={`/shop/${slug}`}
                    className="underline underline-offset-2"
                  >
                    Gå tillbaka till shoppen
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-border text-sm">
                    {resolvedLines.map((l) => (
                      <li
                        key={l.productId}
                        className="flex items-start justify-between gap-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.qty} st &times;{" "}
                            {(l.unitPriceOre / 100).toLocaleString("sv-SE")} kr
                          </p>
                        </div>
                        <p className="shrink-0 font-medium tabular-nums">
                          {(l.totalOre / 100).toLocaleString("sv-SE")} kr
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Varav moms (25 %)</span>
                      <span className="tabular-nums">
                        {(vatOre / 100).toLocaleString("sv-SE")} kr
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span>Totalt att betala</span>
                      <span className="tabular-nums">
                        {(subtotalOre / 100).toLocaleString("sv-SE")} kr
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dina uppgifter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Namn *</Label>
                <Input
                  id="name"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Förnamn Efternamn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-post *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="din@epost.se"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="070-XXX XX XX"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leverans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("BULK")}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    deliveryType === "BULK"
                      ? "border-brand-700 bg-brand-50/50"
                      : "hover:border-brand-300"
                  }`}
                >
                  <Package className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Samleverans</p>
                    <p className="text-xs text-muted-foreground">
                      Hämta hos lagansvarig
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("DIRECT")}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    deliveryType === "DIRECT"
                      ? "border-brand-700 bg-brand-50/50"
                      : "hover:border-brand-300"
                  }`}
                >
                  <Truck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Hemleverans</p>
                    <p className="text-xs text-muted-foreground">
                      Direkt till din dörr
                    </p>
                  </div>
                </button>
              </div>

              {deliveryType === "DIRECT" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="address">Adress *</Label>
                    <Input
                      id="address"
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Gatuadress"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postnummer *</Label>
                      <Input
                        id="postalCode"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="123 45"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Ort *</Label>
                      <Input
                        id="city"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Stockholm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meddelande (valfritt)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hälsning eller önskemål"
              />
            </CardContent>
          </Card>

          <Separator />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Genom att gå vidare godkänner du vår{" "}
            <Link
              href="/integritet"
              className="underline underline-offset-2 hover:text-foreground"
            >
              integritetspolicy
            </Link>{" "}
            och våra{" "}
            <Link
              href="/villkor"
              className="underline underline-offset-2 hover:text-foreground"
            >
              köpvillkor
            </Link>
            . Betalningen hanteras säkert av Klarna.
          </p>

          {shop && !campaignAcceptsOrders && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
            >
              Kampanjen är inte aktiv just nu. Det går inte att slutföra en
              beställning.
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items.reduce((s, i) => s + i.qty, 0)} produkter
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={
                loading ||
                !customerName ||
                !customerEmail ||
                items.length === 0 ||
                (shop !== null && !campaignAcceptsOrders)
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Förbereder...
                </>
              ) : (
                "Gå till betalning"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
