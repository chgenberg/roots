"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { tFill } from "@/i18n/format";

/**
 * Återbetalning via Stripe. Visas bara när servern säger att användaren får
 * (`canRefund`, alltså intern admin på en betald kortorder).
 *
 * Två steg med flit: först belopp och skäl, sedan en bekräftelse som säger
 * beloppet i klartext. Pengarna lämnar kontot när den andra knappen trycks.
 *
 * Varje försök bär en nyckel (`requestId`) och det belopp som enligt den här
 * sidan redan är återbetalt. Samma nyckel blir aldrig två återbetalningar,
 * och har ordern ändrats sedan sidan laddades säger servern ifrån. Efter
 * varje misslyckat försök hämtas ordern om, så att "kvar att återbetala"
 * alltid är det som gäller.
 */

type PayoutEffect =
  | { kind: "none" }
  | { kind: "recalculated"; after: { teamShareOre: number } }
  | { kind: "flagged"; overpaidOre: number };

interface RefundResponse {
  ok?: boolean;
  error?: string;
  stripeError?: string;
  /** Försöket är avslutat. Nästa behöver en ny nyckel. */
  restart?: boolean;
  /** Ett tidigare försök hade gått igenom hos Stripe och bokfördes nu. */
  recovered?: boolean;
  /** Stripe har återbetalningar som inte är bokförda här. De måste hämtas först. */
  needsSync?: boolean;
  recoveredAmountOre?: number;
  order?: { status: string };
  refund?: { amountOre: number };
  payout?: PayoutEffect | null;
}

interface SyncResponse {
  ok?: boolean;
  error?: string;
  recovered?: number;
  recorded?: number;
  recordedOre?: number;
  missingAtStripe?: Array<{ refundId: string }>;
  payout?: PayoutEffect | null;
  order?: { status: string };
}

interface Props {
  orderId: string;
  totalOre: number;
  shippingOre: number;
  refundedOre: number;
  refundedShippingOre: number;
  /** Satt när Roots redan lämnat ordern till lagret. */
  sentToWarehouseAt?: string | null;
  /**
   * Anropas när något bokförts på ordern, så att dialogen laddar om den.
   * `payoutNote` säger vad som hände med lagets utbetalning.
   */
  onRefunded: (status: string, payoutNote: string | null) => void;
  /** Anropas efter ett misslyckat försök: ordern kan ändå ha ändrats. */
  onUncertain: () => void;
}

function newRequestId(): string {
  return `web-${crypto.randomUUID()}`;
}

/** "100" eller "99,50" → öre. Annat → null. */
function parseKronorToOre(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export function OrderRefundSection({
  orderId,
  totalOre,
  shippingOre,
  refundedOre,
  refundedShippingOre,
  sentToWarehouseAt,
  onRefunded,
  onUncertain,
}: Props) {
  const { locale } = useLocale();
  const t = fundraisingPages.orderDetail[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;
  const { toast } = useToast();

  const remainingOre = totalOre - refundedOre;
  const remainingShippingOre = shippingOre - refundedShippingOre;
  const remainingGoodsOre = remainingOre - remainingShippingOre;

  // Belopp visas med ören när de finns: en återbetalning ska stämma på öret.
  const money = (ore: number) =>
    `${(ore / 100).toLocaleString(dateLocale, {
      minimumFractionDigits: ore % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ${c.kr}`;

  const [step, setStep] = useState<"closed" | "form" | "confirm">("closed");
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [goodsInput, setGoodsInput] = useState("");
  const [includeShipping, setIncludeShipping] = useState(false);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState(newRequestId);
  const [working, setWorking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partialGoodsOre = mode === "partial" ? parseKronorToOre(goodsInput || "0") : null;
  const goodsOre = mode === "full" ? remainingGoodsOre : (partialGoodsOre ?? -1);
  const refundShippingOre =
    mode === "full" ? remainingShippingOre : includeShipping ? remainingShippingOre : 0;
  const amountOre = goodsOre + refundShippingOre;
  const amountValid = goodsOre >= 0 && goodsOre <= remainingGoodsOre && amountOre > 0;
  const formValid = amountValid && reason.trim().length >= 3;

  function reset() {
    setStep("closed");
    setMode("full");
    setGoodsInput("");
    setIncludeShipping(false);
    setReason("");
    setError(null);
    setRequestId(newRequestId());
  }

  function payoutNote(payout: PayoutEffect | null | undefined): string | null {
    return payout?.kind === "recalculated"
      ? tFill(t.refundPayoutRecalculated, { amount: money(payout.after.teamShareOre) })
      : payout?.kind === "flagged"
        ? tFill(t.refundPayoutFlagged, { amount: money(payout.overpaidOre) })
        : null;
  }

  async function submit() {
    setWorking(true);
    setError(null);
    try {
      const res = await apiFetch<RefundResponse>(`/v1/admin/orders/${orderId}/refund`, {
        method: "POST",
        body: {
          requestId,
          reason: reason.trim(),
          // Vad som enligt den här sidan redan är återbetalt. Stämmer det
          // inte med ordern görs ingen ny återbetalning.
          expectedRefundedOre: refundedOre,
          ...(mode === "full"
            ? { full: true }
            : { goodsOre, shippingOre: refundShippingOre }),
          locale,
        },
      });
      const data = res.data;
      if (res.ok && data?.order) {
        toast(
          tFill(t.refundDone, { amount: money(data.refund?.amountOre ?? amountOre) }),
          "success"
        );
        reset();
        onRefunded(data.order.status, payoutNote(data.payout));
        return;
      }

      if (data?.recovered) {
        // Ett äldre försök hade gått fram hos Stripe och är nu bokfört.
        // Formuläret stängs så att nästa steg utgår från den nya ordern.
        const note = tFill(t.refundRecovered, {
          amount: money(data.recoveredAmountOre ?? 0),
        });
        reset();
        onRefunded("", note);
        return;
      }

      if (data?.needsSync || res.status === 409) {
        // Ordern eller läget hos Stripe är inte det som formuläret utgick
        // från (någon annan har återbetalat, ett försök pågår, eller Stripe
        // har något som inte är bokfört). Formuläret stängs, så att nästa
        // försök görs med ordern som den ser ut nu, inte med ett klick till.
        toast(data?.error || t.refundFailedGeneric, "error");
        reset();
        onUncertain();
        return;
      }

      setError(
        [
          data?.error || t.refundFailedGeneric,
          data?.stripeError ? tFill(t.refundStripeSaid, { message: data.stripeError }) : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      // Avslutat försök: nästa behöver en ny nyckel. Vid avbrott behålls
      // nyckeln, så att "Försök igen" slutför samma återbetalning i stället
      // för att starta en till.
      if (data?.restart) setRequestId(newRequestId());
      onUncertain();
    } catch {
      setError(t.refundFailedGeneric);
      onUncertain();
    } finally {
      setWorking(false);
    }
  }

  async function syncFromStripe() {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiFetch<SyncResponse>(`/v1/admin/orders/${orderId}/refunds/sync`, {
        method: "POST",
        body: { locale },
      });
      const data = res.data;
      if (!res.ok || !data?.order) {
        toast(data?.error || t.refundSyncFailed, "error");
        return;
      }
      const booked = (data.recovered ?? 0) + (data.recorded ?? 0);
      const missing = data.missingAtStripe?.length ?? 0;
      if (missing > 0) {
        toast(tFill(t.refundSyncMissing, { count: missing }), "error");
      } else if (booked === 0) {
        toast(t.refundSyncNothing, "success");
      }
      if (booked > 0) {
        toast(
          tFill(t.refundSyncDone, { amount: money(data.recordedOre ?? 0), count: booked }),
          "success"
        );
        reset();
        onRefunded(data.order.status, payoutNote(data.payout));
      } else {
        onUncertain();
      }
    } catch {
      toast(t.refundSyncFailed, "error");
    } finally {
      setSyncing(false);
    }
  }

  if (step === "closed") {
    return (
      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {remainingOre > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep("form")}>
              <Undo2 className="mr-2 h-4 w-4" />
              {t.refundStart}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={syncing}
            onClick={() => void syncFromStripe()}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {syncing ? t.refundSyncing : t.refundSync}
          </Button>
        </div>
        <p className="text-pretty text-xs text-muted-foreground">{t.refundSyncHint}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {step === "confirm" ? t.refundConfirmTitle : t.refundTitle}
        </h3>
        {step === "form" && (
          <>
            <p className="mt-1 text-pretty text-xs text-muted-foreground">{t.refundIntro}</p>
            <p className="mt-2 text-sm">
              {tFill(t.refundRemaining, { amount: money(remainingOre) })}
              {remainingShippingOre > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({tFill(t.refundRemainingShipping, { amount: money(remainingShippingOre) })})
                </span>
              )}
            </p>
          </>
        )}
      </div>

      {sentToWarehouseAt && (
        <p className="text-pretty rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t.refundSentToWarehouse}
        </p>
      )}

      {step === "form" && (
        <>
          <fieldset className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="refund-mode"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                className="h-4 w-4 accent-brand-700"
              />
              {tFill(t.refundFull, { amount: money(remainingOre) })}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="refund-mode"
                checked={mode === "partial"}
                onChange={() => setMode("partial")}
                className="h-4 w-4 accent-brand-700"
              />
              {t.refundPartial}
            </label>
          </fieldset>

          {mode === "partial" && (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="refund-goods">{t.refundGoodsLabel}</Label>
                <Input
                  id="refund-goods"
                  inputMode="decimal"
                  value={goodsInput}
                  onChange={(e) => setGoodsInput(e.target.value)}
                  placeholder="0"
                  className="max-w-[160px]"
                />
                <p className="text-xs text-muted-foreground">
                  {tFill(t.refundGoodsHint, { amount: money(remainingGoodsOre) })}
                </p>
              </div>
              {remainingShippingOre > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeShipping}
                    onChange={(e) => setIncludeShipping(e.target.checked)}
                    className="h-4 w-4 accent-brand-700"
                  />
                  {tFill(t.refundShippingToo, { amount: money(remainingShippingOre) })}
                </label>
              )}
              {!amountValid && (goodsInput.trim() !== "" || includeShipping) && (
                <p className="text-xs text-destructive" role="alert">
                  {tFill(t.refundAmountInvalid, { amount: money(remainingGoodsOre) })}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="refund-reason">{t.reasonLabel}</Label>
            <textarea
              id="refund-reason"
              rows={2}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.refundReasonPlaceholder}
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </>
      )}

      {step === "confirm" && (
        <div className="space-y-1 text-sm">
          <p className="text-pretty font-medium">
            {tFill(t.refundConfirmBody, { amount: money(amountOre) })}
          </p>
          <p className="text-muted-foreground">
            {tFill(t.refundConfirmBreakdown, {
              goods: money(goodsOre),
              shipping: money(refundShippingOre),
            })}
          </p>
          <p className="text-muted-foreground">
            {t.reasonLabel}: {reason.trim()}
          </p>
        </div>
      )}

      {error && (
        <p className="text-pretty text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {step === "form" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={!formValid}
            onClick={() => {
              setError(null);
              setStep("confirm");
            }}
          >
            {t.refundContinue}
          </Button>
        )}
        {step === "confirm" && (
          <>
            <Button
              size="sm"
              variant="destructive"
              // Har ordern hämtats om och beloppet inte längre ryms går det
              // inte att bekräfta förrän formuläret rättats.
              disabled={working || !formValid}
              onClick={() => void submit()}
            >
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {working
                ? t.refundWorking
                : error
                  ? t.refundRetry
                  : tFill(t.refundConfirmButton, { amount: money(amountOre) })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={working}
              onClick={() => {
                // Ändras beloppet är det ett nytt försök och behöver en ny
                // nyckel. Ett avbrutet försök med den gamla nyckeln reder
                // servern ut mot Stripe innan något nytt betalas tillbaka.
                setRequestId(newRequestId());
                setError(null);
                setStep("form");
              }}
            >
              {t.refundBack}
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" disabled={working} onClick={reset}>
          {t.cancel}
        </Button>
      </div>
    </section>
  );
}
