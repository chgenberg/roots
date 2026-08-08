import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Star, Trophy, ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

const ICONS = [Award, Star, Trophy];

export async function Gamification() {
  const locale = await getRequestLocale();
  const { gamification } = getHome(locale);

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            {gamification.badge}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            {gamification.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {gamification.body}
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {gamification.achievements.map((a, i) => {
            const Icon = ICONS[i] ?? Award;
            return (
              <Card
                key={a.title}
                className="border-border/60 bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
              >
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
                    <Icon className="h-7 w-7 text-brand-500" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{a.stat}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" pulse asChild>
            <LocaleLink href="/foreningsliv">
              {gamification.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
