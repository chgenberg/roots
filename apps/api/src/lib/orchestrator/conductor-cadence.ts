import { parseCadence, type ConductorCadence } from "@roots/contracts";
import { stockholmDateIso } from "../date";

export function cadenceLookMs(cadence: string): number | null {
  const id = parseCadence(cadence);
  if (id === "always") return null;
  if (id === "hourly") return 60 * 60 * 1000;
  if (id === "every_6h") return 6 * 60 * 60 * 1000;
  if (id === "every_12h") return 12 * 60 * 60 * 1000;
  if (id === "daily") return 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function isCadenceDue(
  rule: { cadence: string; lastLookedAt: Date | null },
  now = Date.now()
): boolean {
  const ms = cadenceLookMs(rule.cadence);
  if (ms == null) return true;
  if (!rule.lastLookedAt) return true;
  return now - rule.lastLookedAt.getTime() >= ms;
}

function stockholmHour(d: Date): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return Number(raw);
}

function stockholmWeekKey(d: Date): string {
  const day = stockholmDateIso(d);
  const [y, m, dd] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, dd));
  const dow = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Bucket in job keys so same order can köras igen nästa period. */
export function cadenceBucket(cadence?: string, now = new Date()): string | null {
  const id: ConductorCadence = cadence ? parseCadence(cadence) : "always";
  if (id === "always") return null;
  const date = stockholmDateIso(now);
  const hour = stockholmHour(now);
  if (id === "hourly") return `${date}T${String(hour).padStart(2, "0")}`;
  if (id === "every_6h") {
    const block = Math.floor(hour / 6) * 6;
    return `${date}T${String(block).padStart(2, "0")}`;
  }
  if (id === "every_12h") {
    const block = Math.floor(hour / 12) * 12;
    return `${date}T${String(block).padStart(2, "0")}`;
  }
  if (id === "daily") return date;
  return stockholmWeekKey(now);
}

export function jobKey(
  ruleId: string,
  entityId: string,
  event: string,
  cadence?: string
): string {
  const base = `rule:${ruleId}:${entityId}:${event}`;
  const bucket = cadenceBucket(cadence);
  return bucket ? `${base}:${bucket}` : base;
}
