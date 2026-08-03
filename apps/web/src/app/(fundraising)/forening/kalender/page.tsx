"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2, Truck, PackageCheck } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const API_URL = getBrowserApiBase();

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  deliveryDate: string | null;
  deliveryType: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Aktiv", cls: "bg-brand-100 text-brand-700" },
  DRAFT: { label: "Utkast", cls: "bg-brand-50 text-brand-600" },
  ENDED: { label: "Avslutad", cls: "bg-muted text-muted-foreground" },
  SETTLED: { label: "Avräknad", cls: "bg-muted text-muted-foreground" },
};

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function isActivePeriod(c: CampaignRow): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return c.startDate <= today && today <= c.endDate;
}

export default function AssociationCalendarPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/dashboard/association`, {
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        setCampaigns(d.campaigns || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function shipBulk(c: CampaignRow) {
    if (
      !window.confirm(
        `Markera alla betalda ordrar i "${c.name}" som skickade till klubben?`
      )
    )
      return;
    setShippingId(c.id);
    const { ok, data } = await apiFetch<{ shipped?: number; error?: string }>(
      `/v1/dashboard/campaign/${c.id}/ship-bulk`,
      { method: "POST", body: {} }
    );
    setShippingId(null);
    if (ok) {
      toast(`${data?.shipped ?? 0} ordrar markerade som skickade.`, "success");
    } else {
      toast(data?.error || "Kunde inte markera leverans.", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  const sorted = [...campaigns].sort((a, b) =>
    a.startDate < b.startDate ? 1 : -1
  );

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Säljkalender</h1>
        <p className="text-sm text-muted-foreground">
          Säljperioder och leveransdatum för dina kampanjer.
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Inga kampanjer ännu. Starta en kampanj för att se kalendern.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => {
            const active = isActivePeriod(c) && c.status === "ACTIVE";
            const status = STATUS_LABEL[c.status] ?? {
              label: c.status,
              cls: "bg-muted text-muted-foreground",
            };
            return (
              <Card key={c.id} className={active ? "ring-1 ring-brand-300" : ""}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {c.name}
                    {active && (
                      <Badge className="bg-brand-700 text-primary-foreground">
                        Pågår nu
                      </Badge>
                    )}
                  </CardTitle>
                  <Badge className={status.cls}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="text-xs text-muted-foreground">Säljperiod</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {fmt(c.startDate)} – {fmt(c.endDate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        Leverans till klubben
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {fmt(c.deliveryDate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="text-xs text-muted-foreground">Leveranssätt</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {c.deliveryType === "BULK"
                          ? "Samlat till klubben"
                          : c.deliveryType === "DIRECT"
                            ? "Hemleverans"
                            : "Båda"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shipBulk(c)}
                      disabled={shippingId === c.id}
                    >
                      {shippingId === c.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="mr-2 h-4 w-4" />
                      )}
                      Markera levererat till klubben
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
