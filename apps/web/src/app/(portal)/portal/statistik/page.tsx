"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
} from "lucide-react";
import { useState, useEffect, useMemo, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portal-api";
import { publicProductHref } from "@/lib/product-catalog";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { usePortalUser } from "@/lib/portal-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

type MonthlyBucket = { month: string; orders: number; revenue: number };
type KpiCard = {
  label: string;
  value: string;
  changePercent: number | null;
  icon: ComponentType<{ className?: string }>;
};
type TopProduct = {
  productId: string;
  name: string;
  slug: string;
  soldUnits: number;
  revenue: string;
  sharePercent: number;
};

export default function StatistikPage() {
  const { locale, href } = useLocale();
  const router = useRouter();
  const user = usePortalUser();
  const t = portalPages.statistik[locale];
  const isSalesRep = user.role === "SALES_REP";

  const kpiTemplate = useMemo(
    (): KpiCard[] => [
      {
        label: t.kpiRevenue,
        value: "—",
        changePercent: null,
        icon: TrendingUp,
      },
      {
        label: t.kpiAov,
        value: "—",
        changePercent: null,
        icon: ShoppingCart,
      },
      {
        label: t.kpiNewMembers,
        value: "—",
        changePercent: null,
        icon: Users,
      },
      {
        label: t.kpiActiveMembers,
        value: "—",
        changePercent: null,
        icon: TrendingDown,
      },
    ],
    [t]
  );

  const [monthlyData, setMonthlyData] = useState<MonthlyBucket[]>([]);
  const [kpiCards, setKpiCards] = useState<KpiCard[]>(kpiTemplate);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setKpiCards(kpiTemplate);
  }, [kpiTemplate]);

  useEffect(() => {
    if (isSalesRep) {
      router.replace(href("/portal/pipeline"));
    }
  }, [isSalesRep, router, href]);

  useEffect(() => {
    if (isSalesRep) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    portalFetch<{
      monthlyData?: Array<{
        month: string;
        orders?: number;
        revenueOre?: number;
      }>;
      kpis?: {
        totalRevenue?: string;
        avgOrderValue?: string;
        newMembersThisPeriod?: number;
        activeMembersThisPeriod?: number;
        prevPeriodRevenuePercent?: number | null;
        prevPeriodOrdersPercent?: number | null;
        prevPeriodMembersPercent?: number | null;
      };
      topProducts?: Array<{
        productId: string;
        name: string;
        slug: string;
        soldUnits: number;
        revenue: string;
        sharePercent: number;
      }>;
    }>("/statistics")
      .then((data) => {
        if (cancelled) return;
        if (data.monthlyData?.length) {
          setMonthlyData(
            data.monthlyData.map((d) => ({
              month: d.month ?? "",
              orders: Number(d.orders ?? 0),
              revenue: Math.round(Number(d.revenueOre ?? 0) / 100),
            }))
          );
        }
        if (data.kpis) {
          const k = data.kpis;
          setKpiCards([
            {
              label: t.kpiRevenue,
              value: k.totalRevenue ?? "—",
              changePercent: k.prevPeriodRevenuePercent ?? null,
              icon: TrendingUp,
            },
            {
              label: t.kpiAov,
              value: k.avgOrderValue ?? "—",
              changePercent: k.prevPeriodOrdersPercent ?? null,
              icon: ShoppingCart,
            },
            {
              label: t.kpiNewMembers,
              value: String(k.newMembersThisPeriod ?? 0),
              changePercent: k.prevPeriodMembersPercent ?? null,
              icon: Users,
            },
            {
              label: t.kpiActiveMembers,
              value: String(k.activeMembersThisPeriod ?? 0),
              changePercent: null,
              icon: TrendingDown,
            },
          ]);
        }
        if (data.topProducts?.length) {
          setTopProducts(data.topProducts);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t, isSalesRep]);

  const maxRevenue = Math.max(1, ...monthlyData.map((d) => d.revenue));
  const hasData = monthlyData.length > 0;

  if (isSalesRep) {
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {loadFailed && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">{t.loadFailTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.loadFailBody}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => {
          const positive = (k.changePercent ?? 0) >= 0;
          const formatted =
            k.changePercent === null
              ? null
              : `${positive ? "+" : ""}${k.changePercent.toFixed(1)} %`;
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{k.label}</span>
                  <k.icon className="h-4 w-4 text-brand-400" />
                </div>
                <p className="mt-2 text-2xl font-bold">{k.value}</p>
                {formatted && (
                  <div className="mt-1 flex items-center gap-1">
                    <Badge
                      variant={positive ? "success" : "destructive"}
                      className="text-[10px]"
                    >
                      {formatted}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.vsPrev}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t.revenuePerMonth}</h2>
              <Badge variant="outline" className="text-xs">
                {t.last12}
              </Badge>
            </div>
            {hasData ? (
              <>
                <div className="-mx-5 mt-6 overflow-x-auto px-5">
                  <div
                    className="flex items-end gap-3"
                    style={{ height: 200, minWidth: monthlyData.length * 48 }}
                  >
                    {monthlyData.map((d) => {
                      const h = Math.round((d.revenue / maxRevenue) * 100);
                      return (
                        <div
                          key={d.month}
                          className="flex flex-1 flex-col items-center gap-2"
                          style={{ minWidth: 36 }}
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
                </div>
                <Separator className="my-4" />
              </>
            ) : loading ? (
              <div className="mt-6 space-y-2" aria-live="polite" aria-busy="true">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t.revenueEmpty}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">{t.topProducts}</h2>
            {topProducts.length === 0 && (
              loading ? (
                <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-4/5" />
                  <Skeleton className="h-10 w-3/5" />
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t.topProductsEmpty}
                </p>
              )
            )}
            <div className="mt-4 space-y-4">
              {topProducts.map((p) => (
                <div key={p.productId}>
                  <div className="flex items-center justify-between gap-2">
                    <LocaleLink
                      href={publicProductHref(p.slug)}
                      className="min-w-0 text-sm font-medium hover:text-brand-800 hover:underline"
                    >
                      {p.name}
                    </LocaleLink>
                    <span className="text-sm font-semibold">{p.revenue}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-brand-100">
                      <div
                        className="h-2 rounded-full bg-inverse-surface transition-all"
                        style={{ width: `${Math.min(100, p.sharePercent)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.sharePercent.toFixed(1)} %
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tFill(t.soldUnits, { count: p.soldUnits })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">{t.ordersPerMonth}</h2>
          {hasData ? (
            <div className="-mx-5 mt-6 overflow-x-auto px-5">
              <div
                className="flex items-end gap-3"
                style={{ height: 120, minWidth: monthlyData.length * 48 }}
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
                      style={{ minWidth: 36 }}
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
            </div>
          ) : (
            loading ? (
              <div className="mt-6 space-y-2" aria-live="polite" aria-busy="true">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t.ordersEmpty}
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
