"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataSourceBadge } from "@/components/data-source-badge";
import { portalFetch } from "@/lib/portal-api";
import { apiFetch } from "@/lib/api";
import { LoadError } from "@/components/load-error";
import {
  Users,
  ShoppingCart,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Target,
  FileText,
  Building2,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  Handshake,
  ShieldAlert,
} from "lucide-react";
import { usePortalUser } from "@/lib/portal-context";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

/**
 * Formen på `/portal/dashboard`. Backend returnerar olika fält beroende på
 * rollen (klubb, sälj, admin), så allt är optional och varje dashboard läser
 * bara sina egna fält — men vi slipper `any` och får stavfel fångade.
 */
type DashboardStats = {
  // Klubb
  members?: number;
  orders?: number;
  revenue?: string;
  nextDelivery?: string;
  activity?: Array<{ text: string; time: string }>;
  // Sälj
  activeClubs?: number;
  openQuotes?: number;
  closedThisMonth?: number;
  pipelineValue?: string;
  pipeline?: Array<{ stage: string; count: number; active: boolean }>;
  topClubs?: Array<{ name: string; orders: number; revenue: string }>;
  // Intern admin
  totalOrders?: number;
  totalClubs?: number;
  mrr?: string;
  hairConversion?: string;
  leaderboard?: Array<{
    name: string;
    clubs: number;
    revenue: string;
    trend: string;
  }>;
  systemHealth?: Array<{ name: string; status: string; ok: boolean }>;
  recentActivity?: Array<{ text: string; time: string; type: string }>;
};

type DashboardResponse = {
  role: string;
  isDemo?: boolean;
  stats?: DashboardStats;
};

type StatCard = {
  label: string;
  value: string;
  icon: typeof Users;
};

/* ─── Club Dashboard ───────────────────────────────────────── */

function ClubDashboard({ name }: { name: string }) {
  const { locale } = useLocale();
  const t = portalPages.overview[locale];
  const [stats, setStats] = useState<StatCard[]>([]);
  const [activity, setActivity] = useState<
    Array<{ text: string; time: string }>
  >([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setStats([
      { label: t.activeMembers, value: "—", icon: Users },
      { label: t.ordersThisMonth, value: "—", icon: ShoppingCart },
      { label: t.revenueToClub, value: "—", icon: TrendingUp },
      { label: t.nextDelivery, value: "—", icon: CalendarDays },
    ]);
  }, [t]);

  useEffect(() => {
    portalFetch<DashboardResponse>("/dashboard")
      .then((data) => {
        if (data.stats) {
          const s = data.stats;
          if (s.members !== undefined) {
            setStats([
              {
                label: t.activeMembers,
                value: String(s.members),
                icon: Users,
              },
              {
                label: t.ordersThisMonth,
                value: String(s.orders ?? "0"),
                icon: ShoppingCart,
              },
              {
                label: t.revenueToClub,
                value:
                  s.revenue ??
                  (locale === "en" ? "SEK 0" : "0 kr"),
                icon: TrendingUp,
              },
              {
                label: t.nextDelivery,
                value: s.nextDelivery ?? "—",
                icon: CalendarDays,
              },
            ]);
          }
          if (s.activity?.length) setActivity(s.activity);
        }
      })
      .catch(() => setLoadError(true));
  }, [t]);

  const quickActions = [
    {
      label: t.orderAgain,
      href: "/portal/bestallningar",
      icon: ShoppingCart,
    },
    { label: t.inviteMember, href: "/portal/medlemmar", icon: Users },
    {
      label: t.seeRevenueReport,
      href: "/portal/intakter",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="page-enter space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {tFill(t.clubWelcome, { name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.clubSubtitle}</p>
      </div>

      {loadError && <LoadError message={t.loadError} inline />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="font-semibold">{t.recentActivity}</h2>
            <div className="mt-4 divide-y divide-border">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noActivity}</p>
              ) : (
                activity.map((item) => (
                  <div
                    key={`${item.time}-${item.text}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm">{item.text}</span>
                    <span className="shrink-0 pl-4 text-xs tabular-nums text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.quickActions}</h2>
              <div className="mt-4 space-y-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.href}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl px-4 py-3 text-sm font-normal hover:bg-brand-50"
                    asChild
                  >
                    <LocaleLink
                      href={action.href}
                      className="flex items-center gap-3"
                    >
                      <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left">{action.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </LocaleLink>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-2 border-l-brand-300">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <div>
                  <h3 className="text-sm font-semibold">{t.aiTipTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t.aiTipBody}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Sales Dashboard ──────────────────────────────────────── */

function SalesDashboard({ name }: { name: string }) {
  const { locale } = useLocale();
  const t = portalPages.overview[locale];
  const stages = portalShared[locale].stages;
  const [stats, setStats] = useState<StatCard[]>([]);
  const [pipeline, setPipeline] = useState<
    Array<{ stage: string; count: number; active: boolean }>
  >([]);
  const [topClubs, setTopClubs] = useState<
    Array<{ name: string; orders: number; revenue: string }>
  >([]);
  const [isDemo, setIsDemo] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const pipelineStages = [
    { code: "LEAD", label: stages.LEAD },
    { code: "DRAFT", label: stages.DRAFT },
    { code: "SENT", label: stages.SENT },
    { code: "ACCEPTED", label: stages.ACCEPTED },
  ] as const;

  useEffect(() => {
    setStats([
      { label: t.activeClubs, value: "—", icon: Building2 },
      { label: t.openQuotes, value: "—", icon: FileText },
      { label: t.closedThisMonth, value: "—", icon: CheckCircle2 },
      { label: t.pipelineValue, value: "—", icon: TrendingUp },
    ]);
    setPipeline(
      pipelineStages.map(({ label }) => ({
        stage: label,
        count: 0,
        active: false,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild labels when locale copy changes
  }, [t, stages.LEAD, stages.DRAFT, stages.SENT, stages.ACCEPTED]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dash, pipe] = await Promise.all([
          portalFetch<DashboardResponse>("/dashboard"),
          portalFetch<{
            stages?: Array<{ stage: string; count: number }>;
          }>("/pipeline").catch(() => null),
        ]);
        if (cancelled) return;

        setIsDemo(dash.isDemo ?? false);
        if (dash.stats) {
          const s = dash.stats;
          if (s.activeClubs !== undefined) {
            setStats([
              {
                label: t.activeClubs,
                value: String(s.activeClubs),
                icon: Building2,
              },
              {
                label: t.openQuotes,
                value: String(s.openQuotes ?? "0"),
                icon: FileText,
              },
              {
                label: t.closedThisMonth,
                value: String(s.closedThisMonth ?? "0"),
                icon: CheckCircle2,
              },
              {
                label: t.pipelineValue,
                value:
                  s.pipelineValue ??
                  (locale === "en" ? "SEK 0" : "0 kr"),
                icon: TrendingUp,
              },
            ]);
          }
          if (s.topClubs?.length) setTopClubs(s.topClubs);
        }

        if (pipe?.stages?.length) {
          const counts = new Map(
            pipe.stages.map((row) => [row.stage, Number(row.count) || 0])
          );
          setPipeline(
            pipelineStages.map(({ code, label }) => {
              const count = counts.get(code) ?? 0;
              return { stage: label, count, active: count > 0 };
            })
          );
        } else if (dash.stats?.pipeline?.length) {
          setPipeline(dash.stats.pipeline);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tFill(t.salesHello, { name })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.salesSubtitle}</p>
        </div>
        <DataSourceBadge demo={isDemo} />
      </div>

      {loadError && <LoadError message={t.loadError} inline />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="font-semibold">{t.pipelineOverview}</h2>
            <div className="mt-6 flex items-center justify-between">
              {pipeline.map((p, i) => (
                <div key={p.stage} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        p.active
                          ? "border-inverse-surface bg-inverse-surface text-inverse-on-surface"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {p.count}
                    </div>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {p.stage}
                    </p>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div className="mx-1 h-px flex-1 bg-brand-200" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t.topClubs}
              </h3>
              {topClubs.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t.topClubsEmpty}
                </p>
              ) : (
                <div className="mt-3 divide-y divide-border">
                  {topClubs.map((c, i) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-brand-500">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tFill(t.ordersCount, { count: c.orders })}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{c.revenue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.quickActions}</h2>
              <div className="mt-4 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  asChild
                >
                  <LocaleLink href="/portal/pipeline">
                    <Target className="h-4 w-4" />
                    {t.viewPipeline}
                  </LocaleLink>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  asChild
                >
                  <LocaleLink href="/portal/offerter">
                    <FileText className="h-4 w-4" />
                    {t.createQuote}
                  </LocaleLink>
                </Button>
              </div>
            </CardContent>
          </Card>

          {!isDemo && (
            <Card className="border-l-2 border-l-brand-300">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  <div>
                    <h3 className="text-sm font-semibold">{t.aiInsightTitle}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {tFill(t.aiInsightBody, { name })}
                    </p>
                    <Button size="sm" className="mt-3 h-8" asChild>
                      <LocaleLink href="/portal/pipeline">
                        {t.goToPipeline}
                      </LocaleLink>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function adminActivityIcon(type: string) {
  switch (type) {
    case "order":
      return ShoppingCart;
    case "deal":
      return Handshake;
    case "club":
      return Building2;
    case "ai":
      return Sparkles;
    default:
      return Clock;
  }
}

/* ─── Admin Dashboard ──────────────────────────────────────── */

function AdminDashboard({ name }: { name: string }) {
  const { locale } = useLocale();
  const t = portalPages.overview[locale];
  const [stats, setStats] = useState<StatCard[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ name: string; clubs: number; revenue: string; trend: string }>
  >([]);
  const [systemHealth, setSystemHealth] = useState<
    Array<{ name: string; status: string; ok: boolean }>
  >([
    { name: "API", status: "—", ok: true },
    { name: "Redis", status: "—", ok: true },
    { name: "AI / Open Claw", status: "—", ok: true },
  ]);
  const [recentActivity, setRecentActivity] = useState<
    Array<{ text: string; time: string; type: string }>
  >([]);
  const [isDemo, setIsDemo] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    setStats([
      { label: t.totalOrders, value: "—", icon: ShoppingCart },
      { label: t.mrrPaid, value: "—", icon: TrendingUp },
      { label: t.activeClubs, value: "—", icon: Building2 },
      { label: t.hairConversion, value: "—", icon: Zap },
    ]);
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await portalFetch<DashboardResponse>("/dashboard");
        if (cancelled) return;
        setIsDemo(data.isDemo ?? false);
        if (data.stats) {
          const s = data.stats;
          if (s.totalOrders !== undefined) {
            setStats([
              {
                label: t.totalOrders,
                value: String(s.totalOrders ?? 0),
                icon: ShoppingCart,
              },
              {
                label: t.mrrPaid,
                value: s.mrr ?? "—",
                icon: TrendingUp,
              },
              {
                label: t.activeClubs,
                value: String(s.activeClubs ?? s.totalClubs ?? 0),
                icon: Building2,
              },
              {
                label: t.hairConversion,
                value: s.hairConversion ?? "—",
                icon: Zap,
              },
            ]);
          }
          if (s.leaderboard?.length) setLeaderboard(s.leaderboard);
          if (s.systemHealth?.length) setSystemHealth(s.systemHealth);
          if (s.recentActivity?.length) setRecentActivity(s.recentActivity);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    async function loadPending() {
      try {
        const res = await apiFetch<{ organizations?: unknown[] }>(
          "/v1/admin/organizations/pending"
        );
        if (!cancelled && res.ok) {
          setPendingCount(res.data.organizations?.length ?? 0);
        }
      } catch {
        // non-fatal — the dedicated page still works
      }
    }

    void load();
    void loadPending();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tFill(t.adminHello, { name })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.adminSubtitle}</p>
        </div>
        <DataSourceBadge demo={isDemo} />
      </div>

      {loadError && <LoadError message={t.loadError} inline />}

      {pendingCount !== null && pendingCount > 0 && (
        <Card className="border-warning-edge bg-warning-surface/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
              <div>
                <p className="font-semibold text-warning-strong">
                  {tFill(
                    pendingCount === 1
                      ? t.pendingReviewOne
                      : t.pendingReviewMany,
                    { count: pendingCount }
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.pendingReviewBody}
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <LocaleLink href="/portal/granskning">{t.openReview}</LocaleLink>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.sellersLeaderboard}</h2>
              {leaderboard.length === 0 && (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t.sellersEmpty}
                </p>
              )}
              <div className="mt-4 divide-y divide-border">
                {leaderboard.map((s, i) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-brand-500">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tFill(t.clubsCount, { count: s.clubs })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{s.revenue}</p>
                      <Badge variant="success" className="text-[10px]">
                        {s.trend}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.recentEvents}</h2>
              {recentActivity.length === 0 && (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t.recentEventsEmpty}
                </p>
              )}
              <div className="mt-3 divide-y divide-border">
                {recentActivity.map((a) => {
                  const Icon = adminActivityIcon(a.type);
                  return (
                    <div
                      key={a.text}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-brand-400" />
                        <span className="text-sm">{a.text}</span>
                      </div>
                      <span className="shrink-0 pl-4 text-xs tabular-nums text-muted-foreground">
                        {a.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.systemStatus}</h2>
              <div className="mt-4 space-y-3">
                {systemHealth.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${s.ok ? "bg-success" : "bg-destructive"}`}
                      />
                      <span className="text-sm">{s.name}</span>
                    </div>
                    <Badge
                      variant={s.ok ? "success" : "destructive"}
                      className="text-[10px]"
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {!isDemo && (
            <Card className="border-l-2 border-l-brand-300">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  <div>
                    <h3 className="text-sm font-semibold">{t.aiSummaryTitle}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {t.aiSummaryBody}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">{t.quickLinks}</h2>
              <div className="mt-4 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  asChild
                >
                  <LocaleLink href="/portal/system">
                    <Activity className="h-4 w-4" />
                    {t.systemOverview}
                  </LocaleLink>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  asChild
                >
                  <LocaleLink href="/portal/saljare">
                    <Users className="h-4 w-4" />
                    {t.manageSellers}
                  </LocaleLink>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export default function PortalDashboard() {
  const user = usePortalUser();
  const firstName = user.name.split(" ")[0];

  if (user.role === "CLUB_ADMIN" || user.role === "CLUB_MEMBER") {
    return <ClubDashboard name={firstName} />;
  }
  if (user.role === "SALES_REP" || user.role === "SALES_ADMIN") {
    return <SalesDashboard name={firstName} />;
  }
  return <AdminDashboard name={firstName} />;
}
