/** Porträtt och ring — samma figurer som Billboardbee, samma URL-mönster. */

export const AGENT_SEATS = 7;
export const AGENT_FIGURES = 16;
export const RING_BASELINE = AGENT_SEATS;

export function portraitSrc(slot: number): string {
  const n = Math.min(AGENT_FIGURES, Math.max(1, Math.round(slot) || 1));
  return `/Agenter/Agent${n}.png`;
}

export function isAgentFigure(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= AGENT_FIGURES;
}

export function unusedFigures(used: Iterable<number>): number[] {
  const taken = new Set(Array.from(used).filter(isAgentFigure));
  return Array.from({ length: AGENT_FIGURES }, (_, i) => i + 1).filter(
    (n) => !taken.has(n)
  );
}

export function hireFigures(used: Iterable<number>): number[] {
  return unusedFigures(used);
}

export function ringScale(count: number): number {
  const n = Math.max(1, count);
  if (n <= RING_BASELINE) return 1;
  return Math.max(0.52, RING_BASELINE / n);
}

export function ringRadiusPct(count: number): number {
  const n = Math.max(1, count);
  if (n <= RING_BASELINE) return 40;
  return Math.min(44, 40 + (n - RING_BASELINE) * 0.35);
}

export function seatStyle(
  index: number,
  count: number
): { left: string; top: string } {
  const n = Math.max(1, count);
  const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
  const r = ringRadiusPct(n);
  return {
    left: `${50 + r * Math.cos(angle)}%`,
    top: `${50 + r * Math.sin(angle)}%`,
  };
}

export function ringBoxRem(count: number): { base: number; sm: number } {
  const s = ringScale(count);
  return { base: 6.2 * s, sm: 7.6 * s };
}

export function ringColRem(count: number): { base: number; sm: number } {
  const s = ringScale(count);
  return { base: 6.8 * s, sm: 8.2 * s };
}

export const DESK_ACCENTS = ["ink", "orange", "faint", "cerise"] as const;
export type DeskAccent = (typeof DESK_ACCENTS)[number];

export function isDeskAccent(v: string): v is DeskAccent {
  return (DESK_ACCENTS as readonly string[]).includes(v);
}

export const CONDUCTOR_CADENCES = [
  "always",
  "hourly",
  "every_6h",
  "every_12h",
  "daily",
  "weekly",
] as const;

export type ConductorCadence = (typeof CONDUCTOR_CADENCES)[number];

export const CADENCE_LABELS: Record<ConductorCadence, string> = {
  always: "Hela tiden",
  hourly: "Varje timme",
  every_6h: "Var 6:e timme",
  every_12h: "Var 12:e timme",
  daily: "En gång per dygn",
  weekly: "En gång per vecka",
};

export function isConductorCadence(v: string): v is ConductorCadence {
  return (CONDUCTOR_CADENCES as readonly string[]).includes(v);
}

export function parseCadence(v: string | null | undefined): ConductorCadence {
  return v && isConductorCadence(v) ? v : "always";
}
