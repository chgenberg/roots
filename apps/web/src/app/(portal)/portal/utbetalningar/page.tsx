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

  async function markPaid(id: string) {
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
          body: { status: "PAID", paymentReference },
        }
      );
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
                      disabled={busy}
                      onClick={() => void markPaid(p.id)}
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
          {paid.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{p.orgName}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.campaignName} · {formatKr(p.teamShareOre, locale)}
                    {p.paymentReference ? ` · ${p.paymentReference}` : ""}
                  </p>
                </div>
                <Badge variant="success">{t.paidBadge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
