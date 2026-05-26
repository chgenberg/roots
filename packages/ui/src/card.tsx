import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated";
}

export function Card({
  children,
  className = "",
  variant = "default",
}: CardProps) {
  // P2.55 (audit 2026-05-26): tidigare hardcodade vi pre-E13 hex
  // (#E8E4E0, #FFF) vilket innebar att Card och Input inte följde
  // theme-token-systemet och inte respekterade dark-mode/branded
  // surfaces. Använd border-border + bg-card så Tailwind theme +
  // CSS-variabler styr.
  const base = "rounded-lg border border-border bg-card";
  const shadow = variant === "elevated" ? "shadow-md" : "";

  return (
    <div className={`${base} ${shadow} p-6 ${className}`}>{children}</div>
  );
}
