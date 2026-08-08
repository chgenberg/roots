"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
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
import { LocaleLink } from "@/components/locale-link";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { formatKr } from "@/lib/format";
import { vatOfGrossOre } from "@roots/contracts";
import { shop } from "@/i18n/dictionaries/shop";
import { products as productDict } from "@/i18n/dictionaries/products";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";
import type { ProductSlug } from "@/i18n/get-dictionary";

const API_URL = getBrowserApiBase();

interface CheckoutProduct {
  id: string;
  slug?: string;
  name: string;
  priceOre: number;
}

function localizedProductName(
  product: CheckoutProduct,
  locale: "sv" | "en"
): string {
  const slug = product.slug;
  if (slug && slug in productDict) {
    return productDict[slug as ProductSlug][locale].name;
  }
  return product.name;
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

// P2.28 (audit 2026-05-26): useSearchParams kräver <Suspense>-wrap i
// Next 15. Default-exporten wrappar, inner-componenten gör jobbet.
export default function CheckoutPage() {
  const { locale } = useLocale();
  const t = shop.checkout[locale];

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-50/30">
          <main className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
            {t.loading}
          </main>
        </div>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { locale } = useLocale();
  const t = shop.checkout[locale];

  const [shopData, setShopData] = useState<CheckoutShop | null>(null);

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
        const res = await rootsFetch(`${API_URL}/v1/shop/by-slug/${slug}`);
        if (!res.ok) return;
        const data = (await res.json()) as CheckoutShop;
        setShopData(data);
      } catch {
        // non-fatal: order summary will degrade to item count only
      }
    }
    loadShop();
  }, [slug]);

  const resolvedLines = shopData
    ? items
        .map((line) => {
          const p = shopData.products.find((p) => p.id === line.productId);
          if (!p) return null;
          return {
            productId: p.id,
            name: localizedProductName(p, locale),
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
  const shippingFee = shopData?.campaign?.shippingFeeOre ?? 0;
  const shippingThreshold = shopData?.campaign?.shippingThresholdOre ?? 0;
  const shippingOre =
    deliveryType === "DIRECT" &&
    shippingFee > 0 &&
    shippingThreshold > 0 &&
    subtotalOre < shippingThreshold
      ? shippingFee
      : 0;
  const totalOre = subtotalOre + shippingOre;
  // Priserna är inklusive moms. Samma helper som API:t och orderbekräftelsen
  // använder, så kunden, Klarna och bokföringen ser samma öre.
  const vatOre = vatOfGrossOre(totalOre);
  const campaignAcceptsOrders = shopData?.campaign?.status === "ACTIVE";

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
            locale,
            // Servern loggar vilken version av villkoren kunden godkände;
            // kryssrutan här är beviset som skickas med.
            acceptTerms: termsAccepted,
          },
        }
      );

      if (!res.ok) {
        setError(res.data?.error || t.errorGeneric);
        return;
      }

      setKlarnaHtml(res.data?.htmlSnippet || "");
    } catch {
      setError(t.errorServer);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!klarnaHtml || !klarnaRef.current) return;

    // P2.1 (audit 2026-05-26): innerHTML-injection av Klarna's snippet
    // är by-design (Klarna shipper själv inline script-handlers) men
    // det betyder att vi måste lita på att källan ÄR Klarna's snippet.
    // Defense-in-depth: vi gör en strikt sanity-validering på att
    // texten ser ut som Klarna's snippet och avvisar allt annat.
    // Detta stoppar t.ex. en komprometterad downstream-respons från
    // att injektera <script>alert(1)</script> rakt in i DOM:en.
    const looksLikeKlarnaSnippet =
      /klarna-checkout|klarna\.com|class="klarna/i.test(klarnaHtml) &&
      !/javascript:/i.test(klarnaHtml);
    if (!looksLikeKlarnaSnippet) {
      console.error("Refusing to render non-Klarna checkout snippet");
      setError(t.klarnaInitFailed);
      setKlarnaHtml("");
      return;
    }

    klarnaRef.current.innerHTML = klarnaHtml;
    const scripts = klarnaRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      // Block externa script-källor som inte är Klarna's CDN. Inline-
      // script lämnas igenom — det är vad Klarna behöver för att
      // hooke postMessage-bryggan.
      const src = oldScript.getAttribute("src");
      if (src && !/^https:\/\/([a-z0-9-]+\.)*klarna(cdn)?\.com\//i.test(src)) {
        return;
      }
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [klarnaHtml, t.klarnaInitFailed]);

  if (klarnaHtml) {
    return (
      <div className="min-h-screen bg-brand-50/30">
        <header className="border-b bg-background">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <h1 className="text-lg font-semibold">{t.completeOrder}</h1>
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
          <LocaleLink
            href={`/shop/${slug}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </LocaleLink>
          <h1 className="text-lg font-semibold">{t.title}</h1>
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
              <CardTitle className="text-base">{t.orderSummary}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* KC4.1: medan vi väntar på hydrate/shop-fetch, visa
                  loader istället för en falsk "tom"-skylt — det är en
                  jättevanlig felkälla att se "Din varukorg är tom"
                  blink-fram precis innan items dyker upp. */}
              {!hydrated || !shopData ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.fetchingCart}
                </div>
              ) : resolvedLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.emptyCart}{" "}
                  <LocaleLink
                    href={`/shop/${slug}`}
                    className="underline underline-offset-2"
                  >
                    {t.backToShop}
                  </LocaleLink>
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
                            {tFill(t.lineQtyPrice, {
                              qty: l.qty,
                              amount: formatKr(l.unitPriceOre, locale),
                            })}
                          </p>
                        </div>
                        <p className="shrink-0 font-medium tabular-nums">
                          {formatKr(l.totalOre, locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t.subtotal}</span>
                      <span className="tabular-nums">
                        {formatKr(subtotalOre, locale)}
                      </span>
                    </div>
                    {deliveryType === "DIRECT" && shippingFee > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>
                          {t.shipping}
                          {shippingOre === 0 && shippingThreshold > 0 ? (
                            <span className="ml-1 text-xs">
                              {tFill(t.freeOver, {
                                amount: formatKr(shippingThreshold, locale),
                              })}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">
                          {formatKr(shippingOre, locale)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t.vatIncluded}</span>
                      <span className="tabular-nums">
                        {formatKr(vatOre, locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span>{t.totalToPay}</span>
                      <span className="tabular-nums">
                        {formatKr(totalOre, locale)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.yourDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* MASTERPLAN_01 KC6.7: autoComplete-tokens enligt WHATWG.
                  På iOS/Android fyller browsern PII automatiskt — på
                  mobil där supportrar konverterar är det skillnaden
                  mellan 30 s checkout och abandon. */}
              <div className="space-y-2">
                <Label htmlFor="name">{t.nameLabel}</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.namePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t.phoneLabel}</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.delivery}</CardTitle>
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
                    <p className="font-medium text-sm">{t.bulkTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.bulkHint}
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
                    <p className="font-medium text-sm">{t.homeTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.homeHint}
                    </p>
                  </div>
                </button>
              </div>

              {deliveryType === "DIRECT" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="address">{t.addressLabel}</Label>
                    <Input
                      id="address"
                      required
                      autoComplete="street-address"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder={t.addressPlaceholder}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">{t.postalLabel}</Label>
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
                      <Label htmlFor="city">{t.cityLabel}</Label>
                      <Input
                        id="city"
                        required
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={t.cityPlaceholder}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.noteTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
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
            <span
              id="terms-help"
              className="leading-relaxed text-muted-foreground"
            >
              {t.termsPrefix}
              <LocaleLink
                href="/villkor"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t.termsLink}
              </LocaleLink>
              {t.termsAnd}
              <LocaleLink
                href="/integritet"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t.privacyLink}
              </LocaleLink>
              {t.termsSuffix}
            </span>
          </label>

          {shopData && !campaignAcceptsOrders && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
            >
              {t.campaignInactive}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tFill(t.productCount, {
                count: items.reduce((s, i) => s + i.qty, 0),
              })}
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
                (shopData !== null && !campaignAcceptsOrders) ||
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
                  {t.preparing}
                </>
              ) : (
                t.goToPayment
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
