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
      <input
        id={id}
        className={`h-11 rounded-lg border border-[#D4CCC4] bg-white px-4 text-base text-brand-900 placeholder:text-brand-900/40 focus:border-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-900/20 ${error ? "border-[#8C2F2F]" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-[#8C2F2F]">{error}</p>}
    </div>
  );
}
