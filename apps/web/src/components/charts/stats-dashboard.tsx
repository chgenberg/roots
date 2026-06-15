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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          Kunde inte hämta statistik just nu. Försök igen om en stund.
        </p>
      </div>
    );
  }

  const axis = buildDailyAxis(data.daily, data.periodStart, data.periodEnd);
  const trend = mode === "daily" ? axis.sales : axis.cumulative;
  const hasSales = data.totals.salesOre > 0;
  const payments = paymentSlices(data.payments);
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
        ? `${b.units ?? 0} sålda enheter`
        : `${b.orders ?? 0} ordrar`,
  }));

  const weekday = data.weekday.map((w) => ({
    label: w.label,
    value: w.salesOre,
  }));

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* KPI-rad */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total försäljning"
          value={formatKr(data.totals.salesOre)}
          icon={TrendingUp}
        />
        <StatCard
          label="Antal ordrar"
          value={data.totals.orders.toLocaleString("sv-SE")}
          icon={ShoppingCart}
        />
        <StatCard
          label="Snittorder"
          value={formatKr(data.totals.avgOrderOre)}
          icon={Receipt}
        />
        <StatCard
          label="Måluppfyllnad"
          value={goalPct !== null ? `${goalPct}%` : "—"}
          icon={Target}
          hint={
            data.goalOre > 0
              ? `Mål: ${formatKr(data.goalOre)}`
              : "Inget mål satt ännu"
          }
        />
      </div>

      {/* Trend (daglig / ackumulerat) */}
      <ChartCard
        title="Försäljning över tid"
        subtitle="Betalda ordrar inom perioden"
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
              Daglig
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
              Ackumulerat
            </button>
          </div>
        }
      >
        <AreaTrend
          points={trend}
          format={formatKr}
          reference={
            mode === "cumulative" && data.goalOre > 0
              ? { value: data.goalOre, label: `Mål ${formatKr(data.goalOre)}` }
              : null
          }
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mål-gauge */}
        <ChartCard
          title="Mot målet"
          subtitle="Andel av periodens mål"
          className="lg:col-span-1"
          empty={data.goalOre <= 0 && !hasSales}
          emptyLabel="Sätt ett mål för att se progress mot det."
        >
          <div className="flex justify-center pt-2">
            <GoalGauge
              currentOre={data.currentOre}
              goalOre={data.goalOre}
              format={formatKr}
            />
          </div>
        </ChartCard>

        {/* Betalmetoder */}
        <ChartCard
          title="Betalmetoder"
          subtitle="Fördelning av betald försäljning"
          className="lg:col-span-2"
          empty={payments.length === 0}
        >
          <Donut
            data={payments}
            centerLabel={formatKrShort(data.totals.salesOre)}
            centerSub="totalt"
            format={formatKr}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Topplista / fördelning */}
        <ChartCard
          title={breakdownTitle}
          subtitle="Betald försäljning inom perioden"
          empty={rankedItems.length === 0}
        >
          <RankedBars items={rankedItems} format={formatKr} />
        </ChartCard>

        {/* Veckodagar */}
        <ChartCard
          title="Bästa säljdagar"
          subtitle="Försäljning per veckodag"
          empty={!hasSales}
        >
          <BarSeries data={weekday} format={formatKrShort} color={CHART.primary} />
        </ChartCard>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          Senaste 90 dagarna
        </Badge>
        Endast betalda ordrar som räknas mot statistiken visas.
      </p>
    </div>
  );
}
