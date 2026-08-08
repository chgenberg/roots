"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { LocaleLink } from "@/components/locale-link";

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
import { rootsFetch } from "@/lib/api";
import { formatKr, formatKrValue } from "@/lib/format";

const API_URL = getBrowserApiBase();

export default function TeamSettlementPage() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.teamSettlement[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;

  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const myTeamRes = await rootsFetch(`${API_URL}/v1/dashboard/my-team`);
      if (!myTeamRes.ok) {
        setError(t.loadFailed);
        return;
      }
      const { teamId } = await myTeamRes.json();

      const teamRes = await rootsFetch(`${API_URL}/v1/dashboard/team/${teamId}`);
      if (teamRes.ok) {
        setData(await teamRes.json());
        setError(null);
      } else {
        setError(t.loadFailed);
      }
    } catch {
      setError(c.networkError);
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
        <p className="text-sm text-muted-foreground">{c.noTeamFound}</p>
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
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {tFill(t.subtitle, { team: data.team?.name ?? "" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{c.totalSales}</p>
            <p className="mt-1 text-2xl font-bold">
              {formatKr(totalSales, locale)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-sm text-muted-foreground">{t.teamEarnings}</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {formatKr(teamEarnings, locale)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tFill(c.ofSales, { n: marginPercent })}
            </p>
            {unverifiedEarningsOre > 0 && (
              <p className="mt-1.5 text-xs text-warning-strong">
                {tFill(t.unverifiedHint, {
                  amount: formatKr(unverifiedEarningsOre, locale),
                  count: unverifiedCount,
                  orderWord:
                    unverifiedCount === 1
                      ? t.manualOrderOne
                      : t.manualOrderMany,
                })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.rootsShare}</p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatKr(rootsShare, locale)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tFill(c.ofSales, { n: 100 - marginPercent })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.paidOrders}</p>
            <p className="mt-1 text-2xl font-bold">{paidOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-sm font-medium">{t.paidViaKlarna}</p>
            </div>
            <p className="text-xl font-bold">
              {formatKr(klarnaPaidTotal, locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tFill(t.klarnaHint, { n: klarnaOrders.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-sm font-medium">{t.payToLeader}</p>
            </div>
            <p className="text-xl font-bold">
              {formatKr(directPaidTotal, locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tFill(t.directHint, { n: directOrders.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">{t.directDeliveries}</p>
            </div>
            <p className="text-xl font-bold">{directDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">
              {t.directDeliveriesHint}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.paymentPerCustomer}</CardTitle>
        </CardHeader>
        <CardContent>
          {paidOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t.noPaidOrders}
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
                  aria-label={tFill(c.viewOrderDetails, { name: order.customerName })}
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
                          ? c.paidToRoots
                          : c.collectByLeader}
                      </Badge>
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          {c.directDelivery}
                        </Badge>
                      )}
                      {order.isManual && !order.verifiedAt && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-warning-surface text-warning-strong"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {c.awaitingConfirmation}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatKr(order.totalOre, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString(dateLocale)}
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
