// P3.78 (audit 2026-05-26): vi använde rena text-fallbacks
// ("Laddar …") för data-pending-state. Det signalerar inte tydligt
// att data är på väg och flyttar inte heller layout-rytmen (CLS).
// En liten Skeleton-primitive låter sidor visa graceful pulserande
// placeholders med samma kontur som det riktiga innehållet.
//
// Pattern är hämtat från shadcn/ui (samma som vi annars följer)
// — exporten är medvetet minimal eftersom större loading-state-
// system planeras i ett senare sprint.

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
