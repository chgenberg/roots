"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, TrendingUp, ArrowRight, Sparkles } from "lucide-react";

const STATS = [
  { label: "Totalt beställt", value: "0 paket", icon: Package },
  { label: "Aktiva ordrar", value: "0", icon: ShoppingCart },
  { label: "Senaste order", value: "—", icon: TrendingUp },
];

export default function ClubDashboardPage() {
  return (
    <div className="page-enter mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Välkommen tillbaka</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Här ser du en översikt av din förenings beställningar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Senaste ordrar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-border bg-brand-50/30 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Inga ordrar ännu. Börja med att beställa ert första paket.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/club/bestall">
                  Beställ nu
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit border-l-2 border-l-brand-300">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              <div>
                <h3 className="text-sm font-semibold">Roots för föreningar</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Alla beställningar samlas här så ni enkelt ser status och historik.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
