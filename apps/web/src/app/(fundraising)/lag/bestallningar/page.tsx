"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  Package,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const filteredOrders =
    filter === "ALL" ? orders : orders.filter((o: CustomerOrder) => o.status === filter);

  const paidTotal = orders
    .filter((o: CustomerOrder) => o.status === "PAID" || o.status === "CONFIRMED" || o.status === "SHIPPED" || o.status === "DELIVERED")
    .reduce((sum: number, o: CustomerOrder) => sum + (o.totalOre || 0), 0);

  const filterButtons: FilterStatus[] = ["ALL", "PAID", "PENDING", "CANCELLED"];

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

      <div className="flex flex-wrap gap-2">
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
      </div>

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
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border p-3"
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
