import type { ReactNode } from "react";
import Image from "next/image";
import { RootsLogo } from "@/components/brand";
import type { Locale } from "@/i18n/config";
import { getInterest } from "@/i18n/get-dictionary";
import { cn } from "@/lib/utils";

/**
 * Formulär till vänster, foto till höger; på mobil fotot överst. Samma yta
 * på förhandsgrinden (utan sajtens header) och på /intresseanmalan.
 */
export function InterestSplit({
  locale,
  standalone = false,
  children,
}: {
  locale: Locale;
  standalone?: boolean;
  children: ReactNode;
}) {
  const t = getInterest(locale);
  const year = new Date().getFullYear();
  const fullHeight = standalone ? "lg:h-[100dvh]" : "lg:h-[calc(100dvh-4rem)]";

  return (
    <div className={cn("bg-background lg:grid lg:grid-cols-2", standalone && "min-h-[100dvh]")}>
      <div
        className={cn(
          "relative h-52 sm:h-72 lg:order-2 lg:sticky",
          standalone ? "lg:top-0" : "lg:top-16",
          fullHeight
        )}
      >
        <Image
          src="/images/roots-club-table-w.jpg"
          alt={t.imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-[50%_40%]"
        />
      </div>

      <section
        className={cn(
          "flex flex-col px-6 pb-10 pt-8 sm:px-10 lg:px-14 xl:px-20",
          standalone ? "lg:min-h-[100dvh] lg:pt-10" : "lg:min-h-[calc(100dvh-4rem)] lg:pt-14"
        )}
      >
        {standalone && <RootsLogo variant="auto" className="h-9 w-[90px]" priority />}

        <div className={cn("w-full max-w-md lg:my-auto lg:py-10", standalone && "mt-8")}>
          <h1 className="text-pretty text-[1.75rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.125rem]">
            {t.title}
          </h1>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {t.body}
          </p>
          <div className="mt-8">{children}</div>
        </div>

        {standalone && <p className="mt-10 text-xs text-muted-foreground">© {year} Ourroots AB</p>}
      </section>
    </div>
  );
}
