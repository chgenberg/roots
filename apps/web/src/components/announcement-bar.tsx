"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";

function MessageRun({
  messages,
  hidden,
}: {
  messages: string[];
  hidden?: boolean;
}) {
  return (
    <ul
      className="flex shrink-0 items-center"
      aria-hidden={hidden || undefined}
    >
      {messages.map((message) => (
        <li key={message} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap px-6 text-[11px] uppercase tracking-[0.14em] text-brand-900/70 dark:text-foreground/70">
            {message}
          </span>
          <span
            aria-hidden
            className="text-[7px] text-brand-900/30 dark:text-foreground/30"
          >
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementBar({ className }: { className?: string }) {
  const { t } = useLocale();

  return (
    <div
      className={cn(
        "overflow-hidden bg-brand-100/80 backdrop-blur-xl dark:bg-background/80",
        "motion-reduce:overflow-x-auto",
        className
      )}
      role="region"
      aria-label={t.aria.announcement}
    >
      <div className="flex h-9 items-center motion-safe:animate-[marquee_40s_linear_infinite] motion-reduce:animate-none">
        <MessageRun messages={t.announcement} />
        <MessageRun messages={t.announcement} hidden />
      </div>
    </div>
  );
}
