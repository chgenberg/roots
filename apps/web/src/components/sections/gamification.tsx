import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { SectionEyebrow } from "@/components/section-eyebrow";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function Gamification() {
  const locale = await getRequestLocale();
  const { gamification } = getHome(locale);

  return (
    <section className="py-24 md:py-32">
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

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {gamification.achievements.map((a) => (
            <Card
              key={a.title}
              className="border-border/60 bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
            >
              <CardContent className="p-8">
                <h3 className="text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.stat}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" pulse asChild>
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
