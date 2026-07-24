import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-brand-100 text-brand-700",
        warning: "border-transparent bg-brand-50 text-brand-600",
        destructive: "border-transparent bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Renderar ett `<span>`, inte en `<div>`. En badge är inline-innehåll och
 * hamnar ofta inuti en `<p>` — och `<div>` i `<p>` är ogiltig HTML, vilket gav
 * hydreringsfel i konsolen på statistik- och inställningssidorna. Basklassen
 * är `inline-flex`, så bytet är visuellt identiskt.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
