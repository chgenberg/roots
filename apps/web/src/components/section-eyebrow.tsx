import { cn } from "@/lib/utils";

/** Small uppercase section label — the HISTORIEN pattern from Om oss. */
export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium uppercase tracking-[0.18em] text-brand-700",
        className
      )}
    >
      {children}
    </p>
  );
}
