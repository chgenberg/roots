"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
import { apiFetch } from "@/lib/api";
import { useCart } from "@/lib/use-cart";

const API_URL = getBrowserApiBase();

interface CheckoutProduct {
  id: string;
  name: string;
  priceOre: number;
}

interface CheckoutShop {
  products: CheckoutProduct[];
  campaign: {
    status: string;
    deliveryType?: string | null;
    shippingFeeOre?: number | null;
    shippingThresholdOre?: number | null;
  } | null;
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
  // MASTERPLAN_01 KC4.5: distansavtalslagen + e-handelslagen kräver
  // explicit godkännande av villkor + integritetspolicy före köp.
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [klarnaHtml, setKlarnaHtml] = useState("");
  const klarnaRef = useRef<HTMLDivElement>(null);

  // MASTERPLAN_01 KC4.1: hydra från sessionStorage när URL saknar
  // ?item_*. Tidigare visade kassan "tom varukorg" vid refresh /
  // bookmark / direkt-länk trots persisterad cart. URL-params vinner
  // när de finns (delade länkar med ?item_X=Y ska respekteras).
  const { cart, hydrated } = useCart(slug);

  const urlItems = useMemo(() => {
    return Array.from(searchParams.entries())
      .filter(([key]) => key.startsWith("item_"))
      .map(([key, val]) => ({
        productId: key.replace("item_", ""),
        qty: parseInt(val, 10),
      }))
      .filter((i) => Number.isFinite(i.qty) && i.qty > 0);
  }, [searchParams]);

  const items = useMemo(() => {
    if (urlItems.length > 0) return urlItems;
    if (!hydrated) return [];
    return Object.entries(cart)
      .map(([productId, qty]) => ({ productId, qty }))
      .filter((i) => Number.isFinite(i.qty) && i.qty > 0);
  }, [urlItems, cart, hydrated]);

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

  // MASTERPLAN_01 KC4.2: spegla samma frakt-logik som API:t
  // (checkout.ts ~235–254). Tidigare visade kassan ENDAST subtotal,
  // sedan tog Klarna in subtotal + frakt → supportern betalade mer än
  // vi visade. Bedrägeririsk + lagligt problem (prisindikering).
  const shippingFee = shop?.campaign?.shippingFeeOre ?? 0;
  const shippingThreshold = shop?.campaign?.shippingThresholdOre ?? 0;
  const shippingOre =
    deliveryType === "DIRECT" &&
    shippingFee > 0 &&
    shippingThreshold > 0 &&
    subtotalOre < shippingThreshold
      ? shippingFee
      : 0;
  const totalOre = subtotalOre + shippingOre;
  // Prices on Roots are inclusive of 25% VAT (momssats för hygienprodukter).
  // The VAT portion is therefore total * 25 / 125 (frakt har samma momssats).
  const vatOre = Math.round((totalOre * 25) / 125);
  const campaignAcceptsOrders = shop?.campaign?.status === "ACTIVE";

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // apiFetch attaches the CSRF token + credentials cookie so the API's
      // CSRF middleware in production accepts the POST.
      const res = await apiFetch<{ htmlSnippet?: string; error?: string }>(
        "/v1/checkout/create",
        {
          method: "POST",
          body: {
            sellerSlug: slug,
            customerName,
            customerEmail,
            customerPhone: customerPhone || undefined,
            deliveryType,
            shippingAddressLine1:
              deliveryType === "DIRECT" ? addressLine1 : undefined,
            shippingCity: deliveryType === "DIRECT" ? city : undefined,
            shippingPostalCode:
              deliveryType === "DIRECT" ? postalCode : undefined,
            items,
            note: note || undefined,
          },
        }
      );

      if (!res.ok) {
        setError(res.data?.error || "Något gick fel.");
        return;
      }

      setKlarnaHtml(res.data?.htmlSnippet || "");
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
              {/* KC4.1: medan vi väntar på hydrate/shop-fetch, visa
                  loader istället för en falsk "tom"-skylt — det är en
                  jättevanlig felkälla att se "Din varukorg är tom"
                  blink-fram precis innan items dyker upp. */}
              {!hydrated || !shop ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Hämtar din varukorg...
                </div>
              ) : resolvedLines.length === 0 ? (
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
                      <span>Delsumma</span>
                      <span className="tabular-nums">
                        {(subtotalOre / 100).toLocaleString("sv-SE")} kr
                      </span>
                    </div>
                    {deliveryType === "DIRECT" && shippingFee > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>
                          Frakt
                          {shippingOre === 0 && shippingThreshold > 0 ? (
                            <span className="ml-1 text-xs">
                              (fri över{" "}
                              {(shippingThreshold / 100).toLocaleString("sv-SE")} kr)
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">
                          {shippingOre === 0
                            ? "0 kr"
                            : `${(shippingOre / 100).toLocaleString("sv-SE")} kr`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Varav moms (25 %)</span>
                      <span className="tabular-nums">
                        {(vatOre / 100).toLocaleString("sv-SE")} kr
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span>Totalt att betala</span>
                      <span className="tabular-nums">
                        {(totalOre / 100).toLocaleString("sv-SE")} kr
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
              {/* MASTERPLAN_01 KC6.7: autoComplete-tokens enligt WHATWG.
                  På iOS/Android fyller browsern PII automatiskt — på
                  mobil där supportrar konverterar är det skillnaden
                  mellan 30 s checkout och abandon. */}
              <div className="space-y-2">
                <Label htmlFor="name">Namn *</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
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
                  autoComplete="email"
                  inputMode="email"
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
                  autoComplete="tel"
                  inputMode="tel"
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
                      autoComplete="street-address"
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
                        autoComplete="postal-code"
                        inputMode="numeric"
                        pattern="\d{3}\s?\d{2}"
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
                        autoComplete="address-level2"
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

          {/* MASTERPLAN_01 KC4.5: explicit checkbox krävs för giltigt
              distansavtal. Default unchecked, submit blockas tills
              kryssad. Länkar öppnas i nytt fönster så användaren inte
              tappar kassa-state. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              aria-describedby="terms-help"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-700"
            />
            <span id="terms-help" className="leading-relaxed text-muted-foreground">
              Jag godkänner Roots{" "}
              <Link
                href="/villkor"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                köpvillkor
              </Link>{" "}
              och{" "}
              <Link
                href="/integritet"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                integritetspolicy
              </Link>
              . Betalningen hanteras säkert av Klarna.
            </span>
          </label>

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
                !termsAccepted ||
                (shop !== null && !campaignAcceptsOrders) ||
                // KC4.3 spegel: vid hemleverans måste alla tre adressfält
                // vara ifyllda — annars går servern bara att blockera 400.
                (deliveryType === "DIRECT" &&
                  (!addressLine1.trim() ||
                    !city.trim() ||
                    !/^\d{3}\s?\d{2}$/.test(postalCode.trim())))
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
