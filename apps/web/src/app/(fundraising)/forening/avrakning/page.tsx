"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, TrendingUp, Loader2 } from "lucide-react";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";

import { getBrowserApiBase } from "@/lib/api-base";
import { formatKrValue, pluralSv } from "@/lib/format";

const API_URL = getBrowserApiBase();

export default function SettlementPage() {
  const [data, setData] = useState<AssociationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/dashboard/association`, {
          credentials: "include",
        });
        if (res.ok) {
          setData(await res.json());
        } else {
          setError("Kunde inte hämta avräkningsdata. Försök igen.");
        }
      } catch {
        setError("Ett nätverksfel uppstod. Försök igen.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Försök igen
        </Button>
      </div>
    );
  }

  const campaign = data?.campaigns?.find((c: Campaign) => c.status === "ACTIVE" || c.status === "ENDED");
  const marginPercent = campaign?.marginPercent || 25;
  const totalSales = data?.stats?.totalSalesOre || 0;
  const teamShare = Math.round(totalSales * (marginPercent / 100));
  const rootsShare = totalSales - teamShare;
  const teams = data?.teams || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avräkning</h1>
        <p className="text-sm text-muted-foreground">
          Översikt av intäkter och ekonomi
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              <p className="text-sm text-muted-foreground">Total försäljning</p>
            </div>
            <p className="text-2xl font-bold">
              {formatKrValue(totalSales)} kr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Föreningens intjänat</p>
            <p className="text-2xl font-bold text-success">
              {formatKrValue(teamShare)} kr
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {marginPercent}% marginal
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Roots andel</p>
            <p className="text-2xl font-bold">
              {formatKrValue(rootsShare)} kr
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Per lag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teams.map((team: Team) => {
              const teamEarned = Math.round(
                team.totalSalesOre * (marginPercent / 100)
              );
              return (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pluralSv(team.orderCount, "order", "ordrar")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatKrValue(team.totalSalesOre)} kr
                    </p>
                    <p className="text-xs text-success">
                      +{formatKrValue(teamEarned)} kr
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
