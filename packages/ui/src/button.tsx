import type { ButtonHTMLAttributes, ReactNode, ElementType } from "react";

type ButtonProps<T extends ElementType = "button"> = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "className" | "children">;

export function Button<T extends ElementType = "button">({
  children,
  variant = "primary",
  size = "md",
  pulse = false,
  as,
  className = "",
  ...props
}: ButtonProps<T>) {
  const Component = as || "button";

  const base =
    "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary: "bg-brand-900 text-white hover:bg-brand-800",
    secondary:
      "border border-brand-900 text-brand-900 bg-transparent hover:bg-brand-900/5",
  };

  const sizes = {
    sm: "h-9 px-4 text-sm rounded-md",
    md: "h-11 px-6 text-base rounded-lg",
    lg: "h-14 px-8 text-lg rounded-lg",
  };

  const pulseClass =
    pulse && variant === "primary" ? "animate-subtle-pulse" : "";

  return (
    <Component
      className={`${base} ${variants[variant]} ${sizes[size]} ${pulseClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
