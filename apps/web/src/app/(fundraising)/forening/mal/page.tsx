"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Loader2 } from "lucide-react";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

export default function GoalsPage() {
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
          setError("Kunde inte hämta måldata. Försök igen.");
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

  const campaign = data?.campaigns?.find((c: Campaign) => c.status === "ACTIVE");
  const teams = data?.teams || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mål och fördelning</h1>
        <p className="text-sm text-muted-foreground">
          Fördela försäljningsmål mellan lag
        </p>
      </div>

      {campaign && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              {campaign.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Totalt mål</p>
                <p className="text-xl font-bold">
                  {campaign.goalType === "AMOUNT"
                    ? `${campaign.goalValue.toLocaleString("sv-SE")} kr`
                    : `${campaign.goalValue} paket`}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Antal lag</p>
                <p className="text-xl font-bold">{teams.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Mål per lag (snitt)
                </p>
                <p className="text-xl font-bold">
                  {teams.length > 0
                    ? campaign.goalType === "AMOUNT"
                      ? `${Math.round(campaign.goalValue / teams.length).toLocaleString("sv-SE")} kr`
                      : `${Math.round(campaign.goalValue / teams.length)} paket`
                    : "–"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {teams.map((team: Team) => {
          const isPackageGoal = campaign?.goalType === "PACKAGES";
          const progress =
            team.goalValue > 0
              ? Math.min(
                  100,
                  Math.round(
                    isPackageGoal
                      ? (team.orderCount / team.goalValue) * 100
                      : (team.totalSalesOre / (team.goalValue * 100)) * 100
                  )
                )
              : 0;

          return (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {isPackageGoal
                      ? `${team.orderCount || 0} paket`
                      : `${(team.totalSalesOre / 100).toLocaleString("sv-SE")} kr`}
                    {team.goalValue > 0 &&
                      (isPackageGoal
                        ? ` / ${team.goalValue} paket`
                        : ` / ${team.goalValue.toLocaleString("sv-SE")} kr`)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-brand-700 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
