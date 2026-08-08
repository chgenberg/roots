"use client";

import { useEffect, useState } from "react";
import { getBrowserApiBase } from "@/lib/api-base";
import { rootsFetch } from "@/lib/api";
import type { Locale } from "@/i18n/config";
import { formatDayLabel, paymentLabel } from "./theme";
import type { TrendPoint } from "./area-trend";

const API_URL = getBrowserApiBase();

export interface StatsResponse {
  scope: "association" | "team" | "seller";
  daily: Array<{ day: string; salesOre: number; orders: number }>;
  payments: Array<{ method: string; salesOre: number; count: number }>;
  weekday: Array<{ label: string; salesOre: number }>;
  breakdown: Array<{
    id: string;
    name: string;
    salesOre: number;
    orders?: number;
    units?: number;
  }>;
  goalOre: number;
  currentOre: number;
  totals: { salesOre: number; orders: number; avgOrderOre: number };
  periodStart: string;
  periodEnd: string;
}

export function useStats(path: string | null) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    rootsFetch(`${API_URL}${path}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: StatsResponse) => {
        if (!cancelled) {
          setData(json);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}

/** Bygger en kontinuerlig daglig axel (nollfyller dagar utan ordrar). */
export function buildDailyAxis(
  daily: StatsResponse["daily"],
  periodStart: string,
  periodEnd: string,
  locale: Locale = "sv"
): { sales: TrendPoint[]; cumulative: TrendPoint[] } {
  const byDay = new Map(daily.map((d) => [d.day, d.salesOre]));
  const out: TrendPoint[] = [];
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  // Skydd mot orimliga intervall.
  const maxDays = 180;
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < maxDays) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({
      label: formatDayLabel(iso, locale),
      value: byDay.get(iso) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  let running = 0;
  const cumulative = out.map((p) => {
    running += p.value;
    return { label: p.label, value: running };
  });
  return { sales: out, cumulative };
}

export function paymentSlices(
  payments: StatsResponse["payments"],
  locale: "sv" | "en" = "sv"
) {
  return payments.map((p) => ({
    label: paymentLabel(p.method, locale),
    value: p.salesOre,
  }));
}
