"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Search, Smartphone, Tablet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

type Kind = "all" | "pages" | "clicks";
type Hours = 1 | 24 | 168;

type Row = {
  id: string;
  kind: "page" | "click";
  path: string;
  label: string | null;
  href: string | null;
  source: string | null;
  device: string | null;
  at: string;
};

type TrafficData = {
  rows: Row[];
  total: number;
  last5m: number;
  pageViews: number;
  clicks: number;
  topPages: { path: string; count: number }[];
};

const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "Alla" },
  { id: "pages", label: "Sidvisningar" },
  { id: "clicks", label: "Klick" },
];

const WINDOWS: { hours: Hours; label: string }[] = [
  { hours: 1, label: "Senaste timmen" },
  { hours: 24, label: "Senaste dygnet" },
  { hours: 168, label: "7 dagar" },
];

const PAGE_NAMES: Record<string, string> = {
  "/": "Startsidan",
  "/produkter": "Produkter",
  "/guider": "Guider",
  "/om-oss": "Om oss",
  "/kontakt": "Kontakt",
  "/sa-har-gar-det-till": "Så här går det till",
  "/sa-fungerar-det": "Så fungerar det",
  "/klubbar": "Klubbar",
  "/hjalp": "Hjälp",
  "/haranalys": "Håranalys",
  "/intresseanmalan": "Intresseanmälan",
  "/prova": "Prova demon",
  "/villkor": "Villkor",
  "/integritet": "Integritetspolicy",
  "/foreningsliv": "Föreningsliv",
};

function pageName(path: string): string {
  const en = /^\/en(?=\/|$)/.test(path);
  const bare = path.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "") || "/";
  const suffix = en ? " (EN)" : "";
  if (PAGE_NAMES[bare]) return PAGE_NAMES[bare] + suffix;
  const shop = bare.match(/^\/shop\/([^/]+)(\/kassa)?$/);
  if (shop) return `${shop[2] ? "Kassa" : "Shop"}: ${shop[1]}${suffix}`;
  const sub = bare.match(/^\/(produkter|guider|hjalp|klubbar)\/(.+)$/);
  if (sub) return `${PAGE_NAMES[`/${sub[1]}`]}: ${decodeURIComponent(sub[2])}${suffix}`;
  return bare + suffix;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso: string, now: number): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 10) return "nu";
  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

function DeviceIcon({ device }: { device: string | null }) {
  const Icon = device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
  const label = device === "mobile" ? "Mobil" : device === "tablet" ? "Surfplatta" : "Dator";
  return <Icon className="h-4 w-4 text-muted-foreground" aria-label={label} />;
}

function Chip({
  on,
  onClick,
  children,
  small,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full font-semibold transition-colors",
        small ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
        on
          ? "bg-inverse-surface text-inverse-on-surface"
          : "bg-background text-foreground ring-1 ring-inset ring-border hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export default function TrafficPage() {
  const [kind, setKind] = useState<Kind>("all");
  const [hours, setHours] = useState<Hours>(24);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [path, setPath] = useState("");
  const [data, setData] = useState<TrafficData | null>(null);
  const [live, setLive] = useState(true);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const seenRef = useRef(new Set<string>());
  const firstPoll = useRef(true);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ kind, hours: String(hours) });
    if (qDebounced) p.set("q", qDebounced);
    if (path) p.set("path", path);
    return p.toString();
  }, [kind, hours, qDebounced, path]);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    const { ok, status, data: next } = await apiFetch<TrafficData>(`/v1/admin/traffic?${query}`);
    if (status === 401) {
      setError("Sessionen har gått ut. Logga in igen.");
      setLive(false);
      return;
    }
    if (!ok) {
      setError("Kunde inte uppdatera just nu.");
      return;
    }
    const incoming = next.rows.filter((r) => !seenRef.current.has(r.id));
    if (!firstPoll.current && incoming.length > 0) {
      setFreshIds(new Set(incoming.map((r) => r.id)));
      window.setTimeout(() => setFreshIds(new Set()), 2500);
    }
    firstPoll.current = false;
    for (const r of next.rows) seenRef.current.add(r.id);
    setData(next);
    setError("");
    setNow(Date.now());
  }, [query]);

  useEffect(() => {
    firstPoll.current = true;
    seenRef.current = new Set();
    const t = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, refresh]);

  const rows = data?.rows ?? [];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Trafik
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            Sidvisningar och klick på de publika sidorna i realtid. Anonymt — ingen
            cookie, ingen IP-adress och inget som pekar ut en besökare sparas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-inset ring-border">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                live ? "bg-success motion-safe:animate-pulse" : "bg-muted-foreground"
              )}
              aria-hidden
            />
            {live ? "Live" : "Pausad"}
          </span>
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="rounded-full bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-border hover:bg-muted"
          >
            {live ? "Pausa" : "Fortsätt"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Senaste 5 min", value: data?.last5m },
          { label: "Sidvisningar i perioden", value: data?.pageViews },
          { label: "Klick i perioden", value: data?.clicks },
          {
            label: "Klick per sidvisning",
            value:
              data && data.pageViews > 0
                ? (data.clicks / data.pageViews).toLocaleString("sv-SE", {
                    maximumFractionDigits: 1,
                  })
                : undefined,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-background p-4 ring-1 ring-inset ring-border">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {s.value === undefined
                ? "–"
                : typeof s.value === "number"
                  ? s.value.toLocaleString("sv-SE")
                  : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Chip key={k.id} on={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </Chip>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((w) => (
            <Chip key={w.hours} on={hours === w.hours} onClick={() => setHours(w.hours)}>
              {w.label}
            </Chip>
          ))}
        </div>
      </div>

      <label className="relative mt-3 block w-full sm:max-w-sm">
        <span className="sr-only">Sök sida, knapp, länk eller källa</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök sida, knapp, länk eller källa"
          className="h-10 w-full rounded-full bg-background pl-9 pr-4 text-sm text-foreground ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {data && data.topPages.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Mest besökta sidor</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topPages.map((p) => (
              <Chip
                key={p.path}
                small
                on={path === p.path}
                onClick={() => setPath(path === p.path ? "" : p.path)}
              >
                {pageName(p.path)} · {p.count.toLocaleString("sv-SE")}
              </Chip>
            ))}
            {path && !data.topPages.some((p) => p.path === path) && (
              <Chip small on onClick={() => setPath("")}>
                {pageName(path)} ×
              </Chip>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="mt-4 text-[13px] text-muted-foreground">
        {data
          ? `${data.total.toLocaleString("sv-SE")} händelser i urvalet${
              data.total > rows.length ? ` · visar de ${rows.length} senaste` : ""
            }`
          : "Laddar…"}
      </p>

      <div className="mt-2 overflow-x-auto rounded-2xl bg-background ring-1 ring-inset ring-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Tid</th>
              <th className="px-4 py-3 font-semibold">Typ</th>
              <th className="px-4 py-3 font-semibold">Sida</th>
              <th className="px-4 py-3 font-semibold">Knapp / länk / källa</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Enhet</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border align-top transition-colors duration-700 last:border-0",
                  freshIds.has(row.id) ? "bg-brand-100/70" : "hover:bg-muted/50"
                )}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium tabular-nums text-foreground">
                    {formatRelative(row.at, now)}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatClock(row.at)}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      row.kind === "click"
                        ? "bg-brand-200/70 text-brand-900"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {row.kind === "click" ? "Klick" : "Sidvisning"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={row.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {pageName(row.path)}
                  </a>
                  <div className="mt-0.5 max-w-[260px] truncate text-xs text-muted-foreground">
                    {row.path}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.kind === "click" ? (
                    <>
                      <div className="font-medium text-foreground">{row.label || "Knapp"}</div>
                      {row.href && (
                        <div className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground">
                          → {row.href.startsWith("/") ? pageName(row.href) : row.href}
                        </div>
                      )}
                    </>
                  ) : row.source ? (
                    <span className="text-muted-foreground">Från {row.source}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <DeviceIcon device={row.device} />
                </td>
              </tr>
            ))}
            {data && rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                  Inga sidvisningar eller klick i urvalet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
