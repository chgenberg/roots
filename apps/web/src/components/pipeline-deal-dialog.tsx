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
  getStageLabels,
  daysSince,
  stageBadgeVariant,
} from "@/lib/pipeline-stages";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

export interface PipelineDealRef {
  kind: PipelineDealKind;
  id: string;
}

function formatDate(
  value: string | Date | null | undefined,
  dateLocale: string
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(dateLocale);
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{empty ? "—" : value}</dd>
    </div>
  );
}

export function PipelineDealDialog({
  deal,
  readOnly = false,
  onClose,
  onStatusChanged,
  onCreateQuote,
}: {
  deal: PipelineDealRef | null;
  readOnly?: boolean;
  onClose: () => void;
  onStatusChanged: (dealId: string, status: string) => void;
  onCreateQuote: (org: { id: string; name: string }) => void;
}) {
  const { locale } = useLocale();
  const t = portalPages.dealDialog[locale];
  const shared = portalShared[locale];
  const common = appCommon[locale];
  const stageLabels = getStageLabels(locale);
  const crmLabels = shared.crmStatus;
  const sourceLabels = shared.leadSourcesShort;

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
        setError(err instanceof Error ? err.message : t.loadError);
      } finally {
        setLoading(false);
      }
    },
    [dealKind, dealId, t.loadError]
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
      setError(err instanceof Error ? err.message : t.moveFail);
    } finally {
      setSavingStage(null);
    }
  }

  const org = detail?.org;
  const title = org?.name ?? t.titleFallback;

  function crmLabel(status: string | null | undefined): string {
    if (!status) return "—";
    return crmLabels[status as keyof typeof crmLabels] ?? status;
  }

  return (
    <Dialog open={deal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title}
            {detail && (
              <Badge variant={stageBadgeVariant(detail.status)}>
                {stageLabels[detail.status] ?? detail.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {detail?.kind === "LEAD" ? t.leadDesc : t.quoteDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-2">
          {loading && !detail && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                {common.retry}
              </Button>
            </div>
          )}

          {detail && (
            <>
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
                <Fact
                  label={t.value}
                  value={
                    detail.totalOre > 0
                      ? formatKr(detail.totalOre, locale)
                      : shared.notQuoted
                  }
                />
                <Fact
                  label={t.inStage}
                  value={tFill(t.inStageDays, {
                    days: daysSince(detail.stageSince ?? detail.createdAt),
                  })}
                />
                <Fact
                  label={t.created}
                  value={formatDate(detail.createdAt, shared.dateLocale)}
                />
                <Fact
                  label={detail.kind === "QUOTE" ? t.validUntil : t.owner}
                  value={
                    detail.kind === "QUOTE"
                      ? formatDate(detail.validUntil, shared.dateLocale)
                      : (detail.salesRepName ?? "—")
                  }
                />
              </div>

              {readOnly ? (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  {t.demoReadonly}
                </p>
              ) : detail.kind === "QUOTE" ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.moveToStage}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUOTE_STAGES.map((code) => {
                      const active = detail.status === code;
                      return (
                        <Button
                          key={code}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          disabled={savingStage !== null}
                          aria-current={active ? "true" : undefined}
                          onClick={() => void changeStage(code)}
                        >
                          {savingStage === code ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : active ? (
                            <Check className="mr-2 h-3.5 w-3.5" />
                          ) : null}
                          {stageLabels[code]}
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
                  {t.createQuote}
                </Button>
              )}

              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  {t.aboutClub}
                </p>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Fact label={t.orgNumber} value={org?.orgNumber} />
                  <Fact label={t.municipality} value={org?.municipality} />
                  <Fact label={t.region} value={org?.region} />
                  <Fact label={t.sport} value={org?.sportType} />
                  <Fact label={t.portalMembers} value={org?.membersCount} />
                  <Fact
                    label={t.crmStatus}
                    value={crmLabel(org?.crmStatus)}
                  />
                  <Fact
                    label={t.source}
                    value={
                      org?.leadSource
                        ? (sourceLabels[org.leadSource as keyof typeof sourceLabels] ??
                          org.leadSource)
                        : "—"
                    }
                  />
                  <Fact
                    label={t.potential}
                    value={
                      typeof org?.potentialScore === "number"
                        ? `${org.potentialScore}/100`
                        : "—"
                    }
                  />
                  <Fact
                    label={t.website}
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
                          {t.open}
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
                    {t.quoteLines}
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
                            {line.qty} × {formatKr(line.unitPriceOre, locale)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatKr(line.lineTotalOre, locale)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        {t.total}
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {formatKr(detail.totalOre, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detail.otherQuotes.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    {tFill(t.otherQuotes, { name: org?.name ?? "—" })}
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
                            {stageLabels[q.status] ?? q.status}
                          </Badge>
                          <span className="truncate text-xs text-muted-foreground">
                            {formatDate(q.createdAt, shared.dateLocale)}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatKr(q.totalOre, locale)}
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
            {common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
