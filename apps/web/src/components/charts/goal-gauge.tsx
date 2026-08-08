"use client";

import { CHART } from "./theme";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";

interface GoalGaugeProps {
  currentOre: number;
  goalOre: number;
  format: (v: number) => string;
  size?: number;
}

const R = 70;
const STROKE = 18;
// Semi-circle: π * r.
const SEMI = Math.PI * R;

export function GoalGauge({
  currentOre,
  goalOre,
  format,
  size = 220,
}: GoalGaugeProps) {
  const { locale } = useLocale();
  const t = fundraisingPages.stats[locale];
  const pct = goalOre > 0 ? Math.min(1, currentOre / goalOre) : 0;
  const pctLabel = goalOre > 0 ? Math.round((currentOre / goalOre) * 100) : 0;
  const dash = pct * SEMI;
  const reached = goalOre > 0 && currentOre >= goalOre;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 16}
        viewBox="0 0 200 116"
        role="img"
        aria-label={t.chartGoalAria}
      >
        {/* track */}
        <path
          d={`M 30 100 A ${R} ${R} 0 0 1 170 100`}
          fill="none"
          stroke={CHART.track}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* progress */}
        <path
          d={`M 30 100 A ${R} ${R} 0 0 1 170 100`}
          fill="none"
          stroke={reached ? CHART.ink : CHART.primary}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${SEMI}`}
          className="transition-all duration-700"
        />
        <text
          x="100"
          y="86"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 26, fontWeight: 800 }}
        >
          {pctLabel}%
        </text>
        <text
          x="100"
          y="104"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          {t.ofGoal}
        </text>
      </svg>
      <div className="mt-1 text-center">
        <p className="text-lg font-bold">{format(currentOre)}</p>
        <p className="text-xs text-muted-foreground">
          {goalOre > 0
            ? tFill(t.goalLabel, { amount: format(goalOre) })
            : t.noGoalYet}
        </p>
      </div>
    </div>
  );
}
