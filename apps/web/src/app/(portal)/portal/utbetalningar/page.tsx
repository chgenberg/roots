"use client";

/**
 * INTERNAL_ADMIN — utbetalningskö.
 * GET  /v1/payouts
 * PATCH /v1/payouts/:id/status { status: "PAID", paymentReference }
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { formatKr } from "@/lib/format";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Banknote,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { portalPages, portalShared } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

type Payout = {
  id: string;
  campaignId: string;
  campaignName: string | null;
  orgId: string;
  orgName: string | null;
  teamId: string;
  totalSalesOre: number;
  teamShareOre: number;
  rootsShareOre: number;
  status: "PENDING" | "INVOICED" | "PAID";
  fortnoxInvoiceId: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  /** Satt när en order återbetalats efter att utbetalningen låsts. */
  reviewRequiredAt: string | null;
  reviewResolvedAt: string | null;
  reviewNote: string | null;
  /** Vad som hade varit rätt belopp i dag. Bara på flaggade utbetalningar. */
  review: {
    /** Flaggan väntar på att någon reglerar och kvitterar. */
    needsReview: boolean;
    correctTeamShareOre: number;
    correctTotalSalesOre: number;
    /** Total mellanskillnad mot det låsta beloppet. */
    overpaidOre: number;
    /** Det som tillkommit sedan senaste kvitteringen. */
    outstandingOre: number;
    /** Det som redan kvitterats. */
    settledOre: number;
  } | null;
  createdAt: string;
};

export default function UtbetalningarPage() {
  const { locale } = useLocale();
  const t = portalPages.utbetalningar[locale];
  const shared = portalShared[locale];
  const payoutLabels = shared.payoutStatus;
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ payouts?: Payout[]; error?: string }>(
        "/v1/payouts"
      );
      if (!res.ok) {
        setError(
          res.status === 403
            ? shared.permissionDenied
            : res.data?.error || t.loadError
        );
        setPayouts([]);
        return;
      }
      setPayouts(res.data.payouts ?? []);
    } catch {
      setError(shared.networkServer);
    } finally {
      setLoading(false);
    }
  }, [shared.networkServer, shared.permissionDenied, t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveReview(id: string, expectedCorrectTeamShareOre?: number) {
    const note = (reviewNotes[id] || "").trim();
    if (note.length < 3) return;
    setActingId(id);
    try {
      const res = await apiFetch<{ error?: string; ok?: boolean }>(
        `/v1/payouts/${id}/review/resolve`,
        // Beloppet som stod på skärmen följer med. Har en ny återbetalning
        // kommit sedan dess gäller kvitteringen inte den.
        { method: "POST", body: { note, expectedCorrectTeamShareOre, locale } }
      );
      if (!res.ok) {
        toast(res.data?.error || t.reviewResolveFail, "error");
        if (res.status === 409) await load();
        return;
      }
      setReviewNotes((prev) => ({ ...prev, [id]: "" }));
      toast(t.reviewResolveOk, "success");
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function markPaid(id: string, expectedTeamShareOre: number) {
    const paymentReference = (refs[id] || "").trim();
    if (!paymentReference) {
      toast(t.refRequired, "error");
      return;
    }
    setActingId(id);
    try {
      const res = await apiFetch<{ error?: string; ok?: boolean }>(
        `/v1/payouts/${id}/status`,
        {
          method: "PATCH",
          // Beloppet som stod på skärmen följer med. Har en återbetalning
          // räknat om utbetalningen sedan dess säger servern ifrån.
          body: { status: "PAID", paymentReference, expectedTeamShareOre },
        }
      );
      if (res.status === 409) {
        toast(res.data?.error || t.amountChanged, "error");
        await load();
        return;
      }
      if (!res.ok) {
        toast(res.data?.error || t.markFail, "error");
        return;
      }
      toast(t.markOk, "success");
      await load();
    } finally {
      setActingId(null);
    }
  }

  const open = payouts.filter((p) => p.status !== "PAID");
  const paid = payouts.filter((p) => p.status === "PAID");

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {shared.refresh}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && !payouts.length ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      ) : null}

      {!loading && !error && payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-brand-500" />
            <div>
              <p className="font-medium">{t.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tFill(t.toPay, { count: open.length })}
          </h2>
          {open.map((p) => {
            const busy = actingId === p.id;
            return (
              <Card key={p.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                        <Banknote className="h-5 w-5 text-brand-700" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {p.orgName || t.unknownClub}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.campaignName || t.campaign} · {t.shareToPay}{" "}
                          <strong className="text-foreground">
                            {formatKr(p.teamShareOre, locale)}
                          </strong>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tFill(t.soldTotal, {
                            sales: formatKr(p.totalSalesOre, locale),
                            roots: formatKr(p.rootsShareOre, locale),
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {payoutLabels[p.status]}
                    </Badge>
                  </div>

                  <ReviewNotice
                    payout={p}
                    busy={busy}
                    note={reviewNotes[p.id] || ""}
                    onNote={(value) =>
                      setReviewNotes((prev) => ({ ...prev, [p.id]: value }))
                    }
                    onResolve={() => void resolveReview(p.id, p.review?.correctTeamShareOre)}
                  />

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                      <Label htmlFor={`ref-${p.id}`}>{t.paymentRef}</Label>
                      <Input
                        id={`ref-${p.id}`}
                        value={refs[p.id] || ""}
                        onChange={(e) =>
                          setRefs((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        placeholder={t.paymentRefPlaceholder}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={busy || !(refs[p.id] || "").trim()}
                      onClick={() => {
                        if (!window.confirm(t.confirmPaid)) return;
                        void markPaid(p.id, p.teamShareOre);
                      }}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      {t.markPaid}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tFill(t.paidSection, { count: paid.length })}
          </h2>
          {paid.map((p) => {
            const needsReview = p.review?.needsReview === true;
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.orgName}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.campaignName} · {formatKr(p.teamShareOre, locale)}
                        {p.paymentReference ? ` · ${p.paymentReference}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsReview && (
                        <Badge variant="destructive">{t.reviewBadge}</Badge>
                      )}
                      <Badge variant="success">{t.paidBadge}</Badge>
                    </div>
                  </div>
                  <ReviewNotice
                    payout={p}
                    busy={actingId === p.id}
                    note={reviewNotes[p.id] || ""}
                    onNote={(value) =>
                      setReviewNotes((prev) => ({ ...prev, [p.id]: value }))
                    }
                    onResolve={() => void resolveReview(p.id, p.review?.correctTeamShareOre)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Flaggan på en utbetalning som är fakturerad eller betald, där en order
 * sedan återbetalats. Beloppen på utbetalningen ändras aldrig; här står vad
 * som skiljer, och en människa kvitterar när det är reglerat med föreningen.
 */
function ReviewNotice({
  payout,
  busy,
  note,
  onNote,
  onResolve,
}: {
  payout: Payout;
  busy: boolean;
  note: string;
  onNote: (value: string) => void;
  onResolve: () => void;
}) {
  const { locale } = useLocale();
  const t = portalPages.utbetalningar[locale];
  if (!payout.reviewRequiredAt || !payout.review) return null;

  if (!payout.review.needsReview && payout.reviewResolvedAt) {
    return (
      <p className="text-pretty text-xs text-muted-foreground">
        {tFill(t.reviewResolved, {
          date: new Date(payout.reviewResolvedAt).toLocaleDateString(
            locale === "en" ? "en-GB" : "sv-SE"
          ),
          note: payout.reviewNote || "",
        })}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-semibold">{t.reviewTitle}</p>
          <p className="text-pretty text-muted-foreground">{t.reviewBody}</p>
          <p className="text-pretty">
            {tFill(t.reviewNumbers, {
              paid: formatKr(payout.teamShareOre, locale),
              correct: formatKr(payout.review.correctTeamShareOre, locale),
              over: formatKr(payout.review.overpaidOre, locale),
            })}
          </p>
          {payout.review.settledOre > 0 && (
            <p className="text-pretty">
              {tFill(t.reviewOutstanding, {
                settled: formatKr(payout.review.settledOre, locale),
                outstanding: formatKr(payout.review.outstandingOre, locale),
              })}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor={`review-${payout.id}`}>{t.reviewNoteLabel}</Label>
          <Input
            id={`review-${payout.id}`}
            value={note}
            maxLength={500}
            onChange={(e) => onNote(e.target.value)}
            placeholder={t.reviewNotePlaceholder}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || note.trim().length < 3}
          onClick={onResolve}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {t.reviewResolve}
        </Button>
      </div>
    </div>
  );
}
