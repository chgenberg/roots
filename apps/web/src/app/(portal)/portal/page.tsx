"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/* ─── Club Fallback Data ──────────────────────────────────── */

const FALLBACK_CLUB_STATS = [
  { label: "Aktiva medlemmar", value: "24", icon: Users },
  { label: "Beställningar denna månad", value: "3", icon: ShoppingCart },
  { label: "Intäkter till klubben", value: "2 450 kr", icon: TrendingUp },
  { label: "Nästa leverans", value: "12 april", icon: CalendarDays },
];

const FALLBACK_CLUB_ACTIONS = [
  { label: "Beställ igen", href: "/portal/bestallningar", icon: ShoppingCart },
  { label: "Bjud in medlem", href: "/portal/medlemmar", icon: Users },
  { label: "Se intäktsrapport", href: "/portal/intakter", icon: TrendingUp },
];

const FALLBACK_CLUB_ACTIVITY = [
  { text: "Anna L. beställde 2 × First Growth", time: "2 tim sedan" },
  { text: "Ny medlem: Erik S. gick med", time: "Igår" },
  { text: "Leverans mottagen — 12 produkter", time: "3 dagar sedan" },
  { text: "Intäktsutbetalning: 1 200 kr", time: "1 vecka sedan" },
];

/* ─── Sales Fallback Data ─────────────────────────────────── */

const FALLBACK_SALES_STATS = [
  { label: "Aktiva klubbar", value: "8", icon: Building2 },
  { label: "Offerter ute", value: "4", icon: FileText },
  { label: "Stängda denna månad", value: "2", icon: CheckCircle2 },
  { label: "Pipeline-värde", value: "45 000 kr", icon: TrendingUp },
];

const FALLBACK_SALES_PIPELINE = [
  { stage: "Lead", count: 6, active: false },
  { stage: "Kontaktad", count: 4, active: false },
  { stage: "Offert", count: 3, active: true },
  { stage: "Stängd", count: 2, active: false },
];

const FALLBACK_SALES_TOP_CLUBS = [
  { name: "Hammarby HK", orders: 12, revenue: "8 400 kr" },
  { name: "Djurgårdens IF Basket", orders: 9, revenue: "6 200 kr" },
  { name: "AIK Simning", orders: 7, revenue: "4 900 kr" },
];

/* ─── Admin Fallback Data ─────────────────────────────────── */

const FALLBACK_ADMIN_STATS = [
  { label: "Totala ordrar", value: "127", icon: ShoppingCart },
  { label: "MRR", value: "34 500 kr", icon: TrendingUp },
  { label: "Aktiva klubbar", value: "23", icon: Building2 },
  { label: "Konvertering håranalys", value: "12.4%", icon: Zap },
];

const FALLBACK_ADMIN_LEADERBOARD = [
  { name: "Erik Lindström", clubs: 8, revenue: "45 000 kr", trend: "+12%" },
  { name: "Sara Björk", clubs: 6, revenue: "38 200 kr", trend: "+8%" },
  { name: "Johan Ek", clubs: 5, revenue: "29 100 kr", trend: "+15%" },
];

const FALLBACK_ADMIN_SYSTEM_HEALTH = [
  { name: "API", status: "Operativ", ok: true },
  { name: "Redis", status: "Operativ", ok: true },
  { name: "AI / Open Claw", status: "Operativ", ok: true },
];

const FALLBACK_ADMIN_RECENT_ACTIVITY = [
  { text: "Hammarby HK — ny beställning (3 200 kr)", time: "12 min sedan", type: "order" },
  { text: "Sara B. stängde Brynäs IF", time: "1 tim sedan", type: "deal" },
  { text: "Ny klubb registrerad: IFK Norrköping", time: "3 tim sedan", type: "club" },
  { text: "AI: 342 chattsessioner idag", time: "Löpande", type: "ai" },
];

/* ─── Club Dashboard ───────────────────────────────────────── */

function ClubDashboard({ name }: { name: string }) {
  const [stats, setStats] = useState(FALLBACK_CLUB_STATS);
  const [activity, setActivity] = useState(FALLBACK_CLUB_ACTIVITY);

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
                    key={i}
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
                {FALLBACK_CLUB_ACTIONS.map((action) => (
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
  const [reminderSent, setReminderSent] = useState(false);
  const [stats, setStats] = useState(FALLBACK_SALES_STATS);
  const [pipeline, setPipeline] = useState(FALLBACK_SALES_PIPELINE);
  const [topClubs, setTopClubs] = useState(FALLBACK_SALES_TOP_CLUBS);

  useEffect(() => {
    portalFetch<{ role: string; stats: any }>("/dashboard")
      .then((data) => {
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hej, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Din försäljningsöversikt.
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

          <Card className="border-l-2 border-l-brand-300">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <div>
                  <h3 className="text-sm font-semibold">AI-insikt</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {name} — 3 offerter har inte fått svar på 7+ dagar.
                    Vill du skicka en påminnelse?
                  </p>
                  {reminderSent ? (
                    <p className="mt-3 text-sm font-medium text-brand-600">
                      Påminnelse registrerad (demo).
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3 h-8"
                      onClick={() => setReminderSent(true)}
                    >
                      Skicka påminnelse
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
  const [recentActivity, setRecentActivity] = useState(FALLBACK_ADMIN_RECENT_ACTIVITY);

  useEffect(() => {
    portalFetch<{ role: string; stats: any }>("/dashboard")
      .then((data) => {
        if (data.stats) {
          const s = data.stats;
          if (s.totalOrders !== undefined) {
            setStats([
              { label: "Totala ordrar", value: String(s.totalOrders), icon: ShoppingCart },
              { label: "MRR", value: s.mrr ?? "0 kr", icon: TrendingUp },
              { label: "Aktiva klubbar", value: String(s.activeClubs ?? "0"), icon: Building2 },
              { label: "Konvertering håranalys", value: s.hairConversion ?? "0%", icon: Zap },
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hej, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Intern adminöversikt — allt på en blick.
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
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">Säljare — topplista</h2>
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
                        className={`h-2 w-2 rounded-full ${s.ok ? "bg-emerald-500" : "bg-red-500"}`}
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

          <Card className="border-l-2 border-l-brand-300">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <div>
                  <h3 className="text-sm font-semibold">AI-sammanfattning</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Konverteringen från håranalys till klubbregistrering
                    ökade 2.1 procentenheter senaste veckan. Topp-kanal: Instagram.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
