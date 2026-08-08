"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Share2, AlertCircle } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { formatKr } from "@/lib/format";
import { shop } from "@/i18n/dictionaries/shop";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const API_URL = getBrowserApiBase();

interface OrderConfirmation {
  orderId: string;
  status: string;
  totalOre: number;
  customerName: string;
  customerEmail: string;
  /**
   * P1.5 (audit 2026-05-26): signerad token vi behöver för att
   * öppna `/shop/[slug]/order/[orderId]?t=…` — annars 401.
   */
  viewToken?: string;
}

/**
 * MASTERPLAN_01 KC4: error-state måste branchas så supportern får
 * användbar feedback istället för en generic "något gick fel".
 *   - missing order-id → "Ogiltig länk"
 *   - 404 → "Vi hittade ingen order"
 *   - 5xx / network → "Tekniskt fel, försök igen"
 *   - status FAILED/CANCELLED → "Din betalning gick inte igenom"
 */
type ErrorKind = null | "missing" | "not-found" | "server" | "failed-payment";

// P2.28 (audit 2026-05-26): Next 15 kräver att useSearchParams ligger
// bakom <Suspense>. Default-exporten gör wrap:en, inner gör jobbet.
export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <ConfirmationPageInner />
    </Suspense>
  );
}

function ConfirmationPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const orderId = searchParams.get("order_id");
  const { locale, href } = useLocale();
  const t = shop.confirmation[locale];
  // MASTERPLAN_01 KC1.6: rensa cart efter lyckad bekräftelse så
  // användaren inte ser kvarvarande items vid retur till shoppen.
  const { clear: clearCart, hydrated: cartHydrated } = useCart(slug);

  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);

  const errorCopy: Record<
    Exclude<ErrorKind, null>,
    { title: string; body: string }
  > = {
    missing: { title: t.missingTitle, body: t.missingBody },
    "not-found": { title: t.notFoundTitle, body: t.notFoundBody },
    server: { title: t.serverTitle, body: t.serverBody },
    "failed-payment": { title: t.failedTitle, body: t.failedBody },
  };

  useEffect(() => {
    // P2.29 (audit 2026-05-26): explicit cancel-flag så att en
    // svarande efter unmount inte triggar setState (dev-strict-mode
    // warning + minnesläcka).
    let cancelled = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Betalningen kan fortfarande vara PENDING när kunden landar här
    // (Klarna-webhooken har inte hunnit fram). Poll:a tills status
    // flippar till PAID/CONFIRMED istället för att fastna på
    // "behandlas…". ~36 s (12 × 3 s) räcker gott för webhook-latens.
    const MAX_ATTEMPTS = 12;
    let attempts = 0;

    async function confirm() {
      if (!orderId) {
        if (!cancelled) {
          setErrorKind("missing");
          setLoading(false);
        }
        return;
      }
      try {
        const res = await rootsFetch(
          `${API_URL}/v1/checkout/confirm/${orderId}`,
          { signal: controller.signal }
        );
        if (cancelled) return;
        if (res.status === 404) {
          setErrorKind("not-found");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setErrorKind("server");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setErrorKind("failed-payment");
        } else {
          setOrder(data);
          const settled =
            data.status === "PAID" || data.status === "CONFIRMED";
          if (!settled && attempts < MAX_ATTEMPTS) {
            attempts += 1;
            timer = setTimeout(confirm, 3000);
          }
          // P2.25 (audit 2026-05-26): rensa bara cart EFTER att
          // useCart har hydrat:s från sessionStorage. Annars race:ar
          // hydration-skrivningen vår clear() och kunden hittar gamla
          // items i nästa besök på shoppen.
          //
          // P3.46 (audit 2026-05-26): rensa ÄVEN vid PENDING. Tidigare
          // väntade vi tills status flippat till PAID/CONFIRMED, men
          // medan vi visade "Din betalning behandlas…" låg cart:en
          // kvar i sessionStorage. Backknapp + ny checkout blev en
          // möjlig dubbel-order. PENDING betyder att Klarna har
          // accepterat — om något brister kan kunden lägga till
          // produkterna igen.
          const cartClearable =
            data.status === "PAID" ||
            data.status === "CONFIRMED" ||
            data.status === "PENDING";
          if (cartClearable && cartHydrated) {
            clearCart();
          }
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setErrorKind("server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    confirm();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId, clearCart, cartHydrated]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (errorKind || !order) {
    const copy = errorKind ? errorCopy[errorKind] : errorCopy.server;
    return (
      <div className="min-h-screen bg-brand-50/30">
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
          <Card className="w-full shadow-lg">
            <CardContent className="flex flex-col items-center gap-5 py-10">
              <AlertCircle className="h-14 w-14 text-destructive" />
              <h1 className="text-2xl font-semibold">{copy.title}</h1>
              <p className="text-sm text-muted-foreground text-center">
                {copy.body}
              </p>
              <div className="flex w-full flex-col gap-2">
                {errorKind === "failed-payment" && (
                  <LocaleLink href={`/shop/${slug}`} className="w-full">
                    <Button className="w-full">{t.tryAgain}</Button>
                  </LocaleLink>
                )}
                <LocaleLink href={`/shop/${slug}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    {t.backToShop}
                  </Button>
                </LocaleLink>
                <a
                  href={`mailto:hej@roots.se?subject=${encodeURIComponent(t.contactSubject)}`}
                  className="w-full"
                >
                  <Button variant="ghost" className="w-full">
                    {t.contactUs}
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isPending = order.status === "PENDING" || order.status === "DRAFT";

  return (
    <div className="min-h-screen bg-brand-50/30">
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
        <Card className="w-full shadow-lg">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            {isPending ? (
              <Loader2 className="h-14 w-14 animate-spin text-brand-400" />
            ) : (
              <CheckCircle2 className="h-14 w-14 text-success" />
            )}
            <h1 className="text-2xl font-semibold">
              {isPending ? t.paymentProcessing : t.thankYou}
            </h1>

            <div className="w-full space-y-3 text-center">
              <p className="text-muted-foreground">
                {t.confirmationSentTo}
                <span className="font-medium text-foreground">
                  {order.customerEmail}
                </span>
              </p>
              <div className="rounded-lg bg-brand-50 p-4">
                <p className="text-sm text-muted-foreground">{t.amountLabel}</p>
                <p className="text-xl font-semibold">
                  {formatKr(order.totalOre, locale)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {tFill(t.orderNumber, { id: order.orderId.slice(0, 8) })}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-2 w-full">
              <LocaleLink
                href={
                  order.viewToken
                    ? `/shop/${slug}/order/${order.orderId}?t=${encodeURIComponent(order.viewToken)}`
                    : `/shop/${slug}/order/${order.orderId}`
                }
                className="w-full"
              >
                <Button variant="outline" className="w-full">
                  {t.seeOrderStatus}
                </Button>
              </LocaleLink>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const url = `${window.location.origin}${href(`/shop/${slug}`)}`;
                  try {
                    if (navigator.share) {
                      navigator.share({ title: t.shareTitle, url });
                    } else {
                      navigator.clipboard.writeText(url);
                    }
                  } catch {
                    /* Silently handle permission/cancel errors */
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {t.shareShop}
              </Button>
              <LocaleLink href={`/shop/${slug}`} className="w-full">
                <Button variant="ghost" className="w-full">
                  {t.backToShop}
                </Button>
              </LocaleLink>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
