"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2, Truck, PackageCheck } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";

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

function isActivePeriod(c: CampaignRow): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return c.startDate <= today && today <= c.endDate;
}

export default function AssociationCalendarPage() {
  const { locale } = useLocale();
  const t = fundraisingPages.calendar[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const { toast } = useToast();

  const statusLabel: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: c.active, cls: "bg-brand-100 text-brand-700" },
    DRAFT: { label: c.draft, cls: "bg-brand-50 text-brand-600" },
    ENDED: { label: c.ended, cls: "bg-muted text-muted-foreground" },
    SETTLED: { label: c.settled, cls: "bg-muted text-muted-foreground" },
  };

  function fmt(d: string | null): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await rootsFetch(`${API_URL}/v1/dashboard/association`);
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

  async function shipBulk(campaign: CampaignRow) {
    if (!window.confirm(tFill(t.confirmShip, { name: campaign.name }))) return;
    setShippingId(campaign.id);
    const { ok, data } = await apiFetch<{ shipped?: number; error?: string }>(
      `/v1/dashboard/campaign/${campaign.id}/ship-bulk`,
      { method: "POST", body: {} }
    );
    setShippingId(null);
    if (ok) {
      toast(tFill(t.shippedToast, { n: data?.shipped ?? 0 }), "success");
    } else {
      toast(data?.error || t.shipFailed, "error");
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

  function deliveryTypeLabel(type: string) {
    if (type === "BULK") return c.deliveryBulk;
    if (type === "DIRECT") return c.deliveryDirect;
    return c.deliveryBoth;
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((campaign) => {
            const active =
              isActivePeriod(campaign) && campaign.status === "ACTIVE";
            const status = statusLabel[campaign.status] ?? {
              label: campaign.status,
              cls: "bg-muted text-muted-foreground",
            };
            return (
              <Card
                key={campaign.id}
                className={active ? "ring-1 ring-brand-300" : ""}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {campaign.name}
                    {active && (
                      <Badge className="bg-brand-700 text-primary-foreground">
                        {t.ongoing}
                      </Badge>
                    )}
                  </CardTitle>
                  <Badge className={status.cls}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t.salesPeriod}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {fmt(campaign.startDate)} – {fmt(campaign.endDate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        {t.deliveryToClub}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {fmt(campaign.deliveryDate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t.deliveryType}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {deliveryTypeLabel(campaign.deliveryType)}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shipBulk(campaign)}
                      disabled={shippingId === campaign.id}
                    >
                      {shippingId === campaign.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="mr-2 h-4 w-4" />
                      )}
                      {t.markDelivered}
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
