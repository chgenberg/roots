"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { portalFetch } from "@/lib/portal-api";
import { publicProductHref } from "@/lib/portal-products";

/* Fallback data is illustrative only. When the API reports no real data we
 * render the dataset with empty-state copy instead of presenting demo numbers
 * as live. */

const FALLBACK_MONTHLY_DATA: Array<{ month: string; orders: number; revenue: number }> = [];

const FALLBACK_KPI_CARDS: Array<{
  label: string;
  value: string;
  change: string | null;
  positive: boolean;
  icon: typeof TrendingUp;
}> = [
  {
    label: "Total omsättning",
    value: "—",
    change: null,
    positive: true,
    icon: TrendingUp,
  },
  {
    label: "Genomsnittligt ordervärde",
    value: "—",
    change: null,
    positive: true,
    icon: ShoppingCart,
  },
  {
    label: "Nya medlemmar",
    value: "—",
    change: null,
    positive: true,
    icon: Users,
  },
  {
    label: "Churn rate",
    value: "—",
    change: null,
    positive: true,
    icon: TrendingDown,
  },
];

const FALLBACK_TOP_PRODUCTS: Array<{
  name: string;
  slug: string;
  sold: number;
  revenue: string;
  share: number;
}> = [];

export default function StatistikPage() {
  const [monthlyData, setMonthlyData] = useState<
    Array<{ month: string; orders: number; revenue: number }>
  >(FALLBACK_MONTHLY_DATA);
  const [kpiCards] = useState(FALLBACK_KPI_CARDS);
  const [topProducts] = useState(FALLBACK_TOP_PRODUCTS);

  useEffect(() => {
    portalFetch<{
      monthlyData?: Array<{
        month: string;
        orders?: number;
        revenueOre?: number;
      }>;
    }>("/statistics")
      .then((data) => {
        if (data.monthlyData?.length) {
          setMonthlyData(
            data.monthlyData.map((d) => ({
              month: d.month ?? "",
              orders: Number(d.orders ?? 0),
              revenue: Math.round(Number(d.revenueOre ?? 0) / 100),
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const maxRevenue = Math.max(1, ...monthlyData.map((d) => d.revenue));
  const hasData = monthlyData.length > 0;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistik</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Följ försäljning och intäkter i realtid.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-brand-400" />
              </div>
              <p className="mt-2 text-2xl font-bold">{k.value}</p>
              {k.change && (
                <div className="mt-1 flex items-center gap-1">
                  <Badge
                    variant={k.positive ? "success" : "destructive"}
                    className="text-[10px]"
                  >
                    {k.change}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    vs förra månaden
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart visualization */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Omsättning per månad</h2>
              <Badge variant="outline" className="text-xs">
                Senaste 6 mån
              </Badge>
            </div>
            {hasData ? (
              <>
                <div
                  className="mt-6 flex items-end gap-3"
                  style={{ height: 200 }}
                >
                  {monthlyData.map((d) => {
                    const h = Math.round((d.revenue / maxRevenue) * 100);
                    return (
                      <div
                        key={d.month}
                        className="flex flex-1 flex-col items-center gap-2"
                      >
                        <span className="text-xs font-medium">
                          {(d.revenue / 1000).toFixed(1)}k
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-inverse-surface transition-all hover:bg-inverse-surface-hover"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {d.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Separator className="my-4" />
              </>
            ) : (
              <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Ingen omsättningshistorik ännu. Diagrammet fylls i automatiskt
                när ni får era första betalda ordrar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Toppprodukter</h2>
            {topProducts.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Listan fylls på när ni har fått ordrar.
              </p>
            )}
            <div className="mt-4 space-y-4">
              {topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={publicProductHref(p.slug)}
                      className="min-w-0 text-sm font-medium hover:text-brand-800 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-sm font-semibold">{p.revenue}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-brand-100">
                      <div
                        className="h-2 rounded-full bg-inverse-surface transition-all"
                        style={{ width: `${p.share}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.share}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.sold} sålda enheter
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders chart */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">Beställningar per månad</h2>
          {hasData ? (
            <div
              className="mt-6 flex items-end gap-3"
              style={{ height: 120 }}
            >
              {monthlyData.map((d) => {
                const maxOrders = Math.max(
                  1,
                  ...monthlyData.map((x) => x.orders)
                );
                const h = Math.round((d.orders / maxOrders) * 100);
                return (
                  <div
                    key={d.month}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-xs font-medium">{d.orders}</span>
                    <div
                      className="w-full rounded-t-lg bg-brand-400 transition-all hover:bg-brand-300"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {d.month}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inga ordrar registrerade ännu.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
