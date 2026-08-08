"use client";

import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaTrend } from "./area-trend";
import { useStats, buildDailyAxis } from "./use-stats";
import { formatKr } from "./theme";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

interface MiniTrendCardProps {
  /** Stats-endpoint, t.ex. "/v1/dashboard/association/stats". */
  path: string;
  /** Länk till hela statistik-sidan. */
  href: string;
}

export function MiniTrendCard({ path, href }: MiniTrendCardProps) {
  const { locale } = useLocale();
  const t = fundraisingPages.miniTrend[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const { data, loading } = useStats(path);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold leading-tight">{t.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.last90}</p>
          </div>
          <LocaleLink
            href={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition-colors hover:text-brand-800"
          >
            {t.allStats}
            <ArrowRight className="h-3.5 w-3.5" />
          </LocaleLink>
        </div>

        {loading ? (
          <Skeleton className="mt-5 h-[140px] w-full" />
        ) : data && data.totals.salesOre > 0 ? (
          <div className="mt-4">
            <p className="text-2xl font-bold tabular-nums">
              {formatKr(data.totals.salesOre, locale)}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              {tFill(t.paidOrders, {
                n: data.totals.orders.toLocaleString(dateLocale),
              })}
            </p>
            <AreaTrend
              points={buildDailyAxis(data.daily, data.periodStart, data.periodEnd).sales}
              format={(ore) => formatKr(ore, locale)}
              height={140}
            />
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
