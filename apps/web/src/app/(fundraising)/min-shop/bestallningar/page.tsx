"use client";

/**
 * Seller order history — Sprint E10.
 *
 * /min-shop already shows a "Senaste beställningar" card with the 5–10
 * most recent. This page is the full archive with status + date-range
 * filters and CSV export so a seller can audit themselves.
 *
 * Data source: GET /v1/dashboard/seller (the existing seller dashboard
 * endpoint already returns ALL orders for the logged-in seller — see
 * apps/api/src/routes/dashboard.ts → orders array).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  Loader2,
  ArrowLeft,
  Download,
  Filter,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Package,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { SellerDashboard as SellerDashboardData } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-success/15 text-success border-success/40",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Betald",
  PENDING: "Avvaktar",
  CANCELLED: "Avbruten",
};

type SellerOrder = SellerDashboardData["orders"][number];

interface OrderDetail {
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
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

export default function SellerOrdersPage() {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state — kept local so a URL refresh doesn't drag stale
  // filters with it. Date inputs use ISO YYYY-MM-DD which sorts
  // lexically, so we can compare strings directly.
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const { toast } = useToast();

  // Order-detail dialog state. We fetch detail lazily on row-click so
  // the list endpoint can stay light — most sellers only ever drill
  // into a handful of orders, not every row.
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  async function openOrderDetail(orderId: string) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/v1/dashboard/seller/orders/${orderId}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDetailError(
          (j as { error?: string })?.error ?? "Kunde inte hämta order."
        );
        return;
      }
      const json = (await res.json()) as OrderDetail;
      setDetail(json);
    } catch {
      setDetailError("Nätverksfel. Försök igen.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/dashboard/seller`, {
          credentials: "include",
        });
        if (res.ok) {
          setData(await res.json());
        } else {
          setError("Kunde inte hämta dina beställningar.");
        }
      } catch {
        setError("Nätverksfel. Försök igen.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const orders = data?.orders ?? [];

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (fromDate) {
        const day = o.createdAt.slice(0, 10);
        if (day < fromDate) return false;
      }
      if (toDate) {
        const day = o.createdAt.slice(0, 10);
        if (day > toDate) return false;
      }
      return true;
    });
  }, [orders, statusFilter, fromDate, toDate]);

  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [filtered]
  );

  const totalOre = sortedFiltered
    .filter((o) => o.status === "PAID")
    .reduce((acc, o) => acc + o.totalOre, 0);
  const orderCount = sortedFiltered.length;

  function exportCsv() {
    if (sortedFiltered.length === 0) {
      toast("Inga rader att exportera.", "error");
      return;
    }
    const header = "datum;kund;status;belopp_kr\n";
    const rows = sortedFiltered
      .map((o: SellerOrder) => {
        const day = o.createdAt.slice(0, 10);
        const safeName = (o.customerName || "Okänd").replace(/[;"\n\r]/g, " ");
        const kr = (o.totalOre / 100).toFixed(2).replace(".", ",");
        return `${day};${safeName};${o.status};${kr}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mina-bestallningar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Försök igen
        </Button>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/min-shop"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tillbaka till min shop
          </Link>
          <h1 className="text-2xl font-bold">Mina beställningar</h1>
          <p className="text-sm text-muted-foreground">
            Fullständig historik över alla dina kundbeställningar
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exportera CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Visade beställningar</p>
            <p className="mt-1 text-2xl font-bold">{orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Belopp (betalda i urvalet)
            </p>
            <p className="mt-1 text-2xl font-bold">{formatSek(totalOre)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-brand-500" />
            Filter
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="statusFilter">Status</Label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Alla statusar</option>
                <option value="PAID">Betald</option>
                <option value="PENDING">Avvaktar</option>
                <option value="CANCELLED">Avbruten</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fromDate">Från datum</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="toDate">Till datum</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          {(statusFilter !== "ALL" || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setStatusFilter("ALL");
                setFromDate("");
                setToDate("");
              }}
            >
              Rensa filter
            </Button>
          )}
        </CardContent>
      </Card>

      {sortedFiltered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {orders.length === 0
                ? "Du har inga beställningar ännu. Dela din shop för att komma igång!"
                : "Inga beställningar matchar valda filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {sortedFiltered.map((o) => {
                const statusClass =
                  STATUS_COLORS[o.status] ||
                  "bg-muted text-muted-foreground border-border";
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => openOrderDetail(o.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-brand-50/50 focus-visible:outline-none focus-visible:bg-brand-50"
                    aria-label={`Visa detaljer för order från ${o.customerName || "okänd kund"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {o.customerName || "Okänd kund"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wide ${statusClass}`}
                    >
                      {STATUS_LABELS[o.status] || o.status}
                    </Badge>
                    <p className="text-sm font-semibold whitespace-nowrap">
                      {formatSek(o.totalOre)}
                    </p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) {
            // Drop the cached body so the next open shows a fresh
            // loading state instead of stale data flashing in.
            setDetail(null);
            setDetailError(null);
          }
        }}
        loading={detailLoading}
        error={detailError}
        detail={detail}
      />
    </div>
  );
}

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  detail: OrderDetail | null;
}

function OrderDetailDialog({
  open,
  onOpenChange,
  loading,
  error,
  detail,
}: OrderDetailDialogProps) {
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
