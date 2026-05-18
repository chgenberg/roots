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
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Package,
  FileText,
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";

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

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-success/15 text-success border-success/40",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
  CONFIRMED: "bg-success/15 text-success border-success/40",
  SHIPPED: "bg-success/15 text-success border-success/40",
  DELIVERED: "bg-success/15 text-success border-success/40",
  REFUNDED: "bg-muted text-muted-foreground border-border",
  FAILED: "bg-destructive/10 text-destructive border-destructive/30",
  DRAFT: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABELS: Record<string, string> = {
  PAID: "Betald",
  PENDING: "Avvaktar",
  CANCELLED: "Avbruten",
  CONFIRMED: "Bekräftad",
  SHIPPED: "Skickad",
  DELIVERED: "Levererad",
  REFUNDED: "Återbetald",
  FAILED: "Misslyckad",
  DRAFT: "Utkast",
};
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
}

export function OrderDetailDialog({ open, onOpenChange, orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
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

  const hasShipping =
    detail &&
    (detail.order.shipping.line1 ||
      detail.order.shipping.city ||
      detail.order.shipping.postalCode);
  const subtotalOre = detail
    ? detail.lines.reduce((sum, l) => sum + l.lineTotalOre, 0)
    : 0;
  const statusClass = detail
    ? STATUS_COLORS[detail.order.status] ||
      "bg-muted text-muted-foreground border-border"
    : "";

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
                  {STATUS_LABELS[detail.order.status] || detail.order.status}
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
              </div>

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
