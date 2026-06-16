"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeCalculator,
  CALCULATOR_DEFAULTS,
  type CalculatorInputs,
  type CalculatorResult,
} from "@roots/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { GoalGauge } from "@/components/charts";
import { cn } from "@/lib/utils";

function krLabel(kr: number): string {
  return `${Math.round(kr).toLocaleString("sv-SE")} kr`;
}
/** Öre → "12 300 kr" för GoalGauge. */
function oreToKr(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
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
  onChange,
}: SliderFieldProps) {
  function clamp(v: number) {
    if (Number.isNaN(v)) return min;
    return Math.min(max, Math.max(min, v));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-brand-100 accent-[#6B794F]"
        aria-label={label}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface RevenueCalculatorProps {
  /** Förkonfigurerade antaganden (från en delad länk). */
  defaultInputs?: Partial<CalculatorInputs>;
  /** Produktpriser för kontext (öre). */
  products?: { name: string; priceOre: number }[];
  /** Lyfter aktuella värden + resultat till föräldern (t.ex. lead-formulär). */
  onChange?: (inputs: CalculatorInputs, result: CalculatorResult) => void;
  className?: string;
}

export function RevenueCalculator({
  defaultInputs,
  products,
  onChange,
  className,
}: RevenueCalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    ...CALCULATOR_DEFAULTS,
    ...defaultInputs,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ordersPerSeller, setOrdersPerSeller] = useState(3);
  const [avgOrderKr, setAvgOrderKr] = useState(500);

  const result = useMemo(() => computeCalculator(inputs), [inputs]);

  useEffect(() => {
    onChange?.(inputs, result);
  }, [inputs, result, onChange]);

  function set<K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K]
  ) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  // Avancerat läge: härled snittförsäljning/säljare från ordrar × ordervärde.
  function applyAdvanced(orders: number, avg: number) {
    setOrdersPerSeller(orders);
    setAvgOrderKr(avg);
    set("avgPerSellerKr", Math.round(orders * avg));
  }

  const avgProductKr =
    products && products.length > 0
      ? Math.round(
          products.reduce((s, p) => s + p.priceOre, 0) / products.length / 100
        )
      : null;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-5", className)}>
      {/* Inmatning */}
      <Card className="lg:col-span-2">
        <CardContent className="space-y-6 p-6">
          <SliderField
            label="Antal säljare"
            value={inputs.sellers}
            min={1}
            max={500}
            onChange={(v) => set("sellers", v)}
            hint="Spelare eller medlemmar som faktiskt säljer."
          />

          {!showAdvanced ? (
            <SliderField
              label="Snittförsäljning per säljare"
              value={inputs.avgPerSellerKr}
              min={0}
              max={20000}
              step={100}
              suffix="kr"
              onChange={(v) => set("avgPerSellerKr", v)}
              hint={
                avgProductKr
                  ? `En produkt kostar i snitt ${avgProductKr} kr.`
                  : "Hur mycket varje säljare säljer för i snitt."
              }
            />
          ) : (
            <div className="space-y-6 rounded-lg border border-dashed border-border p-4">
              <SliderField
                label="Antal ordrar per säljare"
                value={ordersPerSeller}
                min={1}
                max={50}
                onChange={(v) => applyAdvanced(v, avgOrderKr)}
              />
              <SliderField
                label="Snittordervärde"
                value={avgOrderKr}
                min={0}
                max={5000}
                step={50}
                suffix="kr"
                onChange={(v) => applyAdvanced(ordersPerSeller, v)}
              />
              <p className="text-xs text-muted-foreground">
                = {krLabel(inputs.avgPerSellerKr)} per säljare
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {showAdvanced
              ? "Använd enkel uppskattning"
              : "Räkna på ordrar × ordervärde"}
          </button>

          <SliderField
            label="Föreningens marginal"
            value={inputs.marginPercent}
            min={0}
            max={50}
            suffix="%"
            onChange={(v) => set("marginPercent", v)}
            hint="Andelen av försäljningen som går till föreningen."
          />

          <SliderField
            label="Mål: insamlat belopp (valfritt)"
            value={inputs.goalKr ?? 0}
            min={0}
            max={500000}
            step={5000}
            suffix="kr"
            onChange={(v) => set("goalKr", v)}
          />
        </CardContent>
      </Card>

      {/* Resultat */}
      <div className="space-y-4 lg:col-span-3">
        <Card className="overflow-hidden border-brand-200 bg-brand-50/40">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">
              Föreningens förtjänst
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-brand-800 sm:text-5xl">
              {krLabel(result.earningsKr)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              av {krLabel(result.grossKr)} i total försäljning ·{" "}
              {result.marginPercent}% marginal
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Per säljare</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {krLabel(result.earningsPerSellerKr)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total försäljning</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {krLabel(result.grossKr)}
              </p>
            </CardContent>
          </Card>
          <Card className="flex items-center justify-center">
            <CardContent className="flex items-center justify-center p-3">
              {result.goalKr ? (
                <GoalGauge
                  currentOre={result.earningsKr * 100}
                  goalOre={result.goalKr * 100}
                  format={oreToKr}
                  size={170}
                />
              ) : (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Sätt ett mål för att se hur långt ni når.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Uppskattning baserad på era antaganden. Faktisk förtjänst beror på hur
          mycket laget säljer under perioden.
        </p>
      </div>
    </div>
  );
}
