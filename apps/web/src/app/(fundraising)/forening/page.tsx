"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  Trophy,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { AssociationDashboard as AssociationDashboardData, Campaign } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

interface TeamData {
  id: string;
  name: string;
  memberCount: number;
  totalSalesOre: number;
  orderCount: number;
  goalValue: number;
  inviteToken: string;
}

export default function AssociationDashboard() {
  const [data, setData] = useState<AssociationDashboardData | null>(null);
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
          setError("Kunde inte hämta data. Kontrollera att du har rätt behörighet.");
        }
      } catch {
        setError("Nätverksfel. Kunde inte kontakta servern.");
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

  const teams: TeamData[] = data?.teams || [];
  const totalSales = data?.stats?.totalSalesOre || 0;
  const totalOrders = data?.stats?.totalOrders || 0;
  const activeCampaign = data?.campaigns?.find(
    (c: Campaign) => c.status === "ACTIVE"
  );
  const campaignGoal = activeCampaign?.goalValue || 0;
  const isPackageGoal = activeCampaign?.goalType === "PACKAGES";
  const progress =
    campaignGoal > 0
      ? Math.min(
          100,
          Math.round(
            isPackageGoal
              ? (totalOrders / campaignGoal) * 100
              : (totalSales / (campaignGoal * 100)) * 100
          )
        )
      : 0;

  const sortedTeams = [...teams].sort(
    (a, b) => b.totalSalesOre - a.totalSalesOre
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Förenings-dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {activeCampaign
            ? `Kampanj: ${activeCampaign.name}`
            : "Ingen aktiv kampanj"}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total försäljning</p>
            <p className="mt-1 text-2xl font-bold">
              {(totalSales / 100).toLocaleString("sv-SE")} kr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Beställningar</p>
            <p className="mt-1 text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Lag</p>
            <p className="mt-1 text-2xl font-bold">{teams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Säljare</p>
            <p className="mt-1 text-2xl font-bold">
              {data?.sellers?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {campaignGoal > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Framsteg mot föreningens mål</p>
              <span className="text-sm font-bold">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-700 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isPackageGoal
                ? `${totalOrders} av ${campaignGoal} paket`
                : `${(totalSales / 100).toLocaleString("sv-SE")} kr av ${campaignGoal.toLocaleString("sv-SE")} kr`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lag-ranking</CardTitle>
          <Trophy className="h-4 w-4 text-brand-500" />
        </CardHeader>
        <CardContent>
          {sortedTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga lag har registrerats ännu.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedTeams.map((team, i) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="text-sm font-medium text-brand-500 w-5 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.memberCount} säljare · {team.orderCount} ordrar
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {(team.totalSalesOre / 100).toLocaleString("sv-SE")} kr
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/forening/lag">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">Hantera lag</p>
                <p className="text-xs text-muted-foreground">
                  Bjud in lag och skicka länkar
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/forening/avrakning">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-5">
              <TrendingUp className="h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">Avräkning</p>
                <p className="text-xs text-muted-foreground">
                  Se intjänat och betalningsstatus
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
