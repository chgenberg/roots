"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Shown centred when there is no data. */
  empty?: boolean;
  emptyLabel?: string;
}

export function ChartCard({
  title,
  subtitle,
  right,
  className,
  children,
  empty,
  emptyLabel,
}: ChartCardProps) {
  const { locale } = useLocale();
  const resolvedEmpty =
    emptyLabel ?? fundraisingPages.stats[locale].chartEmpty;

  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
        {empty ? (
          <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {resolvedEmpty}
          </p>
        ) : (
          <div className={cn("mt-5")}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
