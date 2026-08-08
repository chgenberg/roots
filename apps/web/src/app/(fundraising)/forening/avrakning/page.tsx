"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { LocaleLink } from "@/components/locale-link";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";
import { apiFetch, rootsFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { getBrowserApiBase } from "@/lib/api-base";
import { formatKr, formatKrValue, pluralSv } from "@/lib/format";

const API_URL = getBrowserApiBase();

type PayoutRow = {
  id: string;
  campaignId: string;
  campaignName: string | null;
  teamId: string;
  totalSalesOre: number;
  teamShareOre: number;
  rootsShareOre?: number;
  status: "PENDING" | "INVOICED" | "PAID";
  fortnoxInvoiceId: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
};

function statusLabel(status: string, locale: "sv" | "en"): string {
  const labels = fundraisingPages.payoutStatus[locale] as Record<string, string>;
  return labels[status] ?? status;
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "PAID":
    case "SETTLED":
      return "success";
    case "INVOICED":
    case "ENDED":
      return "warning";
    case "ACTIVE":
      return "default";
    default:
      return "secondary";
  }
}

export default function SettlementPage() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.settlement[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;

  const { toast } = useToast();
  const [data, setData] = useState<AssociationDashboard | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [orgNumber, setOrgNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dashRes, payRes, orgRes] = await Promise.all([
        rootsFetch(`${API_URL}/v1/dashboard/association`),
        apiFetch<{ payouts?: PayoutRow[] }>("/v1/payouts/mine"),
        apiFetch<{ organization?: { orgNumber?: string | null } }>(
          "/v1/association/org"
        ),
      ]);

      if (dashRes.ok) {
        setData(await dashRes.json());
        setError(null);
      } else {
        setError(t.loadFailed);
      }

      if (payRes.ok) setPayouts(payRes.data.payouts ?? []);
      if (orgRes.ok) setOrgNumber(orgRes.data.organization?.orgNumber ?? null);
    } catch {
      setError(c.networkError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function endCampaign(campaignId: string, name: string) {
    if (
      !window.confirm(tFill(t.confirmEnd, { name }))
    ) {
      return;
    }
    setActingId(campaignId);
    try {
      const res = await apiFetch<{ error?: string; status?: string }>(
        `/v1/association/campaigns/${campaignId}/end`,
        { method: "POST", body: {} }
      );
      if (!res.ok) {
        toast(res.data?.error || t.endFailed, "error");
        return;
      }
      toast(t.endedToast, "success");
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function generateSettlement(campaignId: string) {
    if (
      !window.confirm(t.confirmGenerate)
    ) {
      return;
    }
    setActingId(campaignId);
    try {
      const res = await apiFetch<{ error?: string; settlements?: unknown[] }>(
        `/v1/settlement/generate/${campaignId}`,
        { method: "POST", body: {} }
      );
      if (!res.ok) {
        toast(res.data?.error || t.generateFailed, "error");
        return;
      }
      toast(t.generateOk, "success");
      await load();
    } finally {
      setActingId(null);
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

  const campaigns = data?.campaigns || [];
  const activeOrEnded = campaigns.filter(
    (c) =>
      c.status === "ACTIVE" || c.status === "ENDED" || c.status === "SETTLED"
  );
  const campaign =
    activeOrEnded.find((c) => c.status === "ACTIVE") ||
    activeOrEnded.find((c) => c.status === "ENDED") ||
    activeOrEnded[0];
  const marginPercent = campaign?.marginPercent || 25;
  const totalSales = data?.stats?.totalSalesOre || 0;
  const teamShare = Math.round(totalSales * (marginPercent / 100));
  const rootsShare = totalSales - teamShare;
  const teams = data?.teams || [];
  const missingOrgNumber = !orgNumber;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {missingOrgNumber && (
        <Card className="border-warning-edge bg-warning-surface/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
              <div>
                <p className="font-semibold text-warning-strong">
                  {t.missingOrgTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.missingOrgBody}
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <LocaleLink href="/installningar">
                {t.fillNow}
                <ArrowRight className="ml-2 h-4 w-4" />
              </LocaleLink>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              <p className="text-sm text-muted-foreground">{c.totalSales}</p>
            </div>
            <p className="text-2xl font-bold">{formatKr(totalSales, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.clubEarned}</p>
            <p className="text-2xl font-bold text-success">
              {formatKr(teamShare, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tFill(c.percentMargin, { n: marginPercent })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.rootsShare}</p>
            <p className="text-2xl font-bold">{formatKr(rootsShare, locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.campaigns}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeOrEnded.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.noCampaignYet}{" "}
              <LocaleLink href="/forening" className="underline underline-offset-4">
                {t.startFirstCampaign}
              </LocaleLink>
              .
            </p>
          ) : (
            activeOrEnded.map((c: Campaign) => {
              const busy = actingId === c.id;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      <Badge variant={statusVariant(c.status)}>
                        {statusLabel(c.status, locale)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tFill(t.marginLabel, { n: c.marginPercent })}
                      {c.endDate
                        ? ` · ${tFill(t.endDateLabel, { date: c.endDate })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status === "ACTIVE" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void endCampaign(c.id, c.name)}
                      >
                        {busy && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t.endCampaign}
                      </Button>
                    )}
                    {c.status === "ENDED" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void generateSettlement(c.id)}
                      >
                        {busy && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t.generateSettlement}
                      </Button>
                    )}
                    {c.status === "SETTLED" && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {statusLabel("SETTLED", locale)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t.payouts}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t.payoutsEmpty}
            </p>
          ) : (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {p.campaignName || c.campaignFallback}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tFill(t.yourShare, {
                        amount: formatKr(p.teamShareOre, locale),
                      })}
                      {p.paymentReference
                        ? ` · Ref ${p.paymentReference}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(p.status)}>
                    {statusLabel(p.status, locale)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.perTeamLive}</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.noTeamsYet}</p>
          ) : (
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
                        {pluralSv(team.orderCount, c.orderSingular, c.orderPlural)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatKr(team.totalSalesOre, locale)}
                      </p>
                      <p className="text-xs text-success">
                        +{formatKr(teamEarned, locale)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
