"use client";

import { useState } from "react";
import { seriesColor } from "./theme";

export interface DonutSlice {
  label: string;
  value: number;
}

interface DonutProps {
  data: DonutSlice[];
  /** Etikett i mitten (t.ex. totalsumma). */
  centerLabel?: string;
  centerSub?: string;
  format: (v: number) => string;
  size?: number;
}

const R = 60;
const STROKE = 26;
const C = 2 * Math.PI * R;

export function Donut({
  data,
  centerLabel,
  centerSub,
  format,
  size = 168,
}: DonutProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let offset = 0;
  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const dash = frac * C;
    const arc = {
      color: seriesColor(i),
      dasharray: `${dash} ${C - dash}`,
      dashoffset: -offset,
      index: i,
    };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        role="img"
        aria-label="Fördelning"
        className="shrink-0"
      >
        <g transform="rotate(-90 80 80)">
          {arcs.map((a) => (
            <circle
              key={a.index}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.index ? STROKE + 4 : STROKE}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              className="transition-all duration-200"
              onMouseEnter={() => setHover(a.index)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
        <text
          x="80"
          y={centerSub ? 74 : 84}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 18, fontWeight: 700 }}
        >
          {hover !== null && data[hover]
            ? `${Math.round((data[hover].value / total) * 100)}%`
            : centerLabel}
        </text>
        {centerSub && (
          <text
            x="80"
            y="92"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {hover !== null && data[hover] ? data[hover].label : centerSub}
          </text>
        )}
      </svg>

      <ul className="w-full space-y-1.5">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 transition-colors"
            style={{ backgroundColor: hover === i ? "#FAF6EF" : "transparent" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seriesColor(i) }}
              />
              <span className="truncate text-sm">{d.label}</span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {format(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
