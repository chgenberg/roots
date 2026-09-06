"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { milestoneLabel, milestoneRemaining } from "@/i18n/milestones";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { absoluteLocaleUrl } from "@/i18n/paths";
import { LocaleLink } from "@/components/locale-link";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniTrendCard } from "@/components/charts/mini-trend-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy,
  CheckCircle2,
  Loader2,
  Trophy,
  Award,
  Star,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { GradeBadge } from "@/components/seller-grade";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import type { TeamDashboard as TeamDashboardData, Seller, Milestone, CustomerOrder } from "@/types/fundraising";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import { formatKr, formatKrValue, pluralSv } from "@/lib/format";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-status";
import { getPublicSiteUrl } from "@/lib/site-url";

const PODIUM_ICONS = ["🥇", "🥈", "🥉"];

const API_URL = getBrowserApiBase();

export default function TeamDashboard() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.teamDashboard[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;

  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async (silent = false) => {
    try {
      const myTeamRes = await rootsFetch(`${API_URL}/v1/dashboard/my-team`);
      if (!myTeamRes.ok) {
        if (!silent) setError(t.loadFailed);
        return;
      }
      const { teamId } = await myTeamRes.json();

      const teamRes = await rootsFetch(`${API_URL}/v1/dashboard/team/${teamId}`);
      if (teamRes.ok) {
        setData(await teamRes.json());
      } else if (!silent) {
        setError(t.loadFailed);
      }
    } catch {
      if (!silent) setError(c.networkError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Live-uppdatering var 20:e sekund så topplista och ordrar uppdateras
    // i realtid medan säljarna jobbar.
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, [load]);

  function copyInviteLink() {
    if (!data?.team?.inviteToken) return;
    const url = absoluteLocaleUrl(
      getPublicSiteUrl(),
      `/registrera/saljare/${data.team.inviteToken}`,
      locale
    );
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(c.copyLinkFailed, "error");
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

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">
          {c.contactAdmin}
        </p>
      </div>
    );
  }

  const sellers = data?.sellers || [];
  const totalSales = data?.stats?.totalSalesOre || 0;
  const teamEarnings = data?.stats?.teamEarningsOre || 0;
  const marginPercent = data?.stats?.marginPercent || 0;
  const orders = data?.orders || [];
  const milestones = data?.milestones;
  const sortedSellers = [...sellers].sort(
    (a: Seller, b: Seller) => b.totalSalesOre - a.totalSalesOre
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {data?.team?.name || t.titleFallback}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.campaign?.name || ""}
        </p>
      </div>

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
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-brand-400" />
              <p className="text-xs text-muted-foreground sm:text-sm">{t.teamEarnings}</p>
            </div>
            <p className="mt-1 text-xl font-bold text-brand-700 sm:text-2xl">
              {formatKr(teamEarnings, locale)}
            </p>
            {marginPercent > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {tFill(c.percentMargin, { n: marginPercent })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.orders}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">{c.sellers}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{sellers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Försäljningstrend */}
      {data.team?.id && (
        <MiniTrendCard
          path={`/v1/dashboard/team/${data.team.id}/stats`}
          href="/lag/statistik"
        />
      )}

      {/* Milestones */}
      {milestones && (milestones.achieved?.length > 0 || milestones.next) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-500" />
              {c.milestones}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {milestones.next && (
              <div className="rounded-lg bg-brand-50 p-3 flex items-center gap-3">
                <Star className="h-5 w-5 text-brand-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{tFill(c.nextMilestone, { label: milestoneLabel(milestones.next.id ?? milestones.next.label, locale) })}</p>
                  <p className="text-xs text-muted-foreground">{milestoneRemaining(milestones.next.remaining, locale)}</p>
                </div>
              </div>
            )}
            {milestones.achieved?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {milestones.achieved.map((m: Milestone) => (
                  <Badge
                    key={m.id}
                    className="bg-brand-100 text-brand-700 text-xs py-1"
                  >
                    <Award className="h-3 w-3 mr-1" />
                    {milestoneLabel(m.id, locale, m.label)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite link */}
      {data?.team?.inviteToken && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium">
              {t.invitePlayers}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={absoluteLocaleUrl(
                  getPublicSiteUrl(),
                  `/registrera/saljare/${data.team.inviteToken}`,
                  locale
                )}
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={copyInviteLink}>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seller leaderboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.sellerRanking}</CardTitle>
          <Trophy className="h-4 w-4 text-brand-500" />
        </CardHeader>
        <CardContent>
          {sortedSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.noSellersYet}
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSellers.map((seller: Seller, i: number) => (
                <div
                  key={seller.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span
                    className={`w-6 text-center shrink-0 text-sm font-bold ${
                      i < 3 ? "text-brand-700" : "text-muted-foreground"
                    }`}
                  >
                    {i < 3 ? PODIUM_ICONS[i] : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {seller.displayName}
                      </p>
                      <GradeBadge grade={seller.grade} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pluralSv(seller.orderCount, c.orderSingular, c.orderPlural)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">
                    {formatKr(seller.totalSalesOre, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{c.recentOrders}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {c.noOrdersYet}
            </p>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 10).map((order: CustomerOrder) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setDetailOrderId(order.id);
                    setDetailOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-brand-50/60"
                  aria-label={tFill(c.viewOrderDetails, { name: order.customerName })}
                >
                  <div>
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${orderStatusColor(order.status)}`}
                      >
                        {orderStatusLabel(order.status, locale)}
                      </Badge>
                      {order.deliveryType === "DIRECT" && (
                        <Badge variant="secondary" className="text-xs">
                          {c.directDelivery}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatKr(order.totalOre, locale)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
        // Avbokning tar summan ur lagets försäljning, så KPI:erna på den
        // här sidan blir fel om vi bara byter status på raden.
        onStatusChange={() => void load(true)}
      />
    </div>
  );
}
