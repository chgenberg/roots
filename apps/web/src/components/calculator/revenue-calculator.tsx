"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeCalculator,
  CALCULATOR_DEFAULTS,
  LOCKED_MARGIN_PERCENT,
  type CalculatorInputs,
  type CalculatorResult,
} from "@roots/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { GoalGauge } from "@/components/charts";
import { cn } from "@/lib/utils";
import { Download, Lock } from "lucide-react";
import { formatKr } from "@/lib/format";
import { downloadCalculatorPdf } from "@/lib/calculator-pdf";
import { useLocale } from "@/i18n/locale-context";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";

const MEMBER_PRESETS = [20, 50, 100, 200, 300, 500] as const;
const AVG_PRESETS = [1000, 1500, 2000, 2500, 3000, 4000] as const;

function krLabel(kr: number, locale: string): string {
  const tag = locale === "en" ? "en-GB" : "sv-SE";
  return `${Math.round(kr).toLocaleString(tag)} ${locale === "en" ? "SEK" : "kr"}`;
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  locale: string;
  onChange: (v: number) => void;
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  locale,
  onChange,
}: SliderFieldProps) {
  function clamp(v: number) {
    if (Number.isNaN(v)) return min;
    const snapped = step > 1 ? Math.round(v / step) * step : v;
    return Math.min(max, Math.max(min, snapped));
  }
  const numberLocale = locale === "en" ? "en-GB" : "sv-SE";
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-right text-base font-semibold tabular-nums text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          />
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-brand-100 accent-[#6B794F]"
        aria-label={label}
      />
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>
          {min.toLocaleString(numberLocale)}
          {suffix ? ` ${suffix}` : ""}
        </span>
        <span>
          {max.toLocaleString(numberLocale)}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PresetRow({
  label,
  values,
  format,
  active,
  onPick,
}: {
  label: string;
  values: readonly number[];
  format: (v: number) => string;
  active: number;
  onPick: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const selected = active === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm tabular-nums transition-colors",
                selected
                  ? "bg-brand-700 text-white"
                  : "bg-brand-50 text-brand-800 hover:bg-brand-100"
              )}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RevenueCalculatorProps {
  defaultInputs?: Partial<CalculatorInputs>;
  products?: { name: string; priceOre: number }[];
  onChange?: (inputs: CalculatorInputs, result: CalculatorResult) => void;
  className?: string;
}

export function RevenueCalculator({
  defaultInputs,
  products,
  onChange,
  className,
}: RevenueCalculatorProps) {
  const { locale } = useLocale();
  const t = marketingUi[locale].calculator;
  const [inputs, setInputs] = useState<CalculatorInputs>(() => {
    const merged: CalculatorInputs = {
      ...CALCULATOR_DEFAULTS,
      ...defaultInputs,
      marginPercent: LOCKED_MARGIN_PERCENT,
    };
    return {
      ...merged,
      sellers: Math.min(1000, Math.max(1, Math.round(merged.sellers || 50))),
      avgPerSellerKr: Math.min(5_000, Math.max(0, merged.avgPerSellerKr || 1500)),
    };
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGoal, setShowGoal] = useState(Boolean(inputs.goalKr));
  const [ordersPerSeller, setOrdersPerSeller] = useState(3);
  const [avgOrderKr, setAvgOrderKr] = useState(500);

  const result = useMemo(() => computeCalculator(inputs), [inputs]);
  const money = (kr: number) => krLabel(kr, locale);
  const packagesApprox = Math.max(
    0,
    Math.round(inputs.avgPerSellerKr / 399)
  );

  useEffect(() => {
    onChange?.(inputs, result);
  }, [inputs, result, onChange]);

  function set<K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K]
  ) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function applyAdvanced(orders: number, avg: number) {
    setOrdersPerSeller(orders);
    setAvgOrderKr(avg);
    set("avgPerSellerKr", Math.min(5_000, Math.round(orders * avg)));
  }

  const avgProductKr =
    products && products.length > 0
      ? Math.round(
          products.reduce((s, p) => s + p.priceOre, 0) / products.length / 100
        )
      : null;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-5", className)}>
      <Card className="border-brand-100 lg:col-span-2">
        <CardContent className="space-y-7 p-6 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
              {locale === "en" ? "Your numbers" : "Era siffror"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "en"
                ? "Two sliders. The green number updates live."
                : "Två reglage. Den gröna siffran uppdateras direkt."}
            </p>
          </div>

          <div className="space-y-4">
            <SliderField
              label={t.sellers}
              value={inputs.sellers}
              min={1}
              max={1000}
              step={1}
              locale={locale}
              onChange={(v) => set("sellers", v)}
              hint={t.sellersHint}
            />
            <PresetRow
              label={locale === "en" ? "Quick pick" : "Snabbval"}
              values={MEMBER_PRESETS}
              format={(v) => String(v)}
              active={inputs.sellers}
              onPick={(v) => set("sellers", v)}
            />
          </div>

          {!showAdvanced ? (
            <div className="space-y-4">
              <SliderField
                label={t.avgPerSeller}
                value={inputs.avgPerSellerKr}
                min={0}
                max={5000}
                step={50}
                locale={locale}
                suffix={locale === "en" ? "SEK" : "kr"}
                onChange={(v) => set("avgPerSellerKr", v)}
                hint={
                  avgProductKr
                    ? locale === "en"
                      ? `≈ ${packagesApprox} premium packs · a product is about ${avgProductKr} SEK`
                      : `≈ ${packagesApprox} Premiumpaket · en produkt kostar ca ${avgProductKr} kr`
                    : locale === "en"
                      ? `≈ ${packagesApprox} premium packs at SEK 399`
                      : `≈ ${packagesApprox} Premiumpaket à 399 kr`
                }
              />
              <PresetRow
                label={locale === "en" ? "Quick pick" : "Snabbval"}
                values={AVG_PRESETS}
                format={(v) =>
                  locale === "en"
                    ? `${v.toLocaleString("en-GB")} SEK`
                    : `${v.toLocaleString("sv-SE")} kr`
                }
                active={inputs.avgPerSellerKr}
                onPick={(v) => set("avgPerSellerKr", v)}
              />
            </div>
          ) : (
            <div className="space-y-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/30 p-4">
              <SliderField
                label={t.ordersPerSeller}
                value={ordersPerSeller}
                min={1}
                max={50}
                locale={locale}
                onChange={(v) => applyAdvanced(v, avgOrderKr)}
              />
              <SliderField
                label={t.avgOrder}
                value={avgOrderKr}
                min={0}
                max={5000}
                step={50}
                locale={locale}
                suffix={locale === "en" ? "SEK" : "kr"}
                onChange={(v) => applyAdvanced(ordersPerSeller, v)}
              />
              <p className="text-xs text-muted-foreground">
                = {money(inputs.avgPerSellerKr)} {t.perSeller}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {showAdvanced ? t.simpleMode : t.advancedMode}
          </button>

          <div className="rounded-xl bg-brand-50/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {t.marginLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1 text-sm font-semibold tabular-nums text-white">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {LOCKED_MARGIN_PERCENT}%
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.marginBody.replace("{pct}", String(LOCKED_MARGIN_PERCENT))}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowGoal((v) => !v)}
              className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              {showGoal
                ? locale === "en"
                  ? "Hide goal"
                  : "Dölj mål"
                : locale === "en"
                  ? "Add a fundraising goal (optional)"
                  : "Lägg till insamlingsmål (valfritt)"}
            </button>
            {showGoal && (
              <div className="mt-4">
                <SliderField
                  label={t.goal}
                  value={inputs.goalKr ?? 0}
                  min={0}
                  max={500000}
                  step={5000}
                  locale={locale}
                  suffix={locale === "en" ? "SEK" : "kr"}
                  onChange={(v) => set("goalKr", v)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-3">
        <Card className="overflow-hidden border-0 bg-brand-700 text-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <p className="text-sm font-medium text-brand-100">
              {locale === "en" ? "Your club earns" : "Er förening tjänar"}
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
              {money(result.earningsKr)}
            </p>
            <p className="mt-3 text-sm text-brand-100/90">
              {t.ofGross.replace("{gross}", money(result.grossKr))} ·{" "}
              {result.marginPercent}%
            </p>
            <button
              type="button"
              onClick={() =>
                void downloadCalculatorPdf({ inputs, result, locale })
              }
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t.downloadPdf}
            </button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-brand-100">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t.perSellerLabel}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-brand-800">
                {money(result.earningsPerSellerKr)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-brand-100">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t.totalSales}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-brand-800">
                {money(result.grossKr)}
              </p>
            </CardContent>
          </Card>
          <Card className="flex items-center justify-center border-brand-100">
            <CardContent className="flex items-center justify-center p-3">
              {result.goalKr ? (
                <GoalGauge
                  currentOre={result.earningsKr * 100}
                  goalOre={result.goalKr * 100}
                  format={formatKr}
                  size={170}
                />
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t.setGoal}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">{t.disclaimer}</p>
      </div>
    </div>
  );
}
