"use client";

import { useState } from "react";
import { TrendingUp, ShoppingCart, Receipt, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./chart-card";
import { AreaTrend } from "./area-trend";
import { BarSeries } from "./bar-series";
import { Donut } from "./donut";
import { RankedBars } from "./ranked-bars";
import { GoalGauge } from "./goal-gauge";
import { StatCard } from "./stat-card";
import {
  useStats,
  buildDailyAxis,
  paymentSlices,
} from "./use-stats";
import { formatKr, formatKrShort, CHART } from "./theme";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

interface StatsDashboardProps {
  path: string;
  title: string;
  subtitle?: string;
  /** Rubrik för topplista/fördelning (t.ex. "Topplista — lag"). */
  breakdownTitle: string;
  /** Enhets-suffix för breakdown-sub (orders/units). */
  breakdownUnit?: "orders" | "units";
}

export function StatsDashboard({
  path,
  title,
  subtitle,
  breakdownTitle,
  breakdownUnit = "orders",
}: StatsDashboardProps) {
  const { locale } = useLocale();
  const t = fundraisingPages.stats[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const { data, loading, error } = useStats(path);
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");

  if (loading) {
    return (
      <div className="page-enter space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-enter space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.loadFailed}
        </p>
      </div>
    );
  }

  const axis = buildDailyAxis(data.daily, data.periodStart, data.periodEnd);
  const trend = mode === "daily" ? axis.sales : axis.cumulative;
  const hasSales = data.totals.salesOre > 0;
  const payments = paymentSlices(data.payments, locale);
  const goalPct =
    data.goalOre > 0
      ? Math.round((data.currentOre / data.goalOre) * 100)
      : null;

  const rankedItems = data.breakdown.slice(0, 8).map((b) => ({
    id: b.id,
    name: b.name,
    value: b.salesOre,
    sub:
      breakdownUnit === "units"
        ? tFill(t.unitsSold, { n: b.units ?? 0 })
        : tFill(t.ordersCount, { n: b.orders ?? 0 }),
  }));

  const weekdayLabels = [
    t.weekdayMon,
    t.weekdayTue,
    t.weekdayWed,
    t.weekdayThu,
    t.weekdayFri,
    t.weekdaySat,
    t.weekdaySun,
  ];
  const weekday = data.weekday.map((w, i) => ({
    label: weekdayLabels[i] ?? w.label,
    value: w.salesOre,
  }));

  const formatMoney = (ore: number) => formatKr(ore, locale);

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t.totalSales}
          value={formatMoney(data.totals.salesOre)}
          icon={TrendingUp}
        />
        <StatCard
          label={t.orderCount}
          value={data.totals.orders.toLocaleString(dateLocale)}
          icon={ShoppingCart}
        />
        <StatCard
          label={t.avgOrder}
          value={formatMoney(data.totals.avgOrderOre)}
          icon={Receipt}
        />
        <StatCard
          label={t.goalProgress}
          value={goalPct !== null ? `${goalPct}%` : "—"}
          icon={Target}
          hint={
            data.goalOre > 0
              ? tFill(t.goalLabel, { amount: formatMoney(data.goalOre) })
              : t.noGoalYet
          }
        />
      </div>

      <ChartCard
        title={t.salesOverTime}
        subtitle={t.paidOrdersInPeriod}
        empty={!hasSales}
        right={
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("daily")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                mode === "daily"
                  ? "bg-brand-100 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.daily}
            </button>
            <button
              type="button"
              onClick={() => setMode("cumulative")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                mode === "cumulative"
                  ? "bg-brand-100 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.cumulative}
            </button>
          </div>
        }
      >
        <AreaTrend
          points={trend}
          format={formatMoney}
          reference={
            mode === "cumulative" && data.goalOre > 0
              ? {
                  value: data.goalOre,
                  label: tFill(t.goalRef, {
                    amount: formatMoney(data.goalOre),
                  }),
                }
              : null
          }
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title={t.towardsGoal}
          subtitle={t.goalShare}
          className="lg:col-span-1"
          empty={data.goalOre <= 0 && !hasSales}
          emptyLabel={t.setGoalHint}
        >
          <div className="flex justify-center pt-2">
            <GoalGauge
              currentOre={data.currentOre}
              goalOre={data.goalOre}
              format={formatMoney}
            />
          </div>
        </ChartCard>

        <ChartCard
          title={t.paymentMethods}
          subtitle={t.paymentSplit}
          className="lg:col-span-2"
          empty={payments.length === 0}
        >
          <Donut
            data={payments}
            centerLabel={formatKrShort(data.totals.salesOre)}
            centerSub={t.total}
            format={formatMoney}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={breakdownTitle}
          subtitle={t.paidSalesInPeriod}
          empty={rankedItems.length === 0}
        >
          <RankedBars items={rankedItems} format={formatMoney} />
        </ChartCard>

        <ChartCard
          title={t.bestDays}
          subtitle={t.salesByWeekday}
          empty={!hasSales}
        >
          <BarSeries data={weekday} format={formatKrShort} color={CHART.primary} />
        </ChartCard>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          {t.last90}
        </Badge>
        {t.paidOnlyNote}
      </p>
    </div>
  );
}
