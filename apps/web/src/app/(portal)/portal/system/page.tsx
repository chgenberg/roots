"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { portalFetch } from "@/lib/portal-api";
import {
  Activity,
  Server,
  Database,
  Cpu,
  Zap,
  Shield,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface ServiceRow {
  name: string;
  status: string;
  uptime: string;
  latency: string;
  ok: boolean;
  icon: typeof Server;
}

interface AiUsageRow {
  tokensToday: string | null;
  tokensMonth: string | null;
  sessions: string | null;
  avgResponseTime: string | null;
  model: string;
}

interface RateLimitRow {
  endpoint: string;
  limit: string;
  current: string | null;
  ok: boolean;
}

interface RecentEventRow {
  text: string;
  time: string;
  type: string;
}

const SERVICE_ICON_MAP: Record<string, typeof Server> = {
  "API (Express)": Server,
  PostgreSQL: Database,
  Redis: Database,
  "AI / Open Claw": Cpu,
};

export default function SystemPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageRow | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitRow[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEventRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch<{
      services?: Array<Omit<ServiceRow, "icon">>;
      aiUsage?: AiUsageRow;
      rateLimits?: RateLimitRow[];
      recentEvents?: RecentEventRow[] | null;
    }>("/system")
      .then((data) => {
        setServices(
          (data.services ?? []).map((s) => ({
            ...s,
            icon: SERVICE_ICON_MAP[s.name] || Server,
          }))
        );
        setAiUsage(data.aiUsage ?? null);
        setRateLimits(data.rateLimits ?? []);
        setRecentEvents(data.recentEvents ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Systemhälsa, AI-användning och driftstatus.
        </p>
      </div>

      {/* Service health */}
      {services.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <Card key={s.name}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${s.ok ? "bg-success" : "bg-destructive"}`}
                    />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Uptime</p>
                    <p className="text-sm font-semibold">{s.uptime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Latens</p>
                    <p className="text-sm font-semibold">{s.latency}</p>
                  </div>
                </div>
                <Badge
                  variant={s.ok ? "success" : "destructive"}
                  className="mt-3 text-[10px]"
                >
                  {s.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {loading ? "Hämtar systemstatus…" : "Ingen systemstatus tillgänglig."}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI token usage */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-500" />
              <h2 className="font-semibold">AI-användning</h2>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Tokens idag</p>
                <p className="mt-1 text-lg font-bold">{aiUsage?.tokensToday ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Tokens denna månad</p>
                <p className="mt-1 text-lg font-bold">{aiUsage?.tokensMonth ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Chattsessioner idag</p>
                <p className="mt-1 text-lg font-bold">{aiUsage?.sessions ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Snitt svarstid</p>
                <p className="mt-1 text-lg font-bold">{aiUsage?.avgResponseTime ?? "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              Modell: {aiUsage?.model ?? "—"}
            </div>
            {!aiUsage?.tokensToday && !loading && (
              <p className="mt-3 text-xs text-muted-foreground/80">
                Token-mätning aktiveras automatiskt när AI-spårning är på.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rate limits */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-400" />
              <h2 className="font-semibold">Rate Limits</h2>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              {rateLimits.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Inga rate-limit-mätare aktiva.
                </p>
              )}
              {rateLimits.map((r) => {
                const currentNum = r.current ? parseInt(r.current) : null;
                const limitNum = parseInt(r.limit);
                const pct =
                  currentNum !== null && Number.isFinite(currentNum) && limitNum > 0
                    ? Math.round((currentNum / limitNum) * 100)
                    : null;
                return (
                  <div key={r.endpoint}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.endpoint}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.current ?? "—"} / {r.limit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-brand-100">
                      {pct !== null && (
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-destructive" : pct > 50 ? "bg-brand-500" : "bg-success"}`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Senaste systemhändelser</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(recentEvents?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Inga händelser registrerade ännu. Listan fylls på när audit-spåret skrivs till.
              </p>
            ) : (
              recentEvents!.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {e.type === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-brand-500" />
                    ) : (
                      <Activity className="h-4 w-4 text-brand-400" />
                    )}
                    <span className="text-sm">{e.text}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
