"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { LocaleLink } from "@/components/locale-link";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  Package,
  CreditCard,
  Search,
  Download,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { downloadCustomerOrdersCsv } from "@/lib/orders-csv";
import { countsAsRevenue } from "@roots/contracts";
import type { TeamDashboard, CustomerOrder, Seller } from "@/types/fundraising";

import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { formatKr, formatKrValue } from "@/lib/format";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-status";

const API_URL = getBrowserApiBase();

type FilterStatus = "ALL" | "PAID" | "PENDING" | "DRAFT" | "FAILED" | "CANCELLED";

function paymentMethodLabel(method: string, locale: "sv" | "en") {
  const labels = fundraisingPages.paymentMethod[locale];
  const m = method.toLowerCase();
  if (m.includes("swish")) return labels.swish;
  if (m.includes("card") || m.includes("kort")) return labels.card;
  if (m.includes("klarna") || m.includes("pay_later") || m.includes("invoice"))
    return labels.klarna;
  if (m === "cash" || m.includes("kontant")) return labels.cash;
  return method;
}

export default function TeamOrdersPage() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.teamOrders[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;

  const [data, setData] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  // Sprint E12: date range + free-text search + CSV.
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
        <ClipboardList className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {c.noTeamFound}
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

  // En manuell order som är betald men obekräftad hålls utanför lagets
  // utbetalning. Lagledaren behöver kunna hitta dem utan att öppna varje
  // order, annars ligger pengar och väntar utan att någon vet om det.
  const awaitingVerification = orders.filter(
    (o: CustomerOrder) =>
      o.isManual && countsAsRevenue(o.status) && !o.verifiedAt
  );
  const awaitingOre = awaitingVerification.reduce(
    (sum, o) => sum + (o.totalOre || 0),
    0
  );

  const filteredOrders = orders.filter((o: CustomerOrder) => {
    if (onlyUnverified) {
      if (!o.isManual || !countsAsRevenue(o.status) || o.verifiedAt) {
        return false;
      }
    }
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
    .filter((o: CustomerOrder) => countsAsRevenue(o.status))
    .reduce((sum: number, o: CustomerOrder) => sum + (o.totalOre || 0), 0);

  const filterButtons: FilterStatus[] = ["ALL", "PAID", "PENDING", "CANCELLED"];

  function exportCsv() {
    if (filteredOrders.length === 0) return;
    downloadCustomerOrdersCsv(
      `${locale === "en" ? "orders" : "bestallningar"}-${data?.team?.name || (locale === "en" ? "team" : "lag")}`.toLowerCase().replace(/\s+/g, "-"),
      filteredOrders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        sellerName: sellerMap.get(o.sellerId ?? "") ?? null,
        status: orderStatusLabel(o.status, locale),
        paymentMethod: o.paymentMethod,
        deliveryType: o.deliveryType,
        totalOre: o.totalOre,
      })),
      locale
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {tFill(t.subtitle, { team: data.team?.name ?? "" })}
        </p>
      </div>

      {awaitingVerification.length > 0 && (
        <Card className="border-warning-edge bg-warning-surface">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
              <div>
                <p className="text-sm font-semibold">
                  {awaitingVerification.length}{" "}
                  {awaitingVerification.length === 1
                    ? t.awaitingTitleOne
                    : t.awaitingTitleMany}{" "}
                  {t.awaitingSuffix}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tFill(t.awaitingBody, {
                    amount: formatKr(awaitingOre, locale),
                  })}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={onlyUnverified ? "default" : "outline"}
              onClick={() => setOnlyUnverified((v) => !v)}
            >
              {onlyUnverified ? t.showAll : t.showThem}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.totalOrderCount}</p>
            <p className="mt-1 text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.paidSum}</p>
            <p className="mt-1 text-2xl font-bold">
              {formatKr(paidTotal, locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.directDeliveries}</p>
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
                {f === "ALL" ? c.all : orderStatusLabel(f, locale)}
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
                {c.exportCsv}
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={c.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label={c.dateFrom}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label={c.dateTo}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {tFill(t.ordersHeading, { n: filteredOrders.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {filter === "ALL"
                ? c.noOrdersYet
                : tFill(t.emptyFiltered, {
                    status: orderStatusLabel(filter, locale),
                  })}
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
                  aria-label={tFill(c.viewOrderDetails, { name: order.customerName })}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {tFill(t.sellerLabel, { name: sellerMap.get(order.sellerId ?? "") || c.unknown })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${orderStatusColor(order.status)}`}
                      >
                        {orderStatusLabel(order.status, locale)}
                      </Badge>
                      {order.paymentMethod === "DIRECT_TO_LEADER" && (
                        <Badge variant="secondary" className="text-xs bg-brand-50 text-brand-600">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {c.payToLeader}
                        </Badge>
                      )}
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {c.directDelivery}
                        </Badge>
                      )}
                      {order.selectedPaymentMethod && (
                        <Badge variant="secondary" className="text-xs bg-brand-50 text-brand-600">
                          {paymentMethodLabel(
                            order.selectedPaymentMethod,
                            locale
                          )}
                        </Badge>
                      )}
                      {order.isManual &&
                        (countsAsRevenue(order.status) && !order.verifiedAt ? (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-warning-surface text-warning-strong"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {c.awaitingConfirmation}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-warning-surface/60 text-warning-strong"
                          >
                            {c.manual}
                          </Badge>
                        ))}
                      {order.countsTowardStats === false && (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                          {c.outsidePeriod}
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
        onVerificationChange={(id, verified) => {
          // Uppdatera raden direkt så banderollen och badgen stämmer medan
          // dialogen fortfarande är öppen. Vi hämtar inte om allt — svaret
          // säger redan vad som gäller.
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  orders: prev.orders.map((o) =>
                    o.id === id
                      ? {
                          ...o,
                          verifiedAt: verified ? new Date().toISOString() : null,
                        }
                      : o
                  ),
                }
              : prev
          );
        }}
        // Statusbytet påverkar både raden och summan som väntar på
        // bekräftelse, så här hämtas underlaget om.
        onStatusChange={() => void load()}
      />
    </div>
  );
}
