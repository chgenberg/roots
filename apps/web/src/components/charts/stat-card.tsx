"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ComponentType } from "react";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
  /** Procentförändring vs föregående period (valfritt). */
  changePercent?: number | null;
  hint?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  changePercent = null,
  hint,
}: StatCardProps) {
  const { locale } = useLocale();
  const vsPrevious = fundraisingPages.stats[locale].vsPrevious;
  const positive = (changePercent ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />}
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
        {changePercent !== null && (
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant={positive ? "success" : "destructive"}
              className="text-[10px]"
            >
              {positive ? "+" : ""}
              {changePercent.toFixed(1)} %
            </Badge>
            <span className="text-xs text-muted-foreground">{vsPrevious}</span>
          </div>
        )}
        {changePercent === null && hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
