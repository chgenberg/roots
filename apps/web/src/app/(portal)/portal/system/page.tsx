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

const FALLBACK_SERVICES = [
  {
    name: "API (Express)",
    status: "Operativ",
    uptime: "99.97%",
    latency: "42 ms",
    ok: true,
    icon: Server,
  },
  {
    name: "PostgreSQL",
    status: "Operativ",
    uptime: "99.99%",
    latency: "8 ms",
    ok: true,
    icon: Database,
  },
  {
    name: "Redis",
    status: "Operativ",
    uptime: "99.98%",
    latency: "1 ms",
    ok: true,
    icon: Database,
  },
  {
    name: "AI / Open Claw",
    status: "Operativ",
    uptime: "99.91%",
    latency: "320 ms",
    ok: true,
    icon: Cpu,
  },
];

const FALLBACK_AI_USAGE = {
  tokensToday: "124 500",
  tokensMonth: "2.8M",
  sessions: "342",
  avgResponseTime: "1.8s",
  model: "gpt-5.4-mini",
};

const FALLBACK_RATE_LIMITS = [
  { endpoint: "/v1/ai/public-chat", limit: "60/min", current: "12/min", ok: true },
  { endpoint: "/v1/ai/portal-chat", limit: "120/min", current: "34/min", ok: true },
  { endpoint: "/v1/auth/*", limit: "20/min", current: "8/min", ok: true },
  { endpoint: "/v1/orders", limit: "100/min", current: "5/min", ok: true },
];

const FALLBACK_RECENT_EVENTS = [
  { text: "Deploy v2.4.1 — framgångsrik", time: "14:32", type: "success" },
  { text: "Rate limit nådd: /v1/ai/public-chat (IP: 85.xxx)", time: "13:15", type: "warning" },
  { text: "Redis reconnect — automatisk recovery", time: "11:42", type: "warning" },
  { text: "SSL-certifikat förnyat", time: "09:00", type: "success" },
  { text: "Backup slutförd (PostgreSQL → S3)", time: "03:00", type: "success" },
];

const SERVICE_ICON_MAP: Record<string, typeof Server> = {
  "API (Express)": Server,
  PostgreSQL: Database,
  Redis: Database,
  "AI / Open Claw": Cpu,
};

export default function SystemPage() {
  const [services, setServices] = useState(FALLBACK_SERVICES);
  const [aiUsage, setAiUsage] = useState(FALLBACK_AI_USAGE);
  const [rateLimits, setRateLimits] = useState(FALLBACK_RATE_LIMITS);
  const [recentEvents, setRecentEvents] = useState(FALLBACK_RECENT_EVENTS);

  useEffect(() => {
    portalFetch<{
      services?: any[];
      aiUsage?: typeof FALLBACK_AI_USAGE;
      rateLimits?: any[];
      recentEvents?: any[];
    }>("/system")
      .then((data) => {
        if (data.services?.length) {
          setServices(
            data.services.map((s) => ({
              ...s,
              icon: SERVICE_ICON_MAP[s.name] || Server,
            }))
          );
        }
        if (data.aiUsage) setAiUsage(data.aiUsage);
        if (data.rateLimits?.length) setRateLimits(data.rateLimits);
        if (data.recentEvents?.length) setRecentEvents(data.recentEvents);
      })
      .catch(() => {});
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
                <p className="mt-1 text-lg font-bold">{aiUsage.tokensToday}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Tokens denna månad</p>
                <p className="mt-1 text-lg font-bold">{aiUsage.tokensMonth}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Chattsessioner idag</p>
                <p className="mt-1 text-lg font-bold">{aiUsage.sessions}</p>
              </div>
              <div className="rounded-xl bg-brand-50/50 p-3">
                <p className="text-xs text-muted-foreground">Snitt svarstid</p>
                <p className="mt-1 text-lg font-bold">{aiUsage.avgResponseTime}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              Modell: {aiUsage.model}
            </div>
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
              {rateLimits.map((r) => {
                const currentNum = parseInt(r.current);
                const limitNum = parseInt(r.limit);
                const pct = Math.round((currentNum / limitNum) * 100);
                return (
                  <div key={r.endpoint}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.endpoint}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.current} / {r.limit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-brand-100">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-destructive" : pct > 50 ? "bg-brand-500" : "bg-success"}`}
                        style={{ width: `${pct}%` }}
                      />
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
            {recentEvents.map((e, i) => (
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
