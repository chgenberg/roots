"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  Package,
  CreditCard,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { downloadCustomerOrdersCsv } from "@/lib/orders-csv";
import type { TeamDashboard, CustomerOrder, Seller } from "@/types/fundraising";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

type FilterStatus = "ALL" | "PAID" | "PENDING" | "DRAFT" | "FAILED" | "CANCELLED";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PAID: "Betald",
    PENDING: "Väntar",
    CONFIRMED: "Bekräftad",
    SHIPPED: "Skickad",
    DELIVERED: "Levererad",
    CANCELLED: "Avbruten",
    REFUNDED: "Återbetald",
    DRAFT: "Utkast",
    FAILED: "Misslyckad",
  };
  return labels[status] || status;
}

function statusColor(status: string) {
  if (status === "PAID" || status === "CONFIRMED") return "bg-brand-100 text-brand-700";
  if (status === "SHIPPED" || status === "DELIVERED") return "bg-brand-100 text-brand-700";
  if (status === "FAILED" || status === "CANCELLED") return "bg-red-100 text-red-800";
  return "";
}

export default function TeamOrdersPage() {
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  // Sprint E12: date range + free-text search + CSV.
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const myTeamRes = await fetch(`${API_URL}/v1/dashboard/my-team`, {
          credentials: "include",
        });
        if (!myTeamRes.ok) {
          setError("Kunde inte hämta lagdata. Försök igen.");
          return;
        }
        const { teamId } = await myTeamRes.json();

        const teamRes = await fetch(
          `${API_URL}/v1/dashboard/team/${teamId}`,
          { credentials: "include" }
        );
        if (teamRes.ok) {
          setData(await teamRes.json());
        } else {
          setError("Kunde inte hämta lagdata. Försök igen.");
        }
      } catch {
        setError("Ett nätverksfel uppstod. Försök igen.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <ClipboardList className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Inget lag hittades
        </p>
      </div>
    );
  }

  const orders: CustomerOrder[] = data.orders || [];
  const sellers: Seller[] = data.sellers || [];
  const sellerMap = new Map(sellers.map((s: Seller) => [s.id, s.displayName]));

  const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
  // dateTo is inclusive — extend to end-of-day so an order at 23:59 still
  // matches when the user picks the same day in both pickers.
  const toTs = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
  const needle = search.trim().toLowerCase();

  const filteredOrders = orders.filter((o: CustomerOrder) => {
    if (filter !== "ALL" && o.status !== filter) return false;
    const ts = new Date(o.createdAt).getTime();
    if (fromTs !== null && ts < fromTs) return false;
    if (toTs !== null && ts > toTs) return false;
    if (needle) {
      const seller = sellerMap.get(o.sellerId ?? "") || "";
      const hay = `${o.customerName} ${o.customerEmail ?? ""} ${seller}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const paidTotal = orders
    .filter((o: CustomerOrder) => o.status === "PAID" || o.status === "CONFIRMED" || o.status === "SHIPPED" || o.status === "DELIVERED")
    .reduce((sum: number, o: CustomerOrder) => sum + (o.totalOre || 0), 0);

  const filterButtons: FilterStatus[] = ["ALL", "PAID", "PENDING", "CANCELLED"];

  function exportCsv() {
    if (filteredOrders.length === 0) return;
    downloadCustomerOrdersCsv(
      `bestallningar-${data?.team?.name || "lag"}`.toLowerCase().replace(/\s+/g, "-"),
      filteredOrders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        sellerName: sellerMap.get(o.sellerId ?? "") ?? null,
        status: statusLabel(o.status),
        paymentMethod: o.paymentMethod,
        deliveryType: o.deliveryType,
        totalOre: o.totalOre,
      }))
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Beställningar</h1>
        <p className="text-sm text-muted-foreground">
          Ordersammanställning för {data.team?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Totalt antal ordrar</p>
            <p className="mt-1 text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Betald summa</p>
            <p className="mt-1 text-2xl font-bold">
              {(paidTotal / 100).toLocaleString("sv-SE")} kr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Direktleveranser</p>
            <p className="mt-1 text-2xl font-bold">
              {orders.filter((o: CustomerOrder) => o.deliveryType === "DIRECT").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "ALL" ? "Alla" : statusLabel(f)}
              </Button>
            ))}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={exportCsv}
                disabled={filteredOrders.length === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Exportera CSV
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök kund, e-post eller säljare…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Från-datum"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Till-datum"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Ordrar ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {filter === "ALL"
                ? "Inga beställningar ännu"
                : `Inga ordrar med status "${statusLabel(filter)}"`}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order: CustomerOrder) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setDetailOrderId(order.id);
                    setDetailOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-brand-50/60"
                  aria-label={`Visa detaljer för order från ${order.customerName}`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      Säljare: {sellerMap.get(order.sellerId ?? "") || "Okänd"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${statusColor(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </Badge>
                      {order.paymentMethod === "DIRECT_TO_LEADER" && (
                        <Badge variant="secondary" className="text-xs bg-brand-50 text-brand-600">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Betala till ansvarig
                        </Badge>
                      )}
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          Direktleverans
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {(order.totalOre / 100).toLocaleString("sv-SE")} kr
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
      />
    </div>
  );
}
