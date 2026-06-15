"use client";

import { CHART } from "./theme";

export interface RankedItem {
  id: string;
  name: string;
  value: number;
  sub?: string;
}

interface RankedBarsProps {
  items: RankedItem[];
  format: (v: number) => string;
  /** Markera topp-3 med mörkare ink-färg. */
  highlightTop?: boolean;
  max?: number;
}

export function RankedBars({
  items,
  format,
  highlightTop = true,
  max,
}: RankedBarsProps) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));

  return (
    <ol className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.max(2, Math.round((item.value / top) * 100));
        const isTop = highlightTop && i === 0;
        return (
          <li key={item.id}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    backgroundColor: isTop ? CHART.ink : CHART.track,
                    color: isTop ? "#fff" : CHART.muted,
                  }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium">{item.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {format(item.value)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: CHART.track }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isTop ? CHART.ink : CHART.primary,
                }}
              />
            </div>
            {item.sub && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{item.sub}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
