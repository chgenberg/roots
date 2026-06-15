import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ComponentType } from "react";

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
  const positive = (changePercent ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {Icon && <Icon className="h-4 w-4 text-brand-400" />}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {changePercent !== null && (
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant={positive ? "success" : "destructive"}
              className="text-[10px]"
            >
              {positive ? "+" : ""}
              {changePercent.toFixed(1)} %
            </Badge>
            <span className="text-xs text-muted-foreground">vs förra perioden</span>
          </div>
        )}
        {changePercent === null && hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
