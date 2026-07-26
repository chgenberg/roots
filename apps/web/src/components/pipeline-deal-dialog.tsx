"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { portalFetch } from "@/lib/portal-api";
import {
  pipelineDealDetailResponseSchema,
  updateQuoteStatusResponseSchema,
  type PipelineDealDetail,
  type PipelineDealKind,
} from "@roots/contracts";
import { formatKr } from "@/lib/format";
import {
  QUOTE_STAGES,
  STAGE_LABELS,
  daysSince,
  stageBadgeVariant,
} from "@/lib/pipeline-stages";

export interface PipelineDealRef {
  kind: PipelineDealKind;
  id: string;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sv-SE");
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  INBOUND: "Inkommande förfrågan",
  OUTBOUND: "Utgående kontakt",
  EVENT: "Mässa / event",
  REFERRAL: "Rekommendation",
  WEB: "Webbplats",
  MANUAL: "Manuellt skapad",
};

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  // Only null/undefined/"" fall back to a dash — `0` is a real answer
  // ("0 medlemmar i portalen"), not missing data.
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{empty ? "—" : value}</dd>
    </div>
  );
}

/**
 * Detail dialog for one pipeline card. Opens on click from both the kanban
 * board and the list view.
 *
 * It doubles as the accessible path for moving a deal: dragging is a
 * pointer-only gesture, so the stage buttons here are how keyboard and
 * touch users change a stage.
 */
export function PipelineDealDialog({
  deal,
  readOnly = false,
  onClose,
  onStatusChanged,
  onCreateQuote,
}: {
  deal: PipelineDealRef | null;
  /** Demo login: show the deal, but no actions that the API will refuse. */
  readOnly?: boolean;
  onClose: () => void;
  onStatusChanged: (dealId: string, status: string) => void;
  onCreateQuote: (org: { id: string; name: string }) => void;
}) {
  const [detail, setDetail] = useState<PipelineDealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingStage, setSavingStage] = useState<string | null>(null);

  const dealKind = deal?.kind;
  const dealId = deal?.id;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!dealKind || !dealId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await portalFetch(
          `/pipeline/deals/${dealKind === "QUOTE" ? "quote" : "lead"}/${dealId}`,
          { schema: pipelineDealDetailResponseSchema, signal }
        );
        setDetail(data.deal);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Kunde inte hämta affären."
        );
      } finally {
        setLoading(false);
      }
    },
    [dealKind, dealId]
  );

  useEffect(() => {
    if (!dealId) {
      setDetail(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [dealId, load]);

  async function changeStage(next: string) {
    if (!detail || detail.kind !== "QUOTE" || next === detail.status) return;
    setSavingStage(next);
    setError(null);
    try {
      const res = await portalFetch(`/quotes/${detail.id}/status`, {
        method: "PATCH",
        schema: updateQuoteStatusResponseSchema,
        body: { status: next },
      });
      setDetail({
        ...detail,
        status: res.quote.status,
        stageSince: res.quote.updatedAt,
        org: res.orgPromotedToCustomer
          ? { ...detail.org, crmStatus: "CUSTOMER" }
          : detail.org,
      });
      onStatusChanged(detail.id, res.quote.status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunde inte flytta offerten."
      );
    } finally {
      setSavingStage(null);
    }
  }

  const org = detail?.org;
  const title = org?.name ?? "Affär";

  return (
    <Dialog open={deal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title}
            {detail && (
              <Badge variant={stageBadgeVariant(detail.status)}>
                {STAGE_LABELS[detail.status] ?? detail.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {detail?.kind === "LEAD"
              ? "Lead utan offert. Skapa en offert för att flytta affären framåt."
              : "Offert — ändra steg, se rader och klubbens historik."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-2">
          {loading && !detail && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Hämtar affären…
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Försök igen
              </Button>
            </div>
          )}

          {detail && (
            <>
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
                <Fact
                  label="Värde"
                  value={
                    detail.totalOre > 0
                      ? formatKr(detail.totalOre)
                      : "Ej offererad"
                  }
                />
                <Fact
                  label="I steget"
                  value={`${daysSince(detail.stageSince ?? detail.createdAt)} dagar`}
                />
                <Fact label="Skapad" value={formatDate(detail.createdAt)} />
                <Fact
                  label={detail.kind === "QUOTE" ? "Giltig t.o.m." : "Ansvarig"}
                  value={
                    detail.kind === "QUOTE"
                      ? formatDate(detail.validUntil)
                      : (detail.salesRepName ?? "—")
                  }
                />
              </div>

              {/* Stage control. For a quote this is the keyboard/touch
                  equivalent of dragging the card between columns. */}
              {readOnly ? (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  Demokontot visar affärerna men kan inte ändra dem.
                </p>
              ) : detail.kind === "QUOTE" ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Flytta till steg
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUOTE_STAGES.map((code) => {
                      const active = detail.status === code;
                      return (
                        <Button
                          key={code}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          // The current stage is not disabled — disabled
                          // styling dims it, which reads as "unavailable"
                          // rather than "this is where the deal is". The
                          // handler no-ops on a click anyway.
                          disabled={savingStage !== null}
                          aria-current={active ? "true" : undefined}
                          onClick={() => void changeStage(code)}
                        >
                          {savingStage === code ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : active ? (
                            <Check className="mr-2 h-3.5 w-3.5" />
                          ) : null}
                          {STAGE_LABELS[code]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    onCreateQuote({ id: detail.org.id, name: detail.org.name })
                  }
                >
                  Skapa offert
                </Button>
              )}

              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Om föreningen
                </p>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Fact label="Org.nr" value={org?.orgNumber} />
                  <Fact label="Kommun" value={org?.municipality} />
                  <Fact label="Region" value={org?.region} />
                  <Fact label="Idrott" value={org?.sportType} />
                  <Fact label="Medlemmar i portalen" value={org?.membersCount} />
                  <Fact
                    label="CRM-status"
                    value={
                      org?.crmStatus === "CUSTOMER"
                        ? "Kund"
                        : org?.crmStatus === "LEAD"
                          ? "Lead"
                          : org?.crmStatus
                    }
                  />
                  <Fact
                    label="Källa"
                    value={
                      org?.leadSource
                        ? (LEAD_SOURCE_LABELS[org.leadSource] ?? org.leadSource)
                        : "—"
                    }
                  />
                  <Fact
                    label="Potential"
                    value={
                      typeof org?.potentialScore === "number"
                        ? `${org.potentialScore}/100`
                        : "—"
                    }
                  />
                  <Fact
                    label="Webbplats"
                    value={
                      org?.website ? (
                        <a
                          href={
                            org.website.startsWith("http")
                              ? org.website
                              : `https://${org.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 underline-offset-2 hover:underline"
                        >
                          Öppna
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
              </div>

              {detail.lines.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Offertrader
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    {detail.lines.map((line, i) => (
                      <div
                        key={`${line.sku ?? line.productName}-${i}`}
                        className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {line.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.qty} × {formatKr(line.unitPriceOre)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatKr(line.lineTotalOre)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        Totalt
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {formatKr(detail.totalOre)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detail.otherQuotes.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Övriga offerter för {org?.name}
                  </p>
                  <div className="space-y-2">
                    {detail.otherQuotes.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant={stageBadgeVariant(q.status)}
                            className="shrink-0"
                          >
                            {STAGE_LABELS[q.status] ?? q.status}
                          </Badge>
                          <span className="truncate text-xs text-muted-foreground">
                            {formatDate(q.createdAt)}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatKr(q.totalOre)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
