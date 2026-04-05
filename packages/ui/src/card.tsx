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
  const base = "rounded-lg border border-[#E8E4E0] bg-white";
  const shadow =
    variant === "elevated"
      ? "shadow-[0_1px_3px_rgba(28,20,16,0.06),0_4px_12px_rgba(28,20,16,0.04)]"
      : "";

  return (
    <div className={`${base} ${shadow} p-6 ${className}`}>{children}</div>
  );
}
