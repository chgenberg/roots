import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function Gamification() {
  const locale = await getRequestLocale();
  const { gamification } = getHome(locale);

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="mb-4">{gamification.badge}</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-tight">
            {gamification.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {gamification.body}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-10 text-center md:grid-cols-3 md:gap-12">
          {gamification.achievements.map((a) => (
            <div key={a.title}>
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                {a.stat}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button className="bg-[#6D614D] text-white hover:bg-[#5c5241]" asChild>
            <LocaleLink href="/registrera" localeNeutral>
              {gamification.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
