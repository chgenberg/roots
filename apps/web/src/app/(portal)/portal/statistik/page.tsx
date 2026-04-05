"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { portalFetch } from "@/lib/portal-api";

const FALLBACK_MONTHLY_DATA = [
  { month: "Okt", orders: 8, revenue: 4200 },
  { month: "Nov", orders: 12, revenue: 6800 },
  { month: "Dec", orders: 15, revenue: 8900 },
  { month: "Jan", orders: 18, revenue: 10200 },
  { month: "Feb", orders: 22, revenue: 13500 },
  { month: "Mar", orders: 27, revenue: 16800 },
];

const FALLBACK_KPI_CARDS = [
  {
    label: "Total omsättning",
    value: "60 400 kr",
    change: "+24%",
    positive: true,
    icon: TrendingUp,
  },
  {
    label: "Genomsnittligt ordervärde",
    value: "1 280 kr",
    change: "+8%",
    positive: true,
    icon: ShoppingCart,
  },
  {
    label: "Nya medlemmar",
    value: "47",
    change: "+32%",
    positive: true,
    icon: Users,
  },
  {
    label: "Churn rate",
    value: "2.1%",
    change: "-0.5%",
    positive: true,
    icon: TrendingDown,
  },
];

const FALLBACK_TOP_PRODUCTS = [
  { name: "First Growth (Schampo)", sold: 156, revenue: "23 244 kr", share: 38 },
  { name: "Pure Root (Balsam)", sold: 142, revenue: "21 158 kr", share: 35 },
  { name: "Soft Rinse (Body Wash)", sold: 124, revenue: "15 996 kr", share: 27 },
];

export default function StatistikPage() {
  const [monthlyData, setMonthlyData] = useState(FALLBACK_MONTHLY_DATA);
  const [kpiCards] = useState(FALLBACK_KPI_CARDS);
  const [topProducts] = useState(FALLBACK_TOP_PRODUCTS);

  useEffect(() => {
    portalFetch<{ monthlyData: any[] }>("/statistics")
      .then((data) => {
        if (data.monthlyData?.length) {
          setMonthlyData(
            data.monthlyData.map((d) => ({
              month: d.month ?? "",
              orders: d.orders ?? 0,
              revenue: d.revenue ?? 0,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue));

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
              <div className="mt-1 flex items-center gap-1">
                <Badge
                  variant={k.positive ? "success" : "destructive"}
                  className="text-[10px]"
                >
                  {k.change}
                </Badge>
                <span className="text-xs text-muted-foreground">vs förra månaden</span>
              </div>
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
            <div className="mt-6 flex items-end gap-3" style={{ height: 200 }}>
              {monthlyData.map((d) => {
                const h = Math.round((d.revenue / maxRevenue) * 100);
                return (
                  <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium">
                      {(d.revenue / 1000).toFixed(1)}k
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-brand-900 transition-all hover:bg-brand-800"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{d.month}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center gap-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-brand-400" />
              <span className="font-medium">+24% tillväxt</span>
              <span className="text-muted-foreground">
                jämfört med samma period föregående halvår
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Toppprodukter</h2>
            <div className="mt-4 space-y-4">
              {topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-sm font-semibold">{p.revenue}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-brand-100">
                      <div
                        className="h-2 rounded-full bg-brand-900 transition-all"
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
          <div className="mt-6 flex items-end gap-3" style={{ height: 120 }}>
            {monthlyData.map((d) => {
              const maxOrders = Math.max(...monthlyData.map((x) => x.orders));
              const h = Math.round((d.orders / maxOrders) * 100);
              return (
                <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium">{d.orders}</span>
                  <div
                    className="w-full rounded-t-lg bg-brand-400 transition-all hover:bg-brand-300"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.month}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
