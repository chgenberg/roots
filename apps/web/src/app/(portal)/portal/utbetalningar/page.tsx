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

function statusLabel(s: string) {
  if (s === "PENDING") return "Väntar";
  if (s === "INVOICED") return "Fakturerad";
  if (s === "PAID") return "Utbetald";
  return s;
}

export default function UtbetalningarPage() {
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
            ? "Behörighet saknas — kräver INTERNAL_ADMIN."
            : res.data?.error || "Kunde inte hämta utbetalningar."
        );
        setPayouts([]);
        return;
      }
      setPayouts(res.data.payouts ?? []);
    } catch {
      setError("Nätverksfel. Kunde inte kontakta servern.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(id: string) {
    const paymentReference = (refs[id] || "").trim();
    if (!paymentReference) {
      toast("Ange betalningsreferens först.", "error");
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
        toast(res.data?.error || "Kunde inte markera som utbetald.", "error");
        return;
      }
      toast("Utbetalningen är markerad som betald.", "success");
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
          <h1 className="text-2xl font-bold tracking-tight">Utbetalningar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Markera föreningars andelar som utbetalda efter banköverföring.
          </p>
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
          Uppdatera
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
          Hämtar utbetalningar…
        </div>
      ) : null}

      {!loading && !error && payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-brand-500" />
            <div>
              <p className="font-medium">Inga utbetalningar ännu</p>
              <p className="mt-1 text-sm text-muted-foreground">
                När en förening genererar avräkning dyker raderna upp här.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Att betala ({open.length})
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
                          {p.orgName || "Okänd förening"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.campaignName || "Kampanj"} · Er andel att betala{" "}
                          <strong className="text-foreground">
                            {formatKr(p.teamShareOre)}
                          </strong>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Totalt sålt {formatKr(p.totalSalesOre)} · Roots{" "}
                          {formatKr(p.rootsShareOre)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{statusLabel(p.status)}</Badge>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                      <Label htmlFor={`ref-${p.id}`}>Betalningsreferens</Label>
                      <Input
                        id={`ref-${p.id}`}
                        value={refs[p.id] || ""}
                        onChange={(e) =>
                          setRefs((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        placeholder="t.ex. SEB 2026-08-07 / OCR"
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
                      Markera utbetald
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
            Utbetalda ({paid.length})
          </h2>
          {paid.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{p.orgName}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.campaignName} · {formatKr(p.teamShareOre)}
                    {p.paymentReference ? ` · ${p.paymentReference}` : ""}
                  </p>
                </div>
                <Badge variant="success">Utbetald</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
