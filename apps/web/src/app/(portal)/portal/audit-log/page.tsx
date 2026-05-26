"use client";

/**
 * Internal-admin audit log viewer — Sprint E11.
 *
 * Backed by `GET /v1/admin/audit-log` (INTERNAL_ADMIN-only). The page
 * lets ops/support filter by action prefix, entityType, user-UUID and
 * date range, and offers JSON-meta inspection so the operator can see
 * IP / user-agent / orgId stamped onto every event.
 *
 * Read-only: this surface intentionally has no "delete" action — audit
 * tampering would defeat the entire ISAE/SOC point of the log.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();
const PAGE_SIZE = 50;

interface AuditItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditAction {
  action: string;
  lastSeen: string | null;
  count: number;
}

interface ListResponse {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function actionTone(action: string): string {
  if (action.includes(".fail") || action.includes(".error"))
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (action.includes(".ok") || action.includes(".paid"))
    return "bg-success/15 text-success border-success/40";
  if (action.startsWith("association.") || action.startsWith("sales."))
    return "bg-brand-50 text-brand-700 border-brand-200";
  return "bg-muted text-muted-foreground border-border";
}

export default function AuditLogPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch the action dropdown once on mount; it doesn't churn so we
  // don't want to refire on every filter change.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/admin/audit-log/actions`, {
          credentials: "include",
        });
        if (res.ok) {
          const j = (await res.json()) as { actions: AuditAction[] };
          setActions(j.actions ?? []);
        }
      } catch {
        // non-fatal — the dropdown just stays empty.
      }
    })();
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (actionFilter) p.set("action", actionFilter);
    if (entityType) p.set("entityType", entityType);
    if (userId) p.set("userId", userId);
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(offset));
    return p.toString();
  }, [actionFilter, entityType, userId, fromDate, toDate, offset]);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/admin/audit-log?${query}`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setError(
              res.status === 403
                ? "Behörighet saknas — kräver INTERNAL_ADMIN."
                : "Kunde inte hämta audit-log."
            );
          }
          return;
        }
        const j = (await res.json()) as ListResponse;
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Nätverksfel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  function resetFilters() {
    setActionFilter("");
    setEntityType("");
    setUserId("");
    setFromDate("");
    setToDate("");
    setOffset(0);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit-log</h1>
          <p className="text-sm text-muted-foreground">
            Read-only händelsehistorik för ISAE/SOC-uppföljning. Endast
            INTERNAL_ADMIN har åtkomst.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {total.toLocaleString("sv-SE")} händelser
        </Badge>
      </div>

      {/* MASTERPLAN_01 KC6.5: 5 filter-fält i en grid äter hela viewporten
          på mobil — användaren måste scrolla för att se data. Wrap:a i
          <details> så filter:n är collapsed default på alla skärmar och
          tar plats först när admin explicit öppnar dem. Lägger även
          aktiv-filter-count i headern så det syns när något är satt. */}
      <Card>
        <CardContent className="p-0">
          <details className="group" open={false}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter</span>
              {(actionFilter || entityType || userId || fromDate || toDate) && (
                <Badge variant="outline" className="text-[10px]">
                  {[actionFilter, entityType, userId, fromDate, toDate].filter(Boolean).length} aktiva
                </Badge>
              )}
              <ChevronDown
                className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="border-t px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="actionFilter">Åtgärd</Label>
              <select
                id="actionFilter"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setOffset(0);
                }}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Alla åtgärder</option>
                {actions.map((a) => (
                  <option key={a.action} value={a.action}>
                    {a.action} ({a.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="entityType">Entitetstyp</Label>
              <Input
                id="entityType"
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  setOffset(0);
                }}
                placeholder="t.ex. organization"
              />
            </div>
            <div>
              <Label htmlFor="userId">Användar-UUID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setOffset(0);
                }}
                placeholder="36 tecken"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="fromDate">Från</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            <div>
              <Label htmlFor="toDate">Till</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
          </div>
          {(actionFilter || entityType || userId || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={resetFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Rensa filter
            </Button>
          )}
            </div>
          </details>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Försök igen
            </Button>
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Search className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Inga händelser matchar filtren.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((it) => {
                const expanded = expandedId === it.id;
                return (
                  <div key={it.id} className="p-4">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 text-left"
                      onClick={() =>
                        setExpandedId(expanded ? null : it.id)
                      }
                    >
                      <Badge
                        variant="outline"
                        className={`shrink-0 font-mono text-[10px] ${actionTone(it.action)}`}
                      >
                        {it.action}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(it.createdAt)}
                          {it.entityType && (
                            <>
                              {" · "}
                              <span className="font-mono">
                                {it.entityType}
                                {it.entityId ? `:${it.entityId.slice(0, 8)}` : ""}
                              </span>
                            </>
                          )}
                        </p>
                        {it.userEmail ? (
                          <p className="mt-0.5 text-sm font-medium truncate">
                            {it.userEmail}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs italic text-muted-foreground">
                            Anonym / system
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          expanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    {expanded && (
                      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted/30 p-3 text-[11px] leading-relaxed">
{JSON.stringify(
  {
    id: it.id,
    userId: it.userId,
    entityType: it.entityType,
    entityId: it.entityId,
    meta: it.meta,
  },
  null,
  2
)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Sida {page} av {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="mr-1 h-3 w-3" />
              Föregående
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Nästa
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
