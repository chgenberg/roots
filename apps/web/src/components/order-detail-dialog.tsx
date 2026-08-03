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
import { apiFetch } from "@/lib/api";
import { formatKrValue } from "@/lib/format";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-status";

const API_URL = getBrowserApiBase();

export interface OrderDetail {
  order: {
    id: string;
    status: string;
    paymentMethod: "KLARNA" | "DIRECT_TO_LEADER";
    deliveryType: "BULK" | "DIRECT";
    totalOre: number;
    shippingOre: number;
    klarnaOrderId: string | null;
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

const PAYMENT_LABELS: Record<string, string> = {
  KLARNA: "Klarna",
  DIRECT_TO_LEADER: "Direkt till lagansvarig",
};
const DELIVERY_LABELS: Record<string, string> = {
  BULK: "Samleverans till laget",
  DIRECT: "Direkt till kund",
};

function formatSek(ore: number): string {
  return `${(ore / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kr`;
}
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
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
const FULFILLMENT_STEPS: Array<{
  status: "PAID" | "SHIPPED" | "DELIVERED";
  label: string;
  action: string;
}> = [
  { status: "PAID", label: "Betald", action: "Ångra leverans" },
  { status: "SHIPPED", label: "Skickad", action: "Markera skickad" },
  { status: "DELIVERED", label: "Levererad", action: "Markera levererad" },
];

const CLOSED_STATUSES = ["CANCELLED", "REFUNDED", "FAILED"];

export function OrderDetailDialog({
  open,
  onOpenChange,
  orderId,
  onVerificationChange,
  onStatusChange,
}: Props) {
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
        const res = await fetch(
          `${API_URL}/v1/dashboard/seller/orders/${orderId}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!cancelled) {
            setError(j?.error ?? "Kunde inte hämta order.");
          }
          return;
        }
        const json = (await res.json()) as OrderDetail;
        if (!cancelled) setDetail(json);
      } catch {
        if (!cancelled) setError("Nätverksfel. Försök igen.");
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
      toast(data?.error || "Kunde inte uppdatera bekräftelsen.", "error");
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
        ? "Ordern är bekräftad och räknas nu med i avräkningen."
        : "Bekräftelsen är återtagen. Ordern räknas inte i avräkningen.",
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
      toast(data?.error || "Kunde inte uppdatera leveransstatus.", "error");
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
        ? "Leveransmarkeringen är borttagen."
        : `Ordern är markerad som ${status === "SHIPPED" ? "skickad" : "levererad"}.`,
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
          `${data.error}\n\nVill du avboka ordern ändå? Den försvinner ur underlaget men det redan utbetalda beloppet ändras inte.`
        );
        if (proceed) await cancelOrder(true);
        return;
      }
      toast(data?.error || "Kunde inte avboka ordern.", "error");
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
        ? `Ordern är markerad som återbetald. ${data.manualStepRequired}`
        : cancelKind === "REFUNDED"
          ? "Ordern är markerad som återbetald och räknas inte längre som intäkt."
          : "Ordern är avbokad och räknas inte längre som intäkt.",
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
    ? FULFILLMENT_STEPS.findIndex((s) => s.status === detail.order.status)
    : -1;
  // CONFIRMED ligger mellan PAID och SHIPPED men har inget eget steg, så den
  // behandlas som betald.
  const currentStep = stepIndex === -1 ? 0 : stepIndex;
  const nextStep = FULFILLMENT_STEPS[currentStep + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orderdetaljer</DialogTitle>
          <DialogDescription>
            {detail
              ? `Order #${detail.order.id.slice(0, 8)} · ${formatDateTime(detail.order.createdAt)}`
              : "Hämtar information…"}
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
                  {orderStatusLabel(detail.order.status)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <CreditCard className="mr-1 h-3 w-3" />
                  {PAYMENT_LABELS[detail.order.paymentMethod] ||
                    detail.order.paymentMethod}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Truck className="mr-1 h-3 w-3" />
                  {DELIVERY_LABELS[detail.order.deliveryType] ||
                    detail.order.deliveryType}
                </Badge>
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
                      ? "Bekräftad"
                      : "Väntar på bekräftelse"}
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
                    Manuell betalning
                  </h3>

                  {detail.order.verifiedAt ? (
                    <>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Bekräftad {formatDateTime(detail.order.verifiedAt)}.
                        Summan räknas med i lagets avräkning.
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
                          Ta tillbaka bekräftelsen
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {formatKrValue(detail.order.totalOre)} kr är registrerat
                        som mottaget av säljaren, men räknas inte med i
                        avräkningen förrän någon annan bekräftat att pengarna
                        finns.
                      </p>

                      {detail.order.canVerify ? (
                        confirming ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-medium">
                              Har du fått {formatKrValue(detail.order.totalOre)}{" "}
                              kr för den här ordern?
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
                                Ja, bekräfta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={verifying}
                                onClick={() => setConfirming(false)}
                              >
                                Avbryt
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
                            Bekräfta betalningen
                          </Button>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          En lagledare eller föreningens admin behöver bekräfta
                          ordern. Den som registrerat den kan inte bekräfta den
                          själv.
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
                      ? "Återbetald"
                      : detail.order.status === "FAILED"
                        ? "Betalningen gick inte igenom"
                        : "Avbokad"}
                    {detail.order.cancelledAt &&
                      ` ${formatDateTime(detail.order.cancelledAt)}`}
                  </h3>
                  {detail.order.cancelReason && (
                    <p className="mt-1.5 text-sm">
                      <span className="text-muted-foreground">Skäl: </span>
                      {detail.order.cancelReason}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Summan räknas inte som intäkt och ingår inte i lagets
                    avräkning.
                  </p>
                </section>
              )}

              {/* Leveranssteg. Endpointen har funnits en tid men saknade yta,
                  så en order kunde bli betald och sedan aldrig komma längre. */}
              {!isClosed && isRevenue && detail.order.canManageFulfillment && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Leverans
                  </h3>
                  <div className="rounded-lg border p-4">
                    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {FULFILLMENT_STEPS.map((step, i) => {
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
                          Ångra leveransmarkering
                        </Button>
                      )}
                    </div>

                    {detail.order.shippedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Skickad {formatDateTime(detail.order.shippedAt)}
                        {detail.order.deliveredAt &&
                          ` · levererad ${formatDateTime(detail.order.deliveredAt)}`}
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
                            ? "Återbetala eller avboka ordern"
                            : "Avboka ordern"}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Summan tas ur lagets förtjänst och ur underlaget för
                          utbetalning. Det går inte att ångra.
                        </p>
                      </div>

                      {/* Skillnaden mellan de två är om pengar hunnit röra
                          sig. Klarna-betalda ordrar kan bara återbetalas. */}
                      {isRevenue && (
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              {
                                kind: "REFUNDED" as const,
                                label: "Pengarna går tillbaka till kunden",
                              },
                              {
                                kind: "CANCELLED" as const,
                                label: "Inga pengar kom in",
                              },
                            ] as const
                          ).map((opt) => {
                            const blocked =
                              opt.kind === "CANCELLED" &&
                              detail.order.paymentMethod === "KLARNA";
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
                        <Label htmlFor="cancel-reason">Skäl</Label>
                        <textarea
                          id="cancel-reason"
                          rows={2}
                          value={cancelReason}
                          maxLength={500}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="T.ex. kunden ångrade köpet, eller fel belopp registrerat"
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
                            ? "Markera som återbetald"
                            : "Avboka ordern"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingStatus}
                          onClick={() => setCancelOpen(false)}
                        >
                          Avbryt
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
                      {isRevenue ? "Återbetala eller avboka" : "Avboka ordern"}
                    </Button>
                  )}
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kund
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
                  Produkter
                </h3>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Produkt
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Antal
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          á-pris
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Summa
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
                            Inga rader registrerade på denna order.
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
                              {formatSek(l.unitPriceOre)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatSek(l.lineTotalOre)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delsumma</span>
                    <span className="tabular-nums">
                      {formatSek(subtotalOre)}
                    </span>
                  </div>
                  {detail.order.shippingOre > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Frakt</span>
                      <span className="tabular-nums">
                        {formatSek(detail.order.shippingOre)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Totalt</span>
                    <span className="tabular-nums">
                      {formatSek(detail.order.totalOre)}
                    </span>
                  </div>
                </div>
              </section>

              {detail.order.note && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Meddelande från kund
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
