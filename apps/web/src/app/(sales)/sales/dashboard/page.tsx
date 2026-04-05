"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ShoppingCart, Users, TrendingUp, ArrowRight, Sparkles } from "lucide-react";

const STATS = [
  { label: "Aktiva offerter", value: "0", icon: FileText },
  { label: "Ordrar denna månad", value: "0", icon: ShoppingCart },
  { label: "Anslutna klubbar", value: "0", icon: Users },
  { label: "Pipeline-värde", value: "0 kr", icon: TrendingUp },
];

export default function SalesDashboardPage() {
  return (
    <div className="page-enter mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sälj-Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Översikt av din försäljning och pipeline. När du kopplar på data visas riktiga siffror här.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Senaste offerter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-border bg-brand-50/30">
                <p className="text-sm text-muted-foreground">Inga offerter ännu.</p>
                <Button variant="secondary" size="sm" className="mt-4" asChild>
                  <Link href="/sales/offerter">
                    Gå till offerter
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Senaste ordrar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-center justify-center rounded-xl border border-border bg-brand-50/30">
                <p className="text-sm text-muted-foreground">Inga ordrar ännu.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-l-2 border-l-brand-300">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              <div>
                <h3 className="text-sm font-semibold">Tips</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Börja med att skapa en offert eller registrera en klubb — då fylls denna vy automatiskt.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
