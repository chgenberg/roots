import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Package, ArrowRight } from "lucide-react";

const BENEFITS = [
  {
    icon: Users,
    title: "Enkel beställning",
    description:
      "Logga in, välj antal paket, klart. Inga krångliga avtal eller minsta beställningar.",
  },
  {
    icon: TrendingUp,
    title: "Stöd till föreningen",
    description:
      "En del av intäkterna går tillbaka till föreningslivet. Ni stärker varandra.",
  },
  {
    icon: Package,
    title: "Direktleverans",
    description:
      "Leverans direkt till klubben eller enskilda medlemmar. Vi fixar logistiken.",
  },
];

export function ForForeningar() {
  return (
    <section className="relative overflow-hidden bg-brand-50/40 py-24 md:py-32">
      <div className="pointer-events-none absolute right-[8%] top-[15%] h-48 w-48 rounded-full border border-brand-200/30 animate-float motion-reduce:animate-none" aria-hidden="true" />

      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">För föreningar</Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Byggt för föreningslivet
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Vi vet hur föreningar fungerar. Därför byggde vi en plattform som gör
            det enkelt att beställa och sälja naturlig hårvård.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <Card key={benefit.title} className="border-0 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <benefit.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" pulse asChild>
            <Link href="/foreningsliv">
              Anslut din förening
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
