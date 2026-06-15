"use client";

import { useState } from "react";
import { CHART } from "./theme";

export interface BarPoint {
  label: string;
  value: number;
}

interface BarSeriesProps {
  data: BarPoint[];
  height?: number;
  format: (v: number) => string;
  color?: string;
}

export function BarSeries({
  data,
  height = 160,
  format,
  color = CHART.primary,
}: BarSeriesProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-2" style={{ height: height + 28 }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * height);
        const active = hover === i;
        return (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center gap-1.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={`text-[10px] font-medium transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
            >
              {format(d.value)}
            </span>
            <div
              className="w-full rounded-t-md transition-all duration-300"
              style={{
                height: Math.max(2, h),
                backgroundColor: active ? CHART.ink : color,
              }}
            />
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
