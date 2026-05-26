import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-brand-900">
          {label}
        </label>
      )}
      {/* P2.54 + P2.55 (audit 2026-05-26): byter hardcodade hex
          (#D4CCC4, #8C2F2F, #FFF) mot semantiska tokens — border,
          bg-background, destructive — så error-staten också använder
          plattformens design-system. */}
      <input
        id={id}
        className={`h-11 rounded-lg border border-input bg-background px-4 text-base text-brand-900 placeholder:text-muted-foreground focus:border-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-900/20 ${error ? "border-destructive" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
