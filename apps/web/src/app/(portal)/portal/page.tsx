"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataSourceBadge } from "@/components/data-source-badge";
import { portalFetch } from "@/lib/portal-api";
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
} from "lucide-react";
import { usePortalUser } from "@/lib/portal-context";

/* ─── Club Empty State ────────────────────────────────────── */

const EMPTY_CLUB_STATS = [
  { label: "Aktiva medlemmar", value: "—", icon: Users },
  { label: "Beställningar denna månad", value: "—", icon: ShoppingCart },
  { label: "Intäkter till klubben", value: "—", icon: TrendingUp },
  { label: "Nästa leverans", value: "—", icon: CalendarDays },
];

const CLUB_QUICK_ACTIONS = [
  { label: "Beställ igen", href: "/portal/bestallningar", icon: ShoppingCart },
  { label: "Bjud in medlem", href: "/portal/medlemmar", icon: Users },
  { label: "Se intäktsrapport", href: "/portal/intakter", icon: TrendingUp },
];

const EMPTY_CLUB_ACTIVITY: Array<{ text: string; time: string }> = [];

/* ─── Sales Empty State ───────────────────────────────────── */

const EMPTY_SALES_STATS = [
  { label: "Aktiva klubbar", value: "—", icon: Building2 },
  { label: "Offerter ute", value: "—", icon: FileText },
  { label: "Stängda denna månad", value: "—", icon: CheckCircle2 },
  { label: "Pipeline-värde", value: "—", icon: TrendingUp },
];

const EMPTY_SALES_PIPELINE: Array<{ stage: string; count: number; active: boolean }> = [
  { stage: "Lead", count: 0, active: false },
  { stage: "Kontaktad", count: 0, active: false },
  { stage: "Offert", count: 0, active: false },
  { stage: "Stängd", count: 0, active: false },
];

const EMPTY_SALES_TOP_CLUBS: Array<{ name: string; orders: number; revenue: string }> = [];

/* ─── Admin Fallback Data ─────────────────────────────────── */

const FALLBACK_ADMIN_STATS = [
  { label: "Totala ordrar", value: "—", icon: ShoppingCart },
  { label: "MRR (betalda ordrar)", value: "—", icon: TrendingUp },
  { label: "Aktiva klubbar", value: "—", icon: Building2 },
  { label: "Konvertering håranalys", value: "—", icon: Zap },
];

const FALLBACK_ADMIN_LEADERBOARD: Array<{
  name: string;
  clubs: number;
  revenue: string;
  trend: string;
}> = [];

const FALLBACK_ADMIN_SYSTEM_HEALTH = [
  { name: "API", status: "—", ok: true },
  { name: "Redis", status: "—", ok: true },
  { name: "AI / Open Claw", status: "—", ok: true },
];

const FALLBACK_ADMIN_RECENT_ACTIVITY: Array<{
  text: string;
  time: string;
  type: string;
}> = [];

/* ─── Club Dashboard ───────────────────────────────────────── */

function ClubDashboard({ name }: { name: string }) {
  const [stats, setStats] = useState(EMPTY_CLUB_STATS);
  const [activity, setActivity] = useState(EMPTY_CLUB_ACTIVITY);

  useEffect(() => {
    portalFetch<{ role: string; stats: any }>("/dashboard")
      .then((data) => {
        if (data.stats) {
          const s = data.stats;
          if (s.members !== undefined) {
            setStats([
              { label: "Aktiva medlemmar", value: String(s.members), icon: Users },
              { label: "Beställningar denna månad", value: String(s.orders ?? "0"), icon: ShoppingCart },
              { label: "Intäkter till klubben", value: s.revenue ?? "0 kr", icon: TrendingUp },
              { label: "Nästa leverans", value: s.nextDelivery ?? "—", icon: CalendarDays },
            ]);
          }
          if (s.activity?.length) setActivity(s.activity);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="page-enter space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Välkommen, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Här är en översikt av er förening.
        </p>
      </div>

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
            <h2 className="font-semibold">Senaste aktivitet</h2>
            <div className="mt-4 divide-y divide-border">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen aktivitet ännu.</p>
              ) : (
                activity.map((item, i) => (
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
              <h2 className="font-semibold">Snabbåtgärder</h2>
              <div className="mt-4 space-y-2">
                {CLUB_QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.href}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl px-4 py-3 text-sm font-normal hover:bg-brand-50"
                    asChild
                  >
                    <Link href={action.href} className="flex items-center gap-3">
                      <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left">{action.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
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
                  <h3 className="text-sm font-semibold">AI-tips</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Baserat på ert ordermönster kan ni spara tid genom att samla
                    beställningar till en kvartalsleverans.
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
  const [stats, setStats] = useState(EMPTY_SALES_STATS);
  const [pipeline, setPipeline] = useState(EMPTY_SALES_PIPELINE);
  const [topClubs, setTopClubs] = useState(EMPTY_SALES_TOP_CLUBS);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    portalFetch<{ role: string; isDemo?: boolean; stats: any }>("/dashboard")
      .then((data) => {
        setIsDemo(data.isDemo ?? false);
        if (data.stats) {
          const s = data.stats;
          if (s.activeClubs !== undefined) {
            setStats([
              { label: "Aktiva klubbar", value: String(s.activeClubs), icon: Building2 },
              { label: "Offerter ute", value: String(s.openQuotes ?? "0"), icon: FileText },
              { label: "Stängda denna månad", value: String(s.closedThisMonth ?? "0"), icon: CheckCircle2 },
              { label: "Pipeline-värde", value: s.pipelineValue ?? "0 kr", icon: TrendingUp },
            ]);
          }
          if (s.pipeline?.length) setPipeline(s.pipeline);
          if (s.topClubs?.length) setTopClubs(s.topClubs);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hej, {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Din försäljningsöversikt.
          </p>
        </div>
        <DataSourceBadge demo={isDemo} />
      </div>

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
            <h2 className="font-semibold">Pipeline-översikt</h2>
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
                Toppklubbar
              </h3>
              {topClubs.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Listan fylls på när dina klubbar börjar lägga ordrar.
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
                            {c.orders} ordrar
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
              <h2 className="font-semibold">Snabbåtgärder</h2>
              <div className="mt-4 space-y-2">
                <Button variant="secondary" className="w-full justify-start" asChild>
                  <Link href="/portal/pipeline">
                    <Target className="h-4 w-4" />
                    Visa pipeline
                  </Link>
                </Button>
                <Button variant="secondary" className="w-full justify-start" asChild>
                  <Link href="/portal/offerter">
                    <FileText className="h-4 w-4" />
                    Skapa offert
                  </Link>
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
                    <h3 className="text-sm font-semibold">AI-insikt</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {name} — öppna pipeline-sidan för att se uppföljningar
                      som väntar på dig.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 h-8"
                      asChild
                    >
                      <Link href="/portal/pipeline">Gå till pipeline</Link>
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
  const [stats, setStats] = useState(FALLBACK_ADMIN_STATS);
  const [leaderboard, setLeaderboard] = useState(FALLBACK_ADMIN_LEADERBOARD);
  const [systemHealth, setSystemHealth] = useState(FALLBACK_ADMIN_SYSTEM_HEALTH);
  const [recentActivity, setRecentActivity] = useState(
    FALLBACK_ADMIN_RECENT_ACTIVITY
  );
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    portalFetch<{ role: string; isDemo?: boolean; stats: any }>("/dashboard")
      .then((data) => {
        setIsDemo(data.isDemo ?? false);
        if (data.stats) {
          const s = data.stats;
          if (s.totalOrders !== undefined) {
            setStats([
              {
                label: "Totala ordrar",
                value: String(s.totalOrders ?? 0),
                icon: ShoppingCart,
              },
              {
                label: "MRR (betalda ordrar)",
                value: s.mrr ?? "—",
                icon: TrendingUp,
              },
              {
                label: "Aktiva klubbar",
                value: String(s.activeClubs ?? s.totalClubs ?? 0),
                icon: Building2,
              },
              {
                label: "Konvertering håranalys",
                value: s.hairConversion ?? "—",
                icon: Zap,
              },
            ]);
          }
          if (s.leaderboard?.length) setLeaderboard(s.leaderboard);
          if (s.systemHealth?.length) setSystemHealth(s.systemHealth);
          if (s.recentActivity?.length) setRecentActivity(s.recentActivity);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hej, {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Intern adminöversikt — allt på en blick.
          </p>
        </div>
        <DataSourceBadge demo={isDemo} />
      </div>

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
              <h2 className="font-semibold">Säljare — topplista</h2>
              {leaderboard.length === 0 && (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Listan fylls på när säljare börjar registrera ordrar.
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
                          {s.clubs} klubbar
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
              <h2 className="font-semibold">Senaste händelser</h2>
              {recentActivity.length === 0 && (
                <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Inga registrerade händelser ännu. Aktivitet loggas från
                  audit-spåret så snart vi aktiverar audit-skrivning.
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
              <h2 className="font-semibold">Systemstatus</h2>
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
                    <Badge variant={s.ok ? "success" : "destructive"} className="text-[10px]">
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
                    <h3 className="text-sm font-semibold">AI-sammanfattning</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Öppna Statistik för att se veckovis trend och senaste
                      konverteringsdata.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">Snabblänkar</h2>
              <div className="mt-4 space-y-2">
                <Button variant="secondary" className="w-full justify-start" asChild>
                  <Link href="/portal/system">
                    <Activity className="h-4 w-4" />
                    Systemöversikt
                  </Link>
                </Button>
                <Button variant="secondary" className="w-full justify-start" asChild>
                  <Link href="/portal/saljare">
                    <Users className="h-4 w-4" />
                    Hantera säljare
                  </Link>
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
