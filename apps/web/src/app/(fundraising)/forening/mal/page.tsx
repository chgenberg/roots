"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Loader2, Check, X, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

export default function GoalsPage() {
  const [data, setData] = useState<AssociationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
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

  useEffect(() => {
    void load();
  }, []);

  const campaign = data?.campaigns?.find((c: Campaign) => c.status === "ACTIVE");
  const teams = data?.teams || [];

  function startEdit(team: Team) {
    setEditingTeamId(team.id);
    setEditValue(String(team.goalValue || 0));
  }

  function cancelEdit() {
    setEditingTeamId(null);
    setEditValue("");
  }

  async function saveGoal(teamId: string) {
    if (!campaign) {
      toast("Ingen aktiv kampanj — kan inte spara mål.", "error");
      return;
    }
    const parsed = Math.floor(Number(editValue));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast("Målet måste vara ett positivt tal.", "error");
      return;
    }
    setSavingTeamId(teamId);
    try {
      const res = await fetch(`${API_URL}/v1/dashboard/association/team-goals`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          campaignId: campaign.id,
          goalValue: parsed,
          goalType: campaign.goalType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body?.error || "Kunde inte spara målet.", "error");
        return;
      }
      toast("Målet är uppdaterat.", "success");
      setEditingTeamId(null);
      setEditValue("");
      await load();
    } catch {
      toast("Ett nätverksfel uppstod. Försök igen.", "error");
    } finally {
      setSavingTeamId(null);
    }
  }

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
        <Button variant="outline" onClick={() => void load()}>
          Försök igen
        </Button>
      </div>
    );
  }

  const isPackageGoal = campaign?.goalType === "PACKAGES";
  const goalUnit = isPackageGoal ? "paket" : "kr";
  const totalDistributed = teams.reduce(
    (sum: number, t: Team) => sum + (t.goalValue || 0),
    0
  );
  const campaignGoal = campaign?.goalValue ?? 0;
  const remaining = Math.max(0, campaignGoal - totalDistributed);
  const overshoot = Math.max(0, totalDistributed - campaignGoal);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mål och fördelning</h1>
        <p className="text-sm text-muted-foreground">
          Fördela försäljningsmål mellan lag. Klicka på pennan för att
          justera ett lags mål — det sparas direkt.
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
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Totalt mål</p>
                <p className="text-xl font-bold">
                  {campaign.goalValue != null
                    ? isPackageGoal
                      ? `${campaign.goalValue} paket`
                      : `${campaign.goalValue.toLocaleString("sv-SE")} kr`
                    : "–"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fördelat</p>
                <p className="text-xl font-bold">
                  {totalDistributed.toLocaleString("sv-SE")} {goalUnit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {overshoot > 0 ? "Över mål" : "Kvar att fördela"}
                </p>
                <p
                  className={`text-xl font-bold ${overshoot > 0 ? "text-amber-600" : ""}`}
                >
                  {(overshoot > 0 ? overshoot : remaining).toLocaleString("sv-SE")} {goalUnit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Antal lag</p>
                <p className="text-xl font-bold">{teams.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {teams.map((team: Team) => {
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

          const isEditing = editingTeamId === team.id;
          const isSaving = savingTeamId === team.id;

          return (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="font-medium text-sm">{team.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isPackageGoal
                        ? `${team.orderCount || 0} paket`
                        : `${(team.totalSalesOre / 100).toLocaleString("sv-SE")} kr`}
                      {!isEditing && team.goalValue > 0 &&
                        (isPackageGoal
                          ? ` / ${team.goalValue} paket`
                          : ` / ${team.goalValue.toLocaleString("sv-SE")} kr`)}
                    </p>
                    {!campaign ? null : isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-28 text-sm"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">
                          {goalUnit}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void saveGoal(team.id)}
                          disabled={isSaving}
                          aria-label="Spara"
                          className="h-7 w-7 p-0"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={isSaving}
                          aria-label="Avbryt"
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(team)}
                        aria-label="Ändra mål"
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
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
        {teams.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Inga lag att fördela mål till ännu.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
