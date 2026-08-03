"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Loader2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Clock,
} from "lucide-react";
import { countsAsRevenue } from "@roots/contracts";
import type { TeamDashboard, CustomerOrder } from "@/types/fundraising";
import { OrderDetailDialog } from "@/components/order-detail-dialog";

import { getBrowserApiBase } from "@/lib/api-base";
import { formatKrValue } from "@/lib/format";

const API_URL = getBrowserApiBase();

export default function TeamSettlementPage() {
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const myTeamRes = await fetch(`${API_URL}/v1/dashboard/my-team`, {
        credentials: "include",
      });
      if (!myTeamRes.ok) {
        setError("Kunde inte hämta lagdata.");
        return;
      }
      const { teamId } = await myTeamRes.json();

      const teamRes = await fetch(`${API_URL}/v1/dashboard/team/${teamId}`, {
        credentials: "include",
      });
      if (teamRes.ok) {
        setData(await teamRes.json());
        setError(null);
      } else {
        setError("Kunde inte hämta lagdata.");
      }
    } catch {
      setError("Ett nätverksfel uppstod.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error) {
    return <LoadError message={error} onRetry={load} />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <CreditCard className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Inget lag hittades</p>
      </div>
    );
  }

  const orders: CustomerOrder[] = data.orders || [];
  const marginPercent = data.stats?.marginPercent || 0;
  const totalSales = data.stats?.totalSalesOre || 0;
  const teamEarnings = data.stats?.teamEarningsOre || 0;
  const rootsShare = totalSales - teamEarnings;

  // Samma definition som avräkningen på servern använder, så vyn och
  // utbetalningen aldrig kan visa olika uppfattning om vad som är betalt.
  const paidOrders = orders.filter((o: CustomerOrder) =>
    countsAsRevenue(o.status)
  );

  const klarnaOrders = paidOrders.filter(
    (o: CustomerOrder) => o.paymentMethod === "KLARNA"
  );
  const directOrders = paidOrders.filter(
    (o: CustomerOrder) => o.paymentMethod === "DIRECT_TO_LEADER"
  );
  const directDeliveries = paidOrders.filter(
    (o: CustomerOrder) => o.deliveryType === "DIRECT"
  );

  const klarnaPaidTotal = klarnaOrders.reduce(
    (sum: number, o: CustomerOrder) => sum + (o.totalOre || 0),
    0
  );
  const directPaidTotal = directOrders.reduce(
    (sum: number, o: CustomerOrder) => sum + (o.totalOre || 0),
    0
  );

  // Siffrorna ovan bygger på all betald försäljning, men avräkningen som
  // faktiskt genereras utesluter obekräftade manuella ordrar. Utan den här
  // upplysningen ser lagledaren en förtjänst som är högre än utbetalningen
  // och har inget sätt att förstå varför.
  const unverifiedOre = data.stats?.unverifiedManualOre ?? 0;
  const unverifiedCount = data.stats?.unverifiedManualCount ?? 0;
  const unverifiedEarningsOre = Math.round(
    unverifiedOre * (marginPercent / 100)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avräkning</h1>
        <p className="text-sm text-muted-foreground">
          Intjänat och betalstatus för {data.team?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total försäljning</p>
            <p className="mt-1 text-2xl font-bold">
              {formatKrValue(totalSales)} kr
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-sm text-muted-foreground">Lagets förtjänst</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {formatKrValue(teamEarnings)} kr
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {marginPercent}% av försäljningen
            </p>
            {unverifiedEarningsOre > 0 && (
              <p className="mt-1.5 text-xs text-warning-strong">
                Varav {formatKrValue(unverifiedEarningsOre)} kr väntar på att du
                bekräftar {unverifiedCount}{" "}
                {unverifiedCount === 1 ? "manuell order" : "manuella ordrar"}.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Roots-andel</p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatKrValue(rootsShare)} kr
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {100 - marginPercent}% av försäljningen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Betalda ordrar</p>
            <p className="mt-1 text-2xl font-bold">{paidOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-sm font-medium">Betalt via Klarna</p>
            </div>
            <p className="text-xl font-bold">
              {formatKrValue(klarnaPaidTotal)} kr
            </p>
            <p className="text-xs text-muted-foreground">
              {klarnaOrders.length} ordrar — betalat direkt till Roots
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-sm font-medium">Betala till ansvarig</p>
            </div>
            <p className="text-xl font-bold">
              {formatKrValue(directPaidTotal)} kr
            </p>
            <p className="text-xs text-muted-foreground">
              {directOrders.length} ordrar — ska samlas in
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">Direktleveranser</p>
            </div>
            <p className="text-xl font-bold">{directDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">
              Skickas direkt hem till kund
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Betalstatus per kund</CardTitle>
        </CardHeader>
        <CardContent>
          {paidOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga betalda ordrar ännu
            </p>
          ) : (
            <div className="space-y-2">
              {paidOrders.map((order: CustomerOrder) => (
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
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          order.paymentMethod === "KLARNA"
                            ? "bg-brand-100 text-brand-700"
                            : "bg-brand-50 text-brand-600"
                        }`}
                      >
                        {order.paymentMethod === "KLARNA"
                          ? "Betalt till Roots"
                          : "Samlas in av ansvarig"}
                      </Badge>
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          Direktleverans
                        </Badge>
                      )}
                      {order.isManual && !order.verifiedAt && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-warning-surface text-warning-strong"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Väntar på bekräftelse
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatKrValue(order.totalOre)} kr
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
        // Här räknas förtjänsten om på servern, så en lokal justering
        // räcker inte — vi hämtar om hela underlaget.
        onVerificationChange={() => void load()}
        onStatusChange={() => void load()}
      />
    </div>
  );
}
