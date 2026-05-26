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

function formatSek(ore: number): string {
  if (!ore || ore <= 0) return "0 kr";
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

export default function SaljarePage() {
  // P3.2 + P3.11 + P3.79 (audit 2026-05-26): useApiData ger cancel-guard,
  // error-state och loading-state utan att vi behöver göra det manuellt.
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

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Säljare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Säljteamets prestation och resultat.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">
            Kunde inte hämta säljardata
          </p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetch}
            className="mt-3"
          >
            Försök igen
          </Button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Hämtar säljare…</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{sellers.length}</p>
                <p className="text-xs text-muted-foreground">Aktiva säljare</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{formatSek(totals.pipelineOre)}</p>
                <p className="text-xs text-muted-foreground">Total pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{formatSek(totals.closedOre)}</p>
                <p className="text-xs text-muted-foreground">Totalt stängt</p>
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
                <p className="text-xs text-muted-foreground">Snittkonvertering</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold">Prestationsöversikt</h2>
          {sellers.length === 0 && (
            <p className="mb-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Ingen säljdata att visa ännu. Tabellen fylls på när säljare
              registreras och börjar bygga pipeline.
            </p>
          )}

          {/* MASTERPLAN_01 KC6.5: 7-kolums-tabellen kraschar i layout
              under ~900 px (horizontal scroll, oläsbart). Vi visar den
              bara på lg+ och renderar en cards-stack på mobil där varje
              säljare blir en tappable rad med samma data men i två
              rader istället för sju kolumner. */}
          <ul className="space-y-3 lg:hidden" aria-label="Säljare (lista)">
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
                      aria-label={`Plats ${i + 1}`}
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
                    <dt className="text-muted-foreground">Klubbar</dt>
                    <dd className="font-medium">{s.clubs}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Pipeline</dt>
                    <dd className="font-medium">{formatSek(s.pipelineOre)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Stängt</dt>
                    <dd className="font-medium">{formatSek(s.closedOre)}</dd>
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
                  <TableHead>Säljare</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Klubbar</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Stängt</TableHead>
                  <TableHead className="text-right">Konvertering</TableHead>
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
                    <TableCell className="font-medium">{formatSek(s.pipelineOre)}</TableCell>
                    <TableCell className="font-medium">{formatSek(s.closedOre)}</TableCell>
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
