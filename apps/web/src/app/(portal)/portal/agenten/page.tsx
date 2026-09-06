"use client";

/**
 * INTERNAL_ADMIN — agentens karta, tavla och puls.
 * GET/PATCH /v1/admin/orchestrator. Inte chatten på /portal/ai.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadError } from "@/components/load-error";
import { apiFetch } from "@/lib/api";
import { usePortalUser } from "@/lib/portal-context";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import {
  CheckCircle2,
  Loader2,
  Network,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";

type Gate = "none" | "deploy" | "irreversible" | "email" | "money";
type CardStatus = "inbox" | "ready" | "doing" | "blocked" | "done";

type WorkboardCard = {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  domainId: string;
  playbook: string;
  files: string[];
  gate: Gate;
  source: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
};

type GraphNode = {
  id: string;
  label: string;
  layer: string;
  x: number;
  y: number;
  blurb: string;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

type BoardResponse = {
  cards: WorkboardCard[];
  memoryExcerpt: string;
  lastRun: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    status: string;
    summary: string;
    findings: number;
  } | null;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  pulse: Record<string, number>;
};

const POLL_MS = 20_000;

function gateTone(gate: Gate): string {
  if (gate === "irreversible" || gate === "money")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (gate === "deploy" || gate === "email")
    return "bg-warning-surface text-warning-strong border-warning-edge";
  return "bg-muted text-muted-foreground border-border";
}

function statusTone(status: CardStatus): string {
  if (status === "done") return "bg-success/15 text-success border-success/40";
  if (status === "blocked")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "doing") return "bg-brand-50 text-brand-700 border-brand-200";
  return "bg-muted text-muted-foreground border-border";
}

function AgentMap({
  graph,
  pulse,
  openDomains,
  label,
}: {
  graph: BoardResponse["graph"];
  pulse: Record<string, number>;
  openDomains: Set<string>;
  label: string;
}) {
  const nodeById = useMemo(
    () => Object.fromEntries(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes]
  );

  return (
    <svg
      viewBox="0 0 100 90"
      className="h-auto w-full"
      role="img"
      aria-label={label}
    >
      {graph.edges.map((edge) => {
        const from = nodeById[edge.from];
        const to = nodeById[edge.to];
        if (!from || !to) return null;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return (
          <g key={edge.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#C9C4B8"
              strokeWidth="0.35"
            />
            <text
              x={mx}
              y={my - 1.4}
              textAnchor="middle"
              fill="#6B6B66"
              fontSize="2.1"
            >
              {edge.label}
            </text>
          </g>
        );
      })}
      {graph.nodes.map((node) => {
        const hot = openDomains.has(node.id) || (pulse[node.id] ?? 0) > 0;
        return (
          <g key={node.id}>
            <rect
              x={node.x - 8}
              y={node.y - 5}
              width="16"
              height="10"
              rx="2"
              fill={hot ? "#6B794F" : "#FAF6EF"}
              stroke={hot ? "#1D1D1B" : "#C9C4B8"}
              strokeWidth="0.35"
            />
            <text
              x={node.x}
              y={node.y + 0.6}
              textAnchor="middle"
              fill={hot ? "#FAF6EF" : "#1D1D1B"}
              fontSize="2.4"
              fontWeight="500"
            >
              {node.label}
            </text>
            {(pulse[node.id] ?? 0) > 0 && (
              <text
                x={node.x + 7.2}
                y={node.y - 3.2}
                textAnchor="middle"
                fill="#6B794F"
                fontSize="2.2"
                fontWeight="600"
              >
                {pulse[node.id]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CardColumn({
  title,
  empty,
  cards,
  t,
  actingId,
  onApprove,
  onReject,
}: {
  title: string;
  empty: string;
  cards: WorkboardCard[];
  t: (typeof portalPages)["agenten"][keyof (typeof portalPages)["agenten"]];
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {card.title}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={statusTone(card.status)}>
                        {card.status}
                      </Badge>
                      <Badge className={gateTone(card.gate)}>
                        {t.gate}: {card.gate}
                      </Badge>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {card.body}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.domain}: {card.domainId} · {t.source}: {card.source}
                  </p>
                  {card.files.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t.files}: {card.files.join(", ")}
                    </p>
                  )}
                  {card.status !== "done" && card.gate !== "none" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actingId === card.id}
                        onClick={() => onApprove(card.id)}
                      >
                        {actingId === card.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {t.approve}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingId === card.id}
                        onClick={() => onReject(card.id)}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        {t.reject}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AgentenPage() {
  const { locale } = useLocale();
  const t = portalPages.agenten[locale];
  const shared = portalShared[locale];
  const user = usePortalUser();
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiFetch<BoardResponse & { error?: string }>(
      "/v1/admin/orchestrator"
    );
    if (!res.ok) {
      setBoard(null);
      setError(
        res.status === 403 ? t.permissionDenied : res.data?.error || t.loadError
      );
      return;
    }
    setBoard(res.data);
  }, [t.loadError, t.permissionDenied]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch(() => {
        if (!cancelled) setError(shared.networkServer);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load, shared.networkServer]);

  async function patch(id: string, action: "approve" | "reject") {
    setActingId(id);
    try {
      const res = await apiFetch<{ card?: WorkboardCard; error?: string }>(
        "/v1/admin/orchestrator",
        { method: "PATCH", body: { id, action } }
      );
      if (!res.ok) {
        setError(res.data?.error || t.loadError);
        return;
      }
      await load();
    } finally {
      setActingId(null);
    }
  }

  if (user.role !== "INTERNAL_ADMIN") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-warning-edge bg-warning-surface p-4"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
        <p className="text-sm text-warning-strong">{t.permissionDenied}</p>
      </div>
    );
  }

  const cards = board?.cards ?? [];
  const needsDecision = cards.filter(
    (c) => c.gate !== "none" && c.status !== "done"
  );
  const inProgress = cards.filter(
    (c) => c.status !== "done" && c.gate === "none"
  );
  const recentlyDone = cards.filter((c) => c.status === "done").slice(0, 8);
  const openDomains = new Set(
    cards.filter((c) => c.status !== "done").map((c) => c.domainId)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Network className="h-5 w-5 text-brand-700" />
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {shared.refresh}
        </Button>
      </div>

      {error && (
        <LoadError message={error} onRetry={() => void load()} />
      )}

      {loading && !board ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : board ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-medium">{t.map}</h2>
                <AgentMap
                  graph={board.graph}
                  pulse={board.pulse}
                  openDomains={openDomains}
                  label={t.map}
                />
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 p-4">
                  <h2 className="text-sm font-medium">{t.lastPulse}</h2>
                  {board.lastRun ? (
                    <>
                      <Badge
                        className={
                          board.lastRun.status === "ok"
                            ? "bg-success/15 text-success border-success/40"
                            : "bg-destructive/10 text-destructive border-destructive/30"
                        }
                      >
                        {board.lastRun.summary || t.pulseOk}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(board.lastRun.startedAt).toLocaleString(
                          locale === "en" ? "en-GB" : "sv-SE"
                        )}
                        {board.lastRun.findings > 0
                          ? ` · ${tFill(t.findings, { count: String(board.lastRun.findings) })}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.neverRun}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h2 className="mb-2 text-sm font-medium">{t.memory}</h2>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
                    {board.memoryExcerpt || "—"}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t.approveHint}</p>

          <div className="grid gap-8 lg:grid-cols-3">
            <CardColumn
              title={t.needsDecision}
              empty={t.emptyDecision}
              cards={needsDecision}
              t={t}
              actingId={actingId}
              onApprove={(id) => void patch(id, "approve")}
              onReject={(id) => void patch(id, "reject")}
            />
            <CardColumn
              title={t.inProgress}
              empty={t.emptyProgress}
              cards={inProgress}
              t={t}
              actingId={actingId}
              onApprove={(id) => void patch(id, "approve")}
              onReject={(id) => void patch(id, "reject")}
            />
            <CardColumn
              title={t.recentlyDone}
              empty={t.emptyDone}
              cards={recentlyDone}
              t={t}
              actingId={actingId}
              onApprove={(id) => void patch(id, "approve")}
              onReject={(id) => void patch(id, "reject")}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
