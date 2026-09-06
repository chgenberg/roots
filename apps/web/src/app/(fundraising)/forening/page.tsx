"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { LocaleLink } from "@/components/locale-link";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { MiniTrendCard } from "@/components/charts/mini-trend-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  TrendingUp,
  Trophy,
  ArrowRight,
  Loader2,
  Plus,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch, rootsFetch } from "@/lib/api";
import type { AssociationDashboard as AssociationDashboardData, Campaign } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";
import { formatKr, formatKrValue, pluralSv } from "@/lib/format";

const API_URL = getBrowserApiBase();

// Helper for the campaign-form date defaults: today + 60 days as a sane
// initial end date so the user doesn't have to type both ends manually.
function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface TeamData {
  id: string;
  name: string;
  memberCount: number;
  totalSalesOre: number;
  orderCount: number;
  goalValue: number;
  inviteToken?: string | null;
}

function AssociationDashboardInner() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.associationDashboard[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<AssociationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sprint E9: ASSOCIATION_ADMIN can now start new campaigns from the
  // dashboard. Form state is local to the modal so a half-typed campaign
  // never leaks into the page's main render.
  // MASTERPLAN_01 KC3.1: ?openCampaign=1 triggar auto-open så att
  // kom-igång-checklistan kan länka rakt in i campaign-create-flödet.
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(
    () => params.get("openCampaign") === "1"
  );

  // När user kommer från checklist:en med ?openCampaign=1 vill vi rensa
  // query-strängen efter att dialogen har triggats — så att en
  // F5/refresh inte spammar dialogen igen och URL-baren blir städad.
  useEffect(() => {
    if (params.get("openCampaign") === "1") {
      const next = new URLSearchParams(params.toString());
      next.delete("openCampaign");
      const qs = next.toString();
      router.replace(href(`/forening${qs ? `?${qs}` : ""}`));
    }
    // intentionally only run on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoalValue, setNewGoalValue] = useState("50000");
  const [newStartDate, setNewStartDate] = useState(isoDate(0));
  // 2-veckors säljperiod som standard (kan justeras).
  const [newEndDate, setNewEndDate] = useState(isoDate(14));
  const [newDeliveryDate, setNewDeliveryDate] = useState("");
  const [newDeliveryType, setNewDeliveryType] = useState<
    "BULK" | "DIRECT" | "BOTH"
  >("BULK");
  const [newAllowOutside, setNewAllowOutside] = useState(true);
  const [newMargin, setNewMargin] = useState("25");

  const { toast } = useToast();

  async function load(silent = false) {
    try {
      const res = await rootsFetch(`${API_URL}/v1/dashboard/association`);
      if (res.ok) {
        setData(await res.json());
      } else if (!silent) {
        setError(t.loadFailed);
      }
    } catch {
      if (!silent) setError(t.networkFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Live-uppdatering var 30:e sekund.
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
     
  }, []);

  async function handleCreateCampaign() {
    const trimmed = newName.trim();
    if (trimmed.length < 3) {
      toast(t.campaignNameMin, "error");
      return;
    }
    const goalValue = Number.parseInt(newGoalValue, 10);
    if (!Number.isFinite(goalValue) || goalValue < 0) {
      toast(t.goalPositive, "error");
      return;
    }
    if (newEndDate < newStartDate) {
      toast(t.endAfterStart, "error");
      return;
    }
    const margin = Number.parseInt(newMargin, 10);
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
      toast(t.marginRange, "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        id?: string;
        name?: string;
        error?: string;
      }>("/v1/association/campaigns", {
        method: "POST",
        body: {
          name: trimmed,
          goalType: "AMOUNT",
          goalValue,
          startDate: newStartDate,
          endDate: newEndDate,
          deliveryDate: newDeliveryDate || undefined,
          allowSalesOutsidePeriod: newAllowOutside,
          deliveryType: newDeliveryType,
          marginPercent: margin,
        },
      });
      if (res.ok && res.data?.id) {
        toast(tFill(t.campaignActive, { name: res.data.name ?? "" }), "success");
        setCampaignDialogOpen(false);
        setNewName("");
        await load();
      } else {
        toast(res.data?.error || t.campaignCreateFailed, "error");
      }
    } catch {
      toast(c.networkError, "error");
    } finally {
      setSubmitting(false);
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
        <Button variant="outline" onClick={() => window.location.reload()}>
          {c.retry}
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
      {/* MASTERPLAN_01 KC3.1: persistent onboarding-nudge. Gömmer sig
          själv när alla steg är klara — vi behöver inte tracking-flag. */}
      <OnboardingBanner />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {activeCampaign
              ? tFill(t.campaignLabel, { name: activeCampaign.name })
              : t.noActiveCampaign}
          </p>
        </div>
        <Button onClick={() => setCampaignDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {activeCampaign ? t.newCampaign : t.startCampaign}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.totalSales}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {formatKr(totalSales, locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.orders}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.teams}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{teams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.sellers}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {data?.sellers?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Försäljningstrend */}
      <MiniTrendCard
        path="/v1/dashboard/association/stats"
        href="/forening/statistik"
      />

      {/* Progress */}
      {campaignGoal > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{t.progressTitle}</p>
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
                ? tFill(t.packagesOf, {
                    current: totalOrders,
                    goal: campaignGoal,
                  })
                : tFill(t.amountOf, {
                    current: formatKr(totalSales, locale),
                    goal:
                      locale === "en"
                        ? `SEK ${campaignGoal.toLocaleString(dateLocale)}`
                        : `${campaignGoal.toLocaleString(dateLocale)} kr`,
                  })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.teamRanking}</CardTitle>
          <Trophy className="h-4 w-4 text-brand-500" />
        </CardHeader>
        <CardContent>
          {sortedTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.noTeamsRegistered}
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
                      {pluralSv(team.memberCount, c.sellerSingular, c.sellerPlural)} ·{" "}
                      {pluralSv(team.orderCount, c.orderSingular, c.orderPlural)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatKr(team.totalSalesOre, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <LocaleLink href="/forening/lag">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">{t.manageTeams}</p>
                <p className="text-xs text-muted-foreground">
                  {t.manageTeamsHint}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </LocaleLink>
        <LocaleLink href="/forening/avrakning">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-5">
              <TrendingUp className="h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">{t.settlement}</p>
                <p className="text-xs text-muted-foreground">
                  {t.settlementHint}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </LocaleLink>
      </div>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>{t.dialogDesc}</DialogDescription>
          </DialogHeader>
          {/* Scout fix 2026-05-26 (UX dialog-overflow): wrappa form-fält
              i px-6 pb-2 så inputs inte glider in i dialog-kanten. */}
          <div className="space-y-4 px-6 py-2">
            <div>
              <Label htmlFor="campaignName">{t.campaignName}</Label>
              <Input
                id="campaignName"
                placeholder={t.campaignNamePlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="goalValue">
                  {t.goalKr}
                </Label>
                <Input
                  id="goalValue"
                  type="number"
                  min={0}
                  step={1000}
                  value={newGoalValue}
                  onChange={(e) => setNewGoalValue(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="margin">{t.marginPct}</Label>
                <Input
                  id="margin"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={newMargin}
                  onChange={(e) => setNewMargin(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="startDate">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t.startDate}
                  </span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t.endDate}
                  </span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.endDateHint}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="deliveryDate">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t.deliveryToClub}
                  </span>
                </Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.deliveryDateHint}
                </p>
              </div>
              <div>
                <Label htmlFor="deliveryType">{t.deliveryType}</Label>
                <select
                  id="deliveryType"
                  value={newDeliveryType}
                  onChange={(e) =>
                    setNewDeliveryType(
                      e.target.value as "BULK" | "DIRECT" | "BOTH"
                    )
                  }
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="BULK">{t.deliveryBulkOption}</option>
                  <option value="DIRECT">{t.deliveryDirectOption}</option>
                  <option value="BOTH">{t.deliveryBothOption}</option>
                </select>
              </div>
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={newAllowOutside}
                onChange={(e) => setNewAllowOutside(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                <span className="font-medium">
                  {t.allowOutside}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.allowOutsideHint}
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCampaignDialogOpen(false)}
              disabled={submitting}
            >
              {c.cancel}
            </Button>
            <Button onClick={handleCreateCampaign} disabled={submitting}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t.startCampaign}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * useSearchParams kräver Suspense-boundary i Next 15 app router.
 * Vi wrappar därför inner-komponenten med en tunn loading-fallback
 * som matchar tonen i resten av portalen.
 */
export default function AssociationDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AssociationDashboardInner />
    </Suspense>
  );
}
