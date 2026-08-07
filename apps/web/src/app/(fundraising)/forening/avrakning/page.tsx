"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { AssociationDashboard, Campaign, Team } from "@/types/fundraising";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { getBrowserApiBase } from "@/lib/api-base";
import { formatKr, formatKrValue, pluralSv } from "@/lib/format";

const API_URL = getBrowserApiBase();

type PayoutRow = {
  id: string;
  campaignId: string;
  campaignName: string | null;
  teamId: string;
  totalSalesOre: number;
  teamShareOre: number;
  rootsShareOre?: number;
  status: "PENDING" | "INVOICED" | "PAID";
  fortnoxInvoiceId: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
};

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Väntar på utbetalning";
    case "INVOICED":
      return "Fakturerad";
    case "PAID":
      return "Utbetald";
    case "ACTIVE":
      return "Pågår";
    case "ENDED":
      return "Avslutad";
    case "SETTLED":
      return "Avräknad";
    default:
      return status;
  }
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "PAID":
    case "SETTLED":
      return "success";
    case "INVOICED":
    case "ENDED":
      return "warning";
    case "ACTIVE":
      return "default";
    default:
      return "secondary";
  }
}

export default function SettlementPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AssociationDashboard | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [orgNumber, setOrgNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dashRes, payRes, orgRes] = await Promise.all([
        fetch(`${API_URL}/v1/dashboard/association`, { credentials: "include" }),
        apiFetch<{ payouts?: PayoutRow[] }>("/v1/payouts/mine"),
        apiFetch<{ organization?: { orgNumber?: string | null } }>(
          "/v1/association/org"
        ),
      ]);

      if (dashRes.ok) {
        setData(await dashRes.json());
        setError(null);
      } else {
        setError("Kunde inte hämta avräkningsdata. Försök igen.");
      }

      if (payRes.ok) setPayouts(payRes.data.payouts ?? []);
      if (orgRes.ok) setOrgNumber(orgRes.data.organization?.orgNumber ?? null);
    } catch {
      setError("Ett nätverksfel uppstod. Försök igen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function endCampaign(campaignId: string, name: string) {
    if (
      !window.confirm(
        `Avsluta kampanjen "${name}"? Efteråt kan ni generera avräkning. Butiken stängs för nya ordrar i den här kampanjen.`
      )
    ) {
      return;
    }
    setActingId(campaignId);
    try {
      const res = await apiFetch<{ error?: string; status?: string }>(
        `/v1/association/campaigns/${campaignId}/end`,
        { method: "POST", body: {} }
      );
      if (!res.ok) {
        toast(res.data?.error || "Kunde inte avsluta kampanjen.", "error");
        return;
      }
      toast("Kampanjen är avslutad. Ni kan nu generera avräkning.", "success");
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function generateSettlement(campaignId: string) {
    if (
      !window.confirm(
        "Generera avräkning? Vi räknar ut föreningens andel per lag utifrån er marginal."
      )
    ) {
      return;
    }
    setActingId(campaignId);
    try {
      const res = await apiFetch<{ error?: string; settlements?: unknown[] }>(
        `/v1/settlement/generate/${campaignId}`,
        { method: "POST", body: {} }
      );
      if (!res.ok) {
        toast(res.data?.error || "Avräkningen misslyckades.", "error");
        return;
      }
      toast("Avräkningen är klar. Roots hanterar utbetalningen.", "success");
      await load();
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Försök igen
        </Button>
      </div>
    );
  }

  const campaigns = data?.campaigns || [];
  const activeOrEnded = campaigns.filter(
    (c) =>
      c.status === "ACTIVE" || c.status === "ENDED" || c.status === "SETTLED"
  );
  const campaign =
    activeOrEnded.find((c) => c.status === "ACTIVE") ||
    activeOrEnded.find((c) => c.status === "ENDED") ||
    activeOrEnded[0];
  const marginPercent = campaign?.marginPercent || 25;
  const totalSales = data?.stats?.totalSalesOre || 0;
  const teamShare = Math.round(totalSales * (marginPercent / 100));
  const rootsShare = totalSales - teamShare;
  const teams = data?.teams || [];
  const missingOrgNumber = !orgNumber;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avräkning</h1>
        <p className="text-sm text-muted-foreground">
          Avsluta kampanj → generera avräkning → Roots betalar ut er andel.
        </p>
      </div>

      {missingOrgNumber && (
        <Card className="border-warning-edge bg-warning-surface/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
              <div>
                <p className="font-semibold text-warning-strong">
                  Organisationsnummer saknas
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fyll i det under Inställningar innan vi kan fakturera och
                  betala ut.
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/installningar">
                Fyll i nu
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              <p className="text-sm text-muted-foreground">Total försäljning</p>
            </div>
            <p className="text-2xl font-bold">{formatKrValue(totalSales)} kr</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Föreningens intjänat</p>
            <p className="text-2xl font-bold text-success">
              {formatKrValue(teamShare)} kr
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {marginPercent}% marginal
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Roots andel</p>
            <p className="text-2xl font-bold">{formatKrValue(rootsShare)} kr</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kampanjer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeOrEnded.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen kampanj ännu.{" "}
              <Link href="/forening" className="underline underline-offset-4">
                Starta er första kampanj
              </Link>
              .
            </p>
          ) : (
            activeOrEnded.map((c: Campaign) => {
              const busy = actingId === c.id;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      <Badge variant={statusVariant(c.status)}>
                        {statusLabel(c.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Marginal {c.marginPercent}%
                      {c.endDate ? ` · Slutdatum ${c.endDate}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status === "ACTIVE" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void endCampaign(c.id, c.name)}
                      >
                        {busy && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Avsluta kampanj
                      </Button>
                    )}
                    {c.status === "ENDED" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void generateSettlement(c.id)}
                      >
                        {busy && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Generera avräkning
                      </Button>
                    )}
                    {c.status === "SETTLED" && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Avräknad
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Utbetalningar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              När ni genererat avräkning syns utbetalningarna här. Roots
              markerar dem som utbetalda när pengarna skickats.
            </p>
          ) : (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {p.campaignName || "Kampanj"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Er andel {formatKr(p.teamShareOre)}
                      {p.paymentReference
                        ? ` · Ref ${p.paymentReference}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(p.status)}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per lag (live)</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga lag ännu.</p>
          ) : (
            <div className="space-y-3">
              {teams.map((team: Team) => {
                const teamEarned = Math.round(
                  team.totalSalesOre * (marginPercent / 100)
                );
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pluralSv(team.orderCount, "order", "ordrar")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatKrValue(team.totalSalesOre)} kr
                      </p>
                      <p className="text-xs text-success">
                        +{formatKrValue(teamEarned)} kr
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
