"use client";

/**
 * Customer-order detail dialog.
 *
 * Shared across every surface that lists B2C customer_orders rows
 * (seller / team leader / association admin / internal admin). The
 * underlying endpoint `GET /v1/dashboard/seller/orders/:orderId`
 * already enforces RBAC server-side — this component just renders
 * whatever it returns, or a clean error/loading state when it
 * doesn't.
 *
 * Usage:
 *
 *   const [open, setOpen] = useState(false);
 *   const [orderId, setOrderId] = useState<string | null>(null);
 *
 *   <button onClick={() => { setOrderId(o.id); setOpen(true); }}>…</button>
 *
 *   <OrderDetailDialog
 *     open={open}
 *     orderId={orderId}
 *     onOpenChange={setOpen}
 *   />
 *
 * The dialog itself owns the fetch/lifecycle. Callers only supply
 * an `orderId` + open-state; we keep this isolated so list pages
 * stay readable.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Package,
  FileText,
  BadgeCheck,
  Clock,
  Ban,
} from "lucide-react";
import { countsAsRevenue } from "@roots/contracts";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-status";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { formatKr } from "@/lib/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { tFill } from "@/i18n/format";

const API_URL = getBrowserApiBase();

export interface OrderDetail {
  order: {
    id: string;
    status: string;
    paymentMethod: "KLARNA" | "STRIPE" | "DIRECT_TO_LEADER";
    deliveryType: "BULK" | "DIRECT";
    totalOre: number;
    shippingOre: number;
    klarnaOrderId: string | null;
    stripeCheckoutSessionId?: string | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    isManual?: boolean;
    /** Null = väntar på bekräftelse och räknas inte i avräkningen. */
    verifiedAt?: string | null;
    /** Om just den inloggade användaren får bekräfta. Servern avgör. */
    canVerify?: boolean;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    cancelledAt?: string | null;
    cancelReason?: string | null;
    /** Om användaren får flytta ordern mellan betald/skickad/levererad. */
    canManageFulfillment?: boolean;
    /** Om användaren får avboka eller återbetala ordern. */
    canCancel?: boolean;
    customer: {
      name: string;
      email: string;
      phone: string | null;
    };
    shipping: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      postalCode: string | null;
    };
  };
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string | null;
    qty: number;
    unitPriceOre: number;
    lineTotalOre: number;
  }>;
}

function formatSek(ore: number, dateLocale: string, currencyLabel: string): string {
  return `${(ore / 100).toLocaleString(dateLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ${currencyLabel}`;
}
function formatDateTime(iso: string, dateLocale: string): string {
  try {
    return new Date(iso).toLocaleString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Order UUID to load — set to null to close the dialog. */
  orderId: string | null;
  /**
   * Anropas när en manuell order bekräftats eller fått bekräftelsen
   * återtagen. Listan som öppnade dialogen behöver ladda om, annars visar
   * den kvar "väntar på bekräftelse" på en order som just godkänts.
   */
  onVerificationChange?: (orderId: string, verified: boolean) => void;
  /**
   * Anropas när orderns status ändrats (leverans, avbokning). Listan bakom
   * dialogen visar annars kvar den gamla statusen.
   */
  onStatusChange?: (orderId: string, status: string) => void;
}

/** Stegen en order rör sig genom när den blivit betald. */
const CLOSED_STATUSES = ["CANCELLED", "REFUNDED", "FAILED"];

export function OrderDetailDialog({
  open,
  onOpenChange,
  orderId,
  onVerificationChange,
  onStatusChange,
}: Props) {
  const { locale } = useLocale();
  const t = fundraisingPages.orderDetail[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const paymentLabels: Record<string, string> = {
    KLARNA: "Klarna",
    STRIPE: "Stripe",
    DIRECT_TO_LEADER: t.paymentDirectToLeader,
  };
  const deliveryLabels: Record<string, string> = {
    BULK: t.deliveryBulkTeam,
    DIRECT: t.deliveryDirectCustomer,
  };
  const fulfillmentSteps = [
    { status: "PAID" as const, label: fundraisingPages.orderStatus[locale].PAID, action: t.undoDelivery },
    { status: "SHIPPED" as const, label: fundraisingPages.orderStatus[locale].SHIPPED, action: t.markShipped },
    { status: "DELIVERED" as const, label: fundraisingPages.orderStatus[locale].DELIVERED, action: t.markDelivered },
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelKind, setCancelKind] = useState<"CANCELLED" | "REFUNDED">(
    "CANCELLED"
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setConfirming(false);
    setCancelOpen(false);
    setCancelReason("");
    setLoading(true);
    (async () => {
      try {
        const res = await rootsFetch(`${API_URL}/v1/dashboard/seller/orders/${orderId}`);
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!cancelled) {
            setError(j?.error ?? t.loadFailed);
          }
          return;
        }
        const json = (await res.json()) as OrderDetail;
        if (!cancelled) setDetail(json);
      } catch {
        if (!cancelled) setError(t.networkError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  async function setVerified(verified: boolean) {
    if (!orderId) return;
    setVerifying(true);
    const { ok, data } = await apiFetch<{
      error?: string;
      order?: { verifiedAt: string | null };
    }>(`/v1/dashboard/orders/${orderId}/verify`, {
      method: "POST",
      body: { verified },
    });
    setVerifying(false);
    setConfirming(false);

    if (!ok) {
      toast(data?.error || t.confirmFailed, "error");
      return;
    }

    // Uppdatera dialogen på plats i stället för att hämta om allt. Svaret
    // innehåller den nya tidsstämpeln, så det finns inget att vänta på.
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            order: {
              ...prev.order,
              verifiedAt: data?.order?.verifiedAt ?? null,
            },
          }
        : prev
    );
    toast(
      verified
        ? t.confirmOk
        : t.unconfirmOk,
      "success"
    );
    onVerificationChange?.(orderId, verified);
  }

  async function setFulfillment(status: "PAID" | "SHIPPED" | "DELIVERED") {
    if (!orderId) return;
    setSavingStatus(true);
    const { ok, data } = await apiFetch<{
      error?: string;
      order?: {
        status: string;
        shippedAt: string | null;
        deliveredAt: string | null;
      };
    }>(`/v1/dashboard/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      body: { status },
    });
    setSavingStatus(false);

    if (!ok || !data?.order) {
      toast(data?.error || t.fulfillmentFailed, "error");
      return;
    }

    const next = data.order;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            order: {
              ...prev.order,
              status: next.status,
              shippedAt: next.shippedAt,
              deliveredAt: next.deliveredAt,
            },
          }
        : prev
    );
    toast(
      status === "PAID"
        ? t.deliveryRemoved
        : status === "SHIPPED"
          ? t.markedShipped
          : t.markedDelivered,
      "success"
    );
    onStatusChange?.(orderId, next.status);
  }

  async function cancelOrder(force: boolean) {
    if (!orderId) return;
    setSavingStatus(true);
    const { ok, data } = await apiFetch<{
      error?: string;
      requiresForce?: boolean;
      manualStepRequired?: string | null;
      order?: { status: string; cancelledAt: string | null };
    }>(`/v1/dashboard/orders/${orderId}/cancel`, {
      method: "POST",
      body: { status: cancelKind, reason: cancelReason.trim(), force },
    });
    setSavingStatus(false);

    if (!ok || !data?.order) {
      // Servern svarar 409 när lagets utbetalning redan är fakturerad eller
      // genomförd. Då är det inte ett fel att rätta utan ett beslut att ta,
      // så vi visar vad det innebär och låter användaren bekräfta igen.
      if (data?.requiresForce) {
        const proceed = window.confirm(
          tFill(t.forceCancelConfirm, { error: data.error || "" })
        );
        if (proceed) await cancelOrder(true);
        return;
      }
      toast(data?.error || t.cancelFailed, "error");
      return;
    }

    setDetail((prev) =>
      prev
        ? {
            ...prev,
            order: {
              ...prev.order,
              status: data.order!.status,
              cancelledAt: data.order!.cancelledAt,
              cancelReason: cancelReason.trim(),
            },
          }
        : prev
    );
    setCancelOpen(false);
    toast(
      data.manualStepRequired
        ? tFill(t.refundedWithManual, { manual: data.manualStepRequired })
        : cancelKind === "REFUNDED"
          ? t.refundOk
          : t.cancelOk,
      "success"
    );
    onStatusChange?.(orderId, data.order.status);
  }

  const hasShipping =
    detail &&
    (detail.order.shipping.line1 ||
      detail.order.shipping.city ||
      detail.order.shipping.postalCode);
  const subtotalOre = detail
    ? detail.lines.reduce((sum, l) => sum + l.lineTotalOre, 0)
    : 0;
  const statusClass = detail ? orderStatusColor(detail.order.status) : "";
  const isClosed = !!detail && CLOSED_STATUSES.includes(detail.order.status);
  const isRevenue = !!detail && countsAsRevenue(detail.order.status);
  const stepIndex = detail
    ? fulfillmentSteps.findIndex((s) => s.status === detail.order.status)
    : -1;
  // CONFIRMED ligger mellan PAID och SHIPPED men har inget eget steg, så den
  // behandlas som betald.
  const currentStep = stepIndex === -1 ? 0 : stepIndex;
  const nextStep = fulfillmentSteps[currentStep + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {detail
              ? tFill(t.orderRef, {
                  id: detail.order.id.slice(0, 8),
                  datetime: formatDateTime(detail.order.createdAt, dateLocale),
                })
              : t.loading}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">
              {error}
            </p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wide ${statusClass}`}
                >
                  {orderStatusLabel(detail.order.status, locale)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <CreditCard className="mr-1 h-3 w-3" />
                  {paymentLabels[detail.order.paymentMethod] ||
                    detail.order.paymentMethod}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Truck className="mr-1 h-3 w-3" />
                  {deliveryLabels[detail.order.deliveryType] ||
                    detail.order.deliveryType}
                </Badge>
                {detail.order.stripeCheckoutSessionId && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Stripe {detail.order.stripeCheckoutSessionId.slice(0, 12)}
                  </Badge>
                )}
                {detail.order.klarnaOrderId && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Klarna {detail.order.klarnaOrderId.slice(0, 10)}
                  </Badge>
                )}
                {detail.order.isManual && (
                  <Badge
                    variant="outline"
                    className={
                      detail.order.verifiedAt
                        ? "bg-success/15 text-success border-success/40 text-xs"
                        : "bg-warning-surface text-warning-strong border-warning-edge text-xs"
                    }
                  >
                    {detail.order.verifiedAt ? (
                      <BadgeCheck className="mr-1 h-3 w-3" />
                    ) : (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    {detail.order.verifiedAt
                      ? t.confirmed
                      : t.awaitingConfirmation}
                  </Badge>
                )}
              </div>

              {/* Manuella ordrar är säljarens ord på att pengarna kommit in.
                  De räknas i statistiken direkt men hålls utanför
                  utbetalningen tills någon annan bekräftat dem — det här är
                  ytan där det sker. Utan den fastnar pengarna. */}
              {detail.order.isManual && (
                <section
                  className={`rounded-lg border p-4 ${
                    detail.order.verifiedAt
                      ? "border-success/40 bg-success/5"
                      : "border-warning-edge bg-warning-surface"
                  }`}
                >
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    {detail.order.verifiedAt ? (
                      <BadgeCheck className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning-strong" />
                    )}
                    {t.manualPayment}
                  </h3>

                  {detail.order.verifiedAt ? (
                    <>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {tFill(t.confirmedCounts, {
                          datetime: formatDateTime(
                            detail.order.verifiedAt,
                            dateLocale
                          ),
                        })}
                      </p>
                      {detail.order.canVerify && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-auto p-0 text-xs text-muted-foreground underline hover:text-destructive"
                          disabled={verifying}
                          onClick={() => setVerified(false)}
                        >
                          {verifying && (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          )}
                          {t.undoConfirmBtn}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {tFill(t.registeredAwaiting, { amount: formatKr(detail.order.totalOre, locale) })}
                      </p>

                      {detail.order.canVerify ? (
                        confirming ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-medium">
                              {tFill(t.gotAmount, { amount: formatKr(detail.order.totalOre, locale) })}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={verifying}
                                onClick={() => setVerified(true)}
                              >
                                {verifying && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {t.yesConfirm}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={verifying}
                                onClick={() => setConfirming(false)}
                              >
                                {t.cancel}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => setConfirming(true)}
                          >
                            <BadgeCheck className="mr-2 h-4 w-4" />
                            {t.confirmPayment}
                          </Button>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t.cannotSelfConfirm}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* Avbokad eller återbetald: skälet är det enda som gör den
                  här ordern begriplig i efterhand, så det visas i stället för
                  knappar som inte längre går att trycka på. */}
              {isClosed && (
                <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <Ban className="h-4 w-4" />
                    {detail.order.status === "REFUNDED"
                      ? t.refunded
                      : detail.order.status === "FAILED"
                        ? t.paymentFailed
                        : t.cancelled}
                    {detail.order.cancelledAt &&
                      ` ${formatDateTime(detail.order.cancelledAt, dateLocale)}`}
                  </h3>
                  {detail.order.cancelReason && (
                    <p className="mt-1.5 text-sm">
                      <span className="text-muted-foreground">{t.reasonLabel}: </span>
                      {detail.order.cancelReason}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t.closedHint}
                  </p>
                </section>
              )}

              {/* Leveranssteg. Endpointen har funnits en tid men saknade yta,
                  så en order kunde bli betald och sedan aldrig komma längre. */}
              {!isClosed && isRevenue && detail.order.canManageFulfillment && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.delivery}
                  </h3>
                  <div className="rounded-lg border p-4">
                    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {fulfillmentSteps.map((step, i) => {
                        const reached = currentStep >= i;
                        return (
                          <li
                            key={step.status}
                            className="flex items-center gap-2"
                          >
                            {i > 0 && (
                              <span
                                aria-hidden
                                className={`h-px w-6 ${reached ? "bg-success" : "bg-border"}`}
                              />
                            )}
                            <span
                              className={`flex items-center gap-1.5 ${
                                reached
                                  ? "font-medium text-success"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {reached ? (
                                <BadgeCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              {step.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextStep && (
                        <Button
                          size="sm"
                          disabled={savingStatus}
                          onClick={() => setFulfillment(nextStep.status)}
                        >
                          {savingStatus ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Truck className="mr-2 h-4 w-4" />
                          )}
                          {nextStep.action}
                        </Button>
                      )}
                      {currentStep > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingStatus}
                          onClick={() => setFulfillment("PAID")}
                        >
                          {t.undoDeliveryMark}
                        </Button>
                      )}
                    </div>

                    {detail.order.shippedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {detail.order.deliveredAt
                          ? tFill(t.shippedAndDelivered, {
                              shipped: formatDateTime(
                                detail.order.shippedAt,
                                dateLocale
                              ),
                              delivered: formatDateTime(
                                detail.order.deliveredAt,
                                dateLocale
                              ),
                            })
                          : tFill(t.shippedAt, {
                              datetime: formatDateTime(
                                detail.order.shippedAt,
                                dateLocale
                              ),
                            })}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Avbokning. Skälet är obligatoriskt eftersom en avbokad order
                  tas ur intäkten, och då behöver någon kunna se varför. */}
              {!isClosed && detail.order.canCancel && (
                <section>
                  {cancelOpen ? (
                    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {isRevenue
                            ? t.cancelTitle
                            : t.cancelOrder}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.cancelImpact}
                        </p>
                      </div>

                      {/* Skillnaden mellan de två är om pengar hunnit röra
                          sig. Stripe-betalda ordrar kan bara återbetalas. */}
                      {isRevenue && (
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              {
                                kind: "REFUNDED" as const,
                                label: t.refundOption,
                              },
                              {
                                kind: "CANCELLED" as const,
                                label: t.noMoneyCameIn,
                              },
                            ] as const
                          ).map((opt) => {
                            const blocked =
                              opt.kind === "CANCELLED" &&
                              (detail.order.paymentMethod === "STRIPE" ||
                                detail.order.paymentMethod === "KLARNA");
                            if (blocked) return null;
                            return (
                              <Button
                                key={opt.kind}
                                type="button"
                                size="sm"
                                variant={
                                  cancelKind === opt.kind
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => setCancelKind(opt.kind)}
                              >
                                {opt.label}
                              </Button>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid gap-1.5">
                        <Label htmlFor="cancel-reason">{t.reasonLabel}</Label>
                        <textarea
                          id="cancel-reason"
                          rows={2}
                          value={cancelReason}
                          maxLength={500}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder={t.reasonPlaceholder}
                          className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={
                            savingStatus || cancelReason.trim().length < 3
                          }
                          onClick={() => cancelOrder(false)}
                        >
                          {savingStatus && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {cancelKind === "REFUNDED"
                            ? t.markRefunded
                            : t.cancelOrder}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingStatus}
                          onClick={() => setCancelOpen(false)}
                        >
                          {t.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground underline hover:text-destructive"
                      onClick={() => {
                        // Har pengar kommit in är återbetalning förvalet.
                        // Annars finns det inget att betala tillbaka.
                        setCancelKind(isRevenue ? "REFUNDED" : "CANCELLED");
                        setCancelOpen(true);
                      }}
                    >
                      <Ban className="mr-1.5 h-3 w-3" />
                      {isRevenue ? t.cancelOrRefund : t.cancelOrder}
                    </Button>
                  )}
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.customer}
                </h3>
                <div className="rounded-lg border bg-brand-50/40 p-4 text-sm">
                  <p className="font-medium">{detail.order.customer.name}</p>
                  {detail.order.customer.email && (
                    <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <a
                        href={`mailto:${detail.order.customer.email}`}
                        className="hover:underline"
                      >
                        {detail.order.customer.email}
                      </a>
                    </p>
                  )}
                  {detail.order.customer.phone && (
                    <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <a
                        href={`tel:${detail.order.customer.phone}`}
                        className="hover:underline"
                      >
                        {detail.order.customer.phone}
                      </a>
                    </p>
                  )}
                  {hasShipping && (
                    <div className="mt-2 flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        {detail.order.shipping.line1 && (
                          <p>{detail.order.shipping.line1}</p>
                        )}
                        {detail.order.shipping.line2 && (
                          <p>{detail.order.shipping.line2}</p>
                        )}
                        {(detail.order.shipping.postalCode ||
                          detail.order.shipping.city) && (
                          <p>
                            {detail.order.shipping.postalCode}{" "}
                            {detail.order.shipping.city}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.products}
                </h3>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {t.product}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t.qty}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t.unitPrice}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t.lineSum}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-xs text-muted-foreground"
                          >
                            {t.noLines}
                          </td>
                        </tr>
                      ) : (
                        detail.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2">
                              <div className="flex items-start gap-2">
                                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {l.productName}
                                  </p>
                                  {l.productSku && (
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                      {l.productSku}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {l.qty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatSek(l.unitPriceOre, dateLocale, c.kr)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatSek(l.lineTotalOre, dateLocale, c.kr)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.subtotal}</span>
                    <span className="tabular-nums">
                      {formatSek(subtotalOre, dateLocale, c.kr)}
                    </span>
                  </div>
                  {detail.order.shippingOre > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.shipping}</span>
                      <span className="tabular-nums">
                        {formatSek(detail.order.shippingOre, dateLocale, c.kr)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>{t.total}</span>
                    <span className="tabular-nums">
                      {formatSek(detail.order.totalOre, dateLocale, c.kr)}
                    </span>
                  </div>
                </div>
              </section>

              {detail.order.note && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.customerMessage}
                  </h3>
                  <div className="flex items-start gap-2 rounded-lg border bg-brand-50/40 p-4 text-sm">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="whitespace-pre-wrap">{detail.order.note}</p>
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
