"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  onClose,
  children,
  wide,
  side,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  side?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "flex max-h-full flex-col bg-background shadow-2xl outline-none",
          side
            ? "ml-auto h-full w-full max-w-[760px]"
            : cn("m-auto max-h-[90vh] w-[calc(100%-2rem)] rounded-2xl", wide ? "max-w-4xl" : "max-w-lg")
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-inverse-surface px-4 text-[13px] font-semibold text-inverse-on-surface transition-colors hover:bg-inverse-surface-hover disabled:cursor-not-allowed disabled:opacity-40",
  ghost:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-background px-4 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
  danger:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40",
};

export const field =
  "w-full rounded-xl bg-background px-3 py-2 text-sm text-foreground ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
