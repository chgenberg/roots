"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { TrendingUp, Wallet, CalendarDays, ArrowUpRight } from "lucide-react";
import { portalFetch } from "@/lib/portal-api";

const FALLBACK_MONTHS = [
  { month: "Januari", revenue: 1200, orders: 4, payout: true },
  { month: "Februari", revenue: 1850, orders: 6, payout: true },
  { month: "Mars", revenue: 2450, orders: 8, payout: false },
];

export default function IntakterPage() {
  const [months, setMonths] = useState(FALLBACK_MONTHS);

  useEffect(() => {
    portalFetch<{ months: any[]; totalEarnedOre: number }>("/income")
      .then((data) => {
        if (data.months?.length) {
          setMonths(
            data.months.map((m) => ({
              month: m.month ?? "",
              revenue: m.revenue ?? 0,
              orders: m.orders ?? 0,
              payout: m.payout ?? false,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const totalEarned = months.reduce((sum, m) => sum + m.revenue, 0);

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
                <p className="text-2xl font-bold">2 450 kr</p>
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
                <p className="text-2xl font-bold">15 apr</p>
                <p className="text-xs text-muted-foreground">Nästa utbetalning</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">Månadsöversikt</h2>
          <div className="mt-4 space-y-4">
            {months.map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between rounded-xl border border-border/50 p-4 transition-colors hover:bg-brand-50/50"
              >
                <div className="flex items-center gap-4">
                  <CalendarDays className="h-5 w-5 shrink-0 text-brand-400" />
                  <div>
                    <p className="font-medium">{m.month} 2025</p>
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
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-brand-50 to-brand-100/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-brand-900">
                Intäkterna ökade 32% jämfört med förra månaden
              </p>
              <p className="text-sm text-brand-700">
                Ni är på god väg — fortsätt bjuda in medlemmar för att öka
                intäkterna ytterligare.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
