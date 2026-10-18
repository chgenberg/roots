import {
  BellOff,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Megaphone,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { howItWorks, type SkipIcon } from "@/i18n/dictionaries/how-it-works";
import { getRequestLocale } from "@/i18n/request-locale";
import { cn } from "@/lib/utils";

const SKIP_ICONS: Record<SkipIcon, LucideIcon> = {
  orders: ClipboardList,
  payments: CreditCard,
  reminders: BellOff,
  sorting: PackageCheck,
  home: Truck,
  results: ChartColumn,
  material: Megaphone,
};

/** "Vad ni slipper": sju lättnader med Roots och en sammanfattning. */
export async function SkipGrid({ className }: { className?: string }) {
  const locale = await getRequestLocale();
  const t = howItWorks[locale];

  return (
    <section aria-labelledby="slipper-titel" className={cn("pb-20 md:pb-28", className)}>
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] px-6 py-12 sm:px-10 md:py-16">
          <h2 id="slipper-titel" className="text-center text-3xl tracking-tight">
            {t.skipTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-lg text-muted-foreground">
            {t.skipIntro}
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.skip.map((item) => {
              const Icon = SKIP_ICONS[item.icon];
              return (
                <li
                  key={item.title}
                  className="flex flex-col rounded-2xl bg-white/85 p-6 shadow-sm shadow-brand-900/5 ring-1 ring-brand-700/10"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
            <li className="flex flex-col justify-end rounded-2xl bg-brand-700 p-6 text-white">
              <h3 className="text-lg font-semibold leading-snug">{t.skipSummaryTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{t.skipSummaryBody}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
