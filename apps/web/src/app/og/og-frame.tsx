import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogParam(url: URL, key: string, max: number): string {
  return (url.searchParams.get(key) ?? "").trim().slice(0, max);
}

/** Gemensam ram för delningsbilder: beige gradient, ordmärke uppe till vänster, domän nere. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(160deg, #F7F3EA 0%, #EFE8DD 55%, #DDD2C6 100%)",
        color: "#3F372B",
      }}
    >
      <div style={{ display: "flex", fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", color: "#6D614D" }}>
        roots
      </div>
      {children}
      <div style={{ display: "flex", fontSize: 26, color: "#7F715B" }}>roots.nu</div>
    </div>
  );
}
