"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { TrendingUp, Wallet, CalendarDays } from "lucide-react";
import { portalFetch } from "@/lib/portal-api";
import { incomeResponseSchema } from "@roots/contracts";

interface MonthRow {
  month: string;
  revenue: number;
  orders: number;
  payout: boolean;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
];

function formatMonthKey(key: string): string {
  // API emits YYYY-MM via `to_char`. Map to "Mars 2026".
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${MONTH_NAMES[monthIdx] ?? key} ${year}`;
}

export default function IntakterPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [totalEarnedOre, setTotalEarnedOre] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API shape: { months: [{ month, revenueOre, orderCount }], totalEarnedOre }
    portalFetch("/income", { schema: incomeResponseSchema })
      .then((data) => {
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setMonths(
          (data.months ?? []).map((m) => ({
            month: formatMonthKey(m.month),
            revenue: Math.round(m.revenueOre / 100),
            orders: m.orderCount,
            // "payout" is not tracked by the API yet — treat any month before
            // the current calendar month as paid-out (operator convention).
            payout: m.month < currentKey,
          }))
        );
        setTotalEarnedOre(data.totalEarnedOre ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalEarned =
    totalEarnedOre !== null
      ? Math.round(totalEarnedOre / 100)
      : months.reduce((sum, m) => sum + m.revenue, 0);

  // Current calendar month (Mars 2026 etc.) — find matching row from API.
  const now = new Date();
  const currentKey = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const thisMonth = months.find((m) => m.month === currentKey);
  const thisMonthRevenue = thisMonth?.revenue ?? 0;

  // "Next payout" — convention: 15:e i nästa månad. Visa inte ett datum
  // om vi inte har några pågående intjäningar.
  const hasPending = months.some((m) => !m.payout && m.revenue > 0);
  const nextPayout = (() => {
    if (!hasPending) return "—";
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  })();

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intäkter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Följ era intäkter från Roots-försäljningen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalEarned.toLocaleString("sv-SE")} kr</p>
                <p className="text-xs text-muted-foreground">Totalt intjänat</p>
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
                  {thisMonth ? `${thisMonthRevenue.toLocaleString("sv-SE")} kr` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Denna månad</p>
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
                <p className="text-xs text-muted-foreground">Nästa utbetalning</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">Månadsöversikt</h2>
          {loading ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Hämtar månadsdata…
            </p>
          ) : months.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Ingen intäktshistorik ännu. Tabellen fylls i automatiskt när er
              första betalda order registreras.
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
                        {m.orders} beställningar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{m.revenue.toLocaleString("sv-SE")} kr</p>
                    </div>
                    {m.payout ? (
                      <Badge variant="success">Utbetald</Badge>
                    ) : (
                      <Badge variant="warning">Väntande</Badge>
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
