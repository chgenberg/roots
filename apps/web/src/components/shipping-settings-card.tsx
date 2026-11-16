"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import type { ShippingSettings } from "@roots/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { formatKr } from "@/lib/format";
import { useLocale } from "@/i18n/locale-context";
import { portalPages } from "@/i18n/dictionaries/portal-pages";
import { tFill } from "@/i18n/format";

/**
 * Fraktavgift och gräns för fri frakt vid hemleverans. Bara för intern
 * admin: det här är priser mot kund, och API:t loggar varje ändring.
 */

/** "" → null (inget värde), "49" → 4900. Annat än hela kronor → "invalid". */
function parseKronor(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,6}$/.test(trimmed)) return "invalid";
  return Number(trimmed) * 100;
}

function toKronorInput(ore: number | null): string {
  return ore === null ? "" : String(Math.round(ore / 100));
}

export function ShippingSettingsCard() {
  const { locale } = useLocale();
  const t = portalPages.frakt[locale];
  const { toast } = useToast();

  const [saved, setSaved] = useState<ShippingSettings | null>(null);
  const [fee, setFee] = useState("");
  const [threshold, setThreshold] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await apiFetch<{ shipping?: ShippingSettings }>(
        "/v1/admin/settings/shipping"
      );
      if (!res.ok || !res.data?.shipping) {
        setLoadFailed(true);
        return;
      }
      setSaved(res.data.shipping);
      setFee(toKronorInput(res.data.shipping.homeDeliveryFeeOre));
      setThreshold(toKronorInput(res.data.shipping.freeShippingThresholdOre));
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError(null);
    const feeOre = parseKronor(fee);
    const thresholdOre = parseKronor(threshold);
    if (feeOre === "invalid" || thresholdOre === "invalid" || thresholdOre === 0) {
      setError(t.invalidAmount);
      return;
    }
    if (feeOre === null && thresholdOre !== null) {
      setError(t.thresholdNeedsFee);
      return;
    }

    const question =
      feeOre === null
        ? t.confirmUnset
        : tFill(t.confirmSet, {
            fee: formatKr(feeOre, locale),
            threshold:
              thresholdOre === null
                ? t.valueNone
                : tFill(t.valueFreeFrom, { amount: formatKr(thresholdOre, locale) }),
          });
    if (!window.confirm(question)) return;

    setSaving(true);
    try {
      const res = await apiFetch<{ shipping?: ShippingSettings; error?: string }>(
        "/v1/admin/settings/shipping",
        {
          method: "PUT",
          body: {
            homeDeliveryFeeOre: feeOre,
            freeShippingThresholdOre: thresholdOre,
            locale,
          },
        }
      );
      if (!res.ok || !res.data?.shipping) {
        setError(res.data?.error || t.saveFail);
        return;
      }
      setSaved(res.data.shipping);
      toast(t.saved, "success");
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    saved !== null &&
    (fee.trim() !== toKronorInput(saved.homeDeliveryFeeOre) ||
      threshold.trim() !== toKronorInput(saved.freeShippingThresholdOre));

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t.title}</h2>
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {t.intro}
        </p>

        {loadFailed ? (
          <p className="text-sm text-destructive" role="alert">
            {t.loadFail}
          </p>
        ) : saved === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <p className="rounded-lg bg-brand-50 p-3 text-sm" role="status">
              {saved.homeDeliveryFeeOre === null
                ? t.statusUnset
                : [
                    saved.homeDeliveryFeeOre === 0
                      ? t.statusFeeFree
                      : tFill(t.statusFee, {
                          fee: formatKr(saved.homeDeliveryFeeOre, locale),
                        }),
                    saved.homeDeliveryFeeOre === 0
                      ? ""
                      : saved.freeShippingThresholdOre === null
                        ? t.statusNoThreshold
                        : tFill(t.statusThreshold, {
                            threshold: formatKr(saved.freeShippingThresholdOre, locale),
                          }),
                  ]
                    .filter(Boolean)
                    .join(" ")}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shipping-fee">{t.feeLabel}</Label>
                <Input
                  id="shipping-fee"
                  inputMode="numeric"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder={t.feePlaceholder}
                />
                <p className="text-pretty text-xs text-muted-foreground">{t.feeHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping-threshold">{t.thresholdLabel}</Label>
                <Input
                  id="shipping-threshold"
                  inputMode="numeric"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={t.thresholdPlaceholder}
                />
                <p className="text-pretty text-xs text-muted-foreground">
                  {t.thresholdHint}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : (
                t.save
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
