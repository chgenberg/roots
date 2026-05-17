import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Star, Trophy, ArrowRight } from "lucide-react";

const ACHIEVEMENTS = [
  {
    icon: Award,
    title: "Första beställningen",
    stat: "Bli en av de första föreningarna med Roots",
  },
  {
    icon: Star,
    title: "10 beställningar",
    stat: "Bygg en vana som föder kassan",
  },
  {
    icon: Trophy,
    title: "1 års medlem",
    stat: "Skapa en återkommande intäktskälla",
  },
] as const;

export function Gamification() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            Milstolpar
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Föreningar som växer med Roots
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Anslut din förening och börja samla milstolpar
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {ACHIEVEMENTS.map((a) => (
            <Card
              key={a.title}
              className="border-border/60 bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]"
            >
              <CardContent className="flex flex-col items-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
                  <a.icon className="h-7 w-7 text-brand-500" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.stat}</p>
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
