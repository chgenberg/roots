"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Loader2, Check, X, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { appCommon } from "@/i18n/dictionaries/app-common";

const API_URL = getBrowserApiBase();

export default function GoalsPage() {
  const { locale } = useLocale();
  const t = fundraisingPages.goals[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;
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
      const res = await rootsFetch(`${API_URL}/v1/dashboard/association`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(t.loadFailed);
      }
    } catch {
      setError(c.networkError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaign = data?.campaigns?.find((camp: Campaign) => camp.status === "ACTIVE");
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
      toast(t.noActiveCampaign, "error");
      return;
    }
    const parsed = Math.floor(Number(editValue));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast(t.goalPositive, "error");
      return;
    }
    setSavingTeamId(teamId);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/dashboard/association/team-goals",
        {
          method: "PATCH",
          body: {
            teamId,
            campaignId: campaign.id,
            goalValue: parsed,
            goalType: campaign.goalType,
          },
        }
      );
      if (!ok) {
        toast(data?.error || t.saveFailed, "error");
        return;
      }
      toast(t.saved, "success");
      setEditingTeamId(null);
      setEditValue("");
      await load();
    } catch {
      toast(c.networkError, "error");
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
          {c.retry}
        </Button>
      </div>
    );
  }

  const isPackageGoal = campaign?.goalType === "PACKAGES";
  const goalUnit = isPackageGoal ? c.packages : c.kr;
  const totalDistributed = teams.reduce(
    (sum: number, team: Team) => sum + (team.goalValue || 0),
    0
  );
  const campaignGoal = campaign?.goalValue ?? 0;
  const remaining = Math.max(0, campaignGoal - totalDistributed);
  const overshoot = Math.max(0, totalDistributed - campaignGoal);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
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
                <p className="text-sm text-muted-foreground">{t.totalGoal}</p>
                <p className="text-xl font-bold">
                  {campaign.goalValue != null
                    ? isPackageGoal
                      ? `${campaign.goalValue} ${c.packages}`
                      : `${campaign.goalValue.toLocaleString(dateLocale)} ${c.kr}`
                    : "–"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.distributed}</p>
                <p className="text-xl font-bold">
                  {totalDistributed.toLocaleString(dateLocale)} {goalUnit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {overshoot > 0 ? t.overGoal : t.remaining}
                </p>
                <p
                  className={`text-xl font-bold ${overshoot > 0 ? "text-warning-strong" : ""}`}
                >
                  {(overshoot > 0 ? overshoot : remaining).toLocaleString(
                    dateLocale
                  )}{" "}
                  {goalUnit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.teamCount}</p>
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
                        ? `${team.orderCount || 0} ${c.packages}`
                        : formatKr(team.totalSalesOre, locale)}
                      {!isEditing &&
                        team.goalValue > 0 &&
                        (isPackageGoal
                          ? ` / ${team.goalValue} ${c.packages}`
                          : ` / ${team.goalValue.toLocaleString(dateLocale)} ${c.kr}`)}
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
                          aria-label={t.saveAria}
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
                          aria-label={t.cancelAria}
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
                        aria-label={t.editGoal}
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
              {t.empty}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
