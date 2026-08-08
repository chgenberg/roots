"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Package,
  CheckCircle2,
  Truck,
  Clock,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import { LocaleLink } from "@/components/locale-link";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { formatKr } from "@/lib/format";
import { shop } from "@/i18n/dictionaries/shop";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const API_URL = getBrowserApiBase();

interface OrderData {
  orderId: string;
  status: string;
  totalOre: number;
  shippingOre: number;
  customerName: string;
  deliveryType: string;
  createdAt: string;
  sellerName: string | null;
  shopSlug: string | null;
  items: Array<{ name: string; qty: number; unitPriceOre: number }>;
}

const STATUS_KEYS = [
  "PENDING",
  "PAID",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
] as const;

const STATUS_ICONS = {
  PENDING: Clock,
  PAID: CheckCircle2,
  CONFIRMED: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle2,
} as const;

function getStepIndex(status: string): number {
  const idx = STATUS_KEYS.indexOf(status as (typeof STATUS_KEYS)[number]);
  return idx >= 0 ? idx : 0;
}

function OrderStatusPageInner() {
  const params = useParams();
  // P1.5 (audit 2026-05-26): signerad token från `?t=` krävs av
  // `/v1/checkout/order-status/:orderId`. Tokens utfärdas vid
  // checkout-create + i bekräftelse-mailet.
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const orderId = params.orderId as string;
  const viewToken = searchParams.get("t");
  const { locale } = useLocale();
  const t = shop.orderStatus[locale];
  const dateLocale = locale === "en" ? "en-GB" : "sv-SE";

  const statusSteps = [
    { key: "PENDING" as const, label: t.stepPending },
    { key: "PAID" as const, label: t.stepPaid },
    { key: "CONFIRMED" as const, label: t.stepConfirmed },
    { key: "SHIPPED" as const, label: t.stepShipped },
    { key: "DELIVERED" as const, label: t.stepDelivered },
  ];

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"missing-token" | "other" | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Om betalningen fortfarande behandlas (PENDING/DRAFT) poll:ar vi
    // tills den slår om, i stället för att visa en fastfrusen status.
    const MAX_ATTEMPTS = 12;
    let attempts = 0;
    async function load() {
      if (!viewToken) {
        setError("missing-token");
        setLoading(false);
        return;
      }
      try {
        const res = await rootsFetch(`${API_URL}/v1/checkout/order-status/${orderId}?t=${encodeURIComponent(viewToken)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setOrder(data);
          const pending =
            data.status === "PENDING" || data.status === "DRAFT";
          if (pending && attempts < MAX_ATTEMPTS) {
            attempts += 1;
            timer = setTimeout(load, 3000);
          }
        } else {
          setError(res.status === 401 ? "missing-token" : "other");
        }
      } catch {
        if (!cancelled) setError("other");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, viewToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !order) {
    const isMissingToken = error === "missing-token";
    return (
      <div className="min-h-screen bg-brand-50/30">
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
          <Card className="w-full shadow-lg">
            <CardContent className="flex flex-col items-center gap-5 py-10">
              <AlertCircle className="h-14 w-14 text-destructive" />
              <h1 className="text-2xl font-semibold">
                {isMissingToken ? t.invalidLinkTitle : t.notFoundTitle}
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                {isMissingToken ? t.invalidLinkBody : t.notFoundBody}
              </p>
              <LocaleLink href={`/shop/${slug}`} className="w-full">
                <Button variant="outline" className="w-full">
                  {t.backToShop}
                </Button>
              </LocaleLink>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isFailed =
    order.status === "FAILED" ||
    order.status === "CANCELLED" ||
    order.status === "REFUNDED";
  const isPending = order.status === "PENDING" || order.status === "DRAFT";
  const currentStep = getStepIndex(order.status);

  return (
    <div className="min-h-screen bg-brand-50/30">
      <main className="mx-auto max-w-lg px-4 py-8">
        <LocaleLink
          href={`/shop/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToShop}
        </LocaleLink>

        <Card className="shadow-lg">
          <CardContent className="py-8 space-y-6">
            <div className="text-center">
              {isFailed ? (
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
              ) : order.status === "DELIVERED" ? (
                <CheckCircle2 className="mx-auto h-12 w-12 text-brand-500 mb-3" />
              ) : isPending ? (
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-400 mb-3" />
              ) : (
                <Package className="mx-auto h-12 w-12 text-brand-500 mb-3" />
              )}
              <h1 className="text-xl font-semibold">
                {order.status === "REFUNDED"
                  ? t.titleRefunded
                  : isFailed
                    ? t.titleFailed
                    : isPending
                      ? t.titlePending
                      : t.titleStatus}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tFill(t.orderHash, { id: order.orderId.slice(0, 8) })}
              </p>
            </div>

            {!isFailed && (
              <div className="relative">
                <div className="flex justify-between">
                  {statusSteps.map((step, i) => {
                    const StepIcon = STATUS_ICONS[step.key];
                    const isActive = i <= currentStep;
                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center gap-1.5 relative z-10"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                            isActive
                              ? "bg-brand-700 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <span
                          className={`text-xs ${
                            isActive
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                  <div
                    className="h-full bg-brand-700 transition-all duration-500"
                    style={{
                      width: `${(currentStep / (statusSteps.length - 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 rounded-lg bg-brand-50 p-4">
              <p className="text-sm text-muted-foreground">{t.customer}</p>
              <p className="font-medium">{order.customerName}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {t.deliveryMethod}
              </p>
              <p className="text-sm font-medium">
                {order.deliveryType === "DIRECT"
                  ? t.deliveryDirect
                  : t.deliveryBulk}
              </p>
              {order.sellerName && (
                <>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.seller}
                  </p>
                  <p className="text-sm font-medium">{order.sellerName}</p>
                </>
              )}
              <p className="text-xs text-muted-foreground mt-2">{t.ordered}</p>
              <p className="text-sm font-medium">
                {new Date(order.createdAt).toLocaleDateString(dateLocale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t.products}</p>
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                >
                  <span>
                    {item.name}{" "}
                    <span className="text-muted-foreground">x{item.qty}</span>
                  </span>
                  <span className="font-medium">
                    {formatKr(item.unitPriceOre * item.qty, locale)}
                  </span>
                </div>
              ))}
              {order.shippingOre > 0 && (
                <div className="flex items-center justify-between text-sm py-1.5 border-b">
                  <span className="text-muted-foreground">{t.shipping}</span>
                  <span>{formatKr(order.shippingOre, locale)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold">{t.total}</span>
                <span className="text-lg font-bold">
                  {formatKr(order.totalOre, locale)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function OrderStatusPage() {
  // P1.5: Suspense-wrap så `useSearchParams` inte bailar ut hela
  // sidan till CSR (Next 15-krav). Matchar mönstret i `/forening` m.fl.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <OrderStatusPageInner />
    </Suspense>
  );
}
