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
  ShoppingBag,
  Loader2,
  ArrowLeft,
  Download,
  Filter,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { SellerDashboard as SellerDashboardData } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";
import { OrderDetailDialog } from "@/components/order-detail-dialog";

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

  // Order-detail dialog: the shared component owns the fetch — we
  // just track which order to look at.
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  function openOrderDetail(orderId: string) {
    setDetailOrderId(orderId);
    setDetailOpen(true);
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
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
      />
    </div>
  );
}
