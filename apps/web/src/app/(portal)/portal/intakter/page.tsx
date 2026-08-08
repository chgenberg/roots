"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Wallet, CalendarDays } from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import { incomeResponseSchema } from "@roots/contracts";
import { LoadError } from "@/components/load-error";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

interface MonthRow {
  month: string;
  revenue: number;
  orders: number;
  payout: boolean;
}

function formatMonthKey(
  key: string,
  months: readonly string[]
): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${months[monthIdx] ?? key} ${year}`;
}

export default function IntakterPage() {
  const { locale } = useLocale();
  const t = portalPages.intakter[locale];
  const shared = portalShared[locale];
  const monthNames = shared.months;

  const [months, setMonths] = useState<MonthRow[]>([]);
  const [totalEarnedOre, setTotalEarnedOre] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    portalFetch("/income", { schema: incomeResponseSchema })
      .then((data) => {
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setMonths(
          (data.months ?? []).map((m) => ({
            month: formatMonthKey(m.month, monthNames),
            revenue: Math.round(m.revenueOre / 100),
            orders: m.orderCount,
            payout: m.month < currentKey,
          }))
        );
        setTotalEarnedOre(data.totalEarnedOre ?? 0);
      })
      .catch(() => {
        setError(t.loadError);
      })
      .finally(() => setLoading(false));
  }, [monthNames, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const totalEarned =
    totalEarnedOre !== null
      ? Math.round(totalEarnedOre / 100)
      : months.reduce((sum, m) => sum + m.revenue, 0);

  const now = new Date();
  const currentKey = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const thisMonth = months.find((m) => m.month === currentKey);
  const thisMonthRevenue = thisMonth?.revenue ?? 0;

  const hasPending = months.some((m) => !m.payout && m.revenue > 0);
  const nextPayout = (() => {
    if (!hasPending) return "—";
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return d.toLocaleDateString(shared.dateLocale, {
      day: "numeric",
      month: "short",
    });
  })();

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
    </div>
  );

  if (error) {
    return (
      <div className="page-enter space-y-6">
        {header}
        <LoadError message={error} onRetry={load} inline />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {totalEarned.toLocaleString(shared.dateLocale)} {shared.kr}
                </p>
                <p className="text-xs text-muted-foreground">{t.totalEarned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {thisMonth
                    ? `${thisMonthRevenue.toLocaleString(shared.dateLocale)} ${shared.kr}`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{t.thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{nextPayout}</p>
                <p className="text-xs text-muted-foreground">{t.nextPayout}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">{t.monthOverview}</h2>
          {loading ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t.loadingMonths}
            </p>
          ) : months.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t.empty}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {months.map((m) => (
                <div
                  key={m.month}
                  className="flex items-center justify-between rounded-xl border border-border/50 p-4 transition-colors hover:bg-brand-50/50"
                >
                  <div className="flex items-center gap-4">
                    <CalendarDays className="h-5 w-5 shrink-0 text-brand-400" />
                    <div>
                      <p className="font-medium">{m.month}</p>
                      <p className="text-xs text-muted-foreground">
                        {tFill(t.ordersCount, { count: m.orders })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">
                        {m.revenue.toLocaleString(shared.dateLocale)}{" "}
                        {shared.kr}
                      </p>
                    </div>
                    {m.payout ? (
                      <Badge variant="success">{t.paidOut}</Badge>
                    ) : (
                      <Badge variant="warning">{t.pending}</Badge>
                    )}
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
