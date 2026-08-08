import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Package, ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

const ICONS = [Users, TrendingUp, Package];

export async function ForForeningar() {
  const locale = await getRequestLocale();
  const { forClubs } = getHome(locale);

  return (
    <section className="relative overflow-hidden bg-brand-50/40 py-24 md:py-32">
      <div
        className="pointer-events-none absolute right-[8%] top-[15%] h-48 w-48 animate-float rounded-full border border-brand-200/30 motion-reduce:animate-none"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            {forClubs.badge}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">{forClubs.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{forClubs.body}</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {forClubs.benefits.map((benefit, i) => {
            const Icon = ICONS[i] ?? Users;
            return (
              <Card
                key={benefit.title}
                className="border-0 bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
              >
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                    <Icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" pulse asChild>
            <LocaleLink href="/foreningsliv">
              {forClubs.cta}
              <ArrowRight className="ml-1 h-4 w-4" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
