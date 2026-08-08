"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Users, TrendingUp, Target, Award, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiData } from "@/lib/use-api-data";
import { Button } from "@/components/ui/button";
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

interface SalesRep {
  id: string;
  name: string | null;
  email: string;
  role: string;
  clubs: number;
  pipelineOre: number;
  closedOre: number;
  conversion: number | null;
}

interface SellersResponse {
  sellers: SalesRep[];
  totals: {
    pipelineOre: number;
    closedOre: number;
    avgConversion: number | null;
  };
}

export default function SaljarePage() {
  const { locale } = useLocale();
  const t = portalPages.saljare[locale];
  const shared = portalShared[locale];
  const common = appCommon[locale];

  const { data, error, loading, refetch } =
    useApiData<SellersResponse>("/sellers");

  const sellers = useMemo(() => {
    if (!data?.sellers) return [] as SalesRep[];
    return [...data.sellers].sort((a, b) => b.closedOre - a.closedOre);
  }, [data]);
  const totals = data?.totals ?? {
    pipelineOre: 0,
    closedOre: 0,
    avgConversion: null,
  };

  function formatSellerSek(ore: number): string {
    if (!ore || ore <= 0) return `0 ${shared.kr}`;
    return formatKr(ore, locale);
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">{t.loadError}</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetch}
            className="mt-3"
          >
            {common.retry}
          </Button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t.loading}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{sellers.length}</p>
                <p className="text-xs text-muted-foreground">{t.activeSellers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{formatSellerSek(totals.pipelineOre)}</p>
                <p className="text-xs text-muted-foreground">{t.totalPipeline}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{formatSellerSek(totals.closedOre)}</p>
                <p className="text-xs text-muted-foreground">{t.totalClosed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">
                  {totals.avgConversion !== null
                    ? `${totals.avgConversion}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{t.avgConversion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold">{t.performance}</h2>
          {sellers.length === 0 && (
            <p className="mb-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t.empty}
            </p>
          )}

          <ul className="space-y-3 lg:hidden" aria-label={t.listAria}>
            {sellers.map((s, i) => (
              <li
                key={s.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        i < 3 ? "bg-brand-50" : "text-muted-foreground"
                      )}
                      aria-label={tFill(t.placeAria, { n: i + 1 })}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name ?? s.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.email}
                      </p>
                    </div>
                  </div>
                  {s.conversion !== null && (
                    <Badge
                      variant={
                        s.conversion >= 50
                          ? "success"
                          : s.conversion >= 25
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {s.conversion}%
                    </Badge>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{shared.clubs}</dt>
                    <dd className="font-medium">{s.clubs}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{shared.pipeline}</dt>
                    <dd className="font-medium">{formatSellerSek(s.pipelineOre)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.colClosed}</dt>
                    <dd className="font-medium">{formatSellerSek(s.closedOre)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t.colSeller}</TableHead>
                  <TableHead>{t.colEmail}</TableHead>
                  <TableHead>{t.colClubs}</TableHead>
                  <TableHead>{t.colPipeline}</TableHead>
                  <TableHead>{t.colClosed}</TableHead>
                  <TableHead className="text-right">{t.colConversion}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {i < 3 ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.name ?? s.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell>{s.clubs}</TableCell>
                    <TableCell className="font-medium">{formatSellerSek(s.pipelineOre)}</TableCell>
                    <TableCell className="font-medium">{formatSellerSek(s.closedOre)}</TableCell>
                    <TableCell className="text-right">
                      {s.conversion !== null ? (
                        <Badge
                          variant={
                            s.conversion >= 50
                              ? "success"
                              : s.conversion >= 25
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {s.conversion}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
