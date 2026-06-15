"use client";

import { useId, useRef, useState } from "react";
import { CHART } from "./theme";

export interface TrendPoint {
  label: string;
  value: number;
}

interface AreaTrendProps {
  points: TrendPoint[];
  height?: number;
  /** Formatterar värdet i tooltip. */
  format: (v: number) => string;
  color?: string;
  /** Valfri referenslinje (t.ex. mål). */
  reference?: { value: number; label: string } | null;
}

const VW = 1000; // intern koordinatbredd
const PAD_T = 12;
const PAD_B = 22;

export function AreaTrend({
  points,
  height = 220,
  format,
  color = CHART.primary,
  reference = null,
}: AreaTrendProps) {
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = points.length;
  const maxRaw = Math.max(
    1,
    ...points.map((p) => p.value),
    reference?.value ?? 0
  );
  // Lite luft över toppen.
  const max = maxRaw * 1.12;
  const innerH = height - PAD_T - PAD_B;

  const x = (i: number) => (n <= 1 ? VW / 2 : (i / (n - 1)) * VW);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L${x(n - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`
      : "";

  // Glesa ut x-etiketter så de inte krockar (max ~6 st).
  const tickEvery = Math.max(1, Math.ceil(n / 6));

  function handleMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  }

  const refY = reference ? y(reference.value) : 0;

  return (
    <div className="relative" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${VW} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Försäljningstrend"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horisontella hjälplinjer */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={VW}
            y1={PAD_T + innerH * f}
            y2={PAD_T + innerH * f}
            stroke={CHART.grid}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {areaPath && <path d={areaPath} fill={`url(#fill-${gid})`} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* referenslinje (mål) */}
        {reference && (
          <line
            x1="0"
            x2={VW}
            y1={refY}
            y2={refY}
            stroke={CHART.ink}
            strokeWidth="1.5"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* hover-markör */}
        {hover !== null && points[hover] && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke={CHART.muted}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(hover)}
              cy={y(points[hover].value)}
              r="4"
              fill={color}
              stroke="#fff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* x-axel-etiketter */}
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {points.map((p, i) =>
          i % tickEvery === 0 || i === n - 1 ? (
            <span key={i}>{p.label}</span>
          ) : null
        )}
      </div>

      {/* referens-etikett */}
      {reference && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          – – {reference.label}
        </p>
      )}

      {/* tooltip */}
      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-background px-2.5 py-1.5 shadow-[var(--shadow-card)]"
          style={{ left: `${(x(hover) / VW) * 100}%` }}
        >
          <p className="whitespace-nowrap text-xs font-semibold">
            {format(points[hover].value)}
          </p>
          <p className="whitespace-nowrap text-[10px] text-muted-foreground">
            {points[hover].label}
          </p>
        </div>
      )}
    </div>
  );
}
