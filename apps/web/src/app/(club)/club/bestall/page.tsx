"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, ShoppingCart, CheckCircle } from "lucide-react";

const BUNDLE = {
  id: "bundle-001",
  name: "Roots Complete Kit",
  description: "Schampo + Balsam + Body Wash",
  priceOre: 39900,
  products: [
    { name: "Roots Shampoo", priceOre: 14900 },
    { name: "Roots Conditioner", priceOre: 14900 },
    { name: "Roots Body Wash", priceOre: 12900 },
  ],
};

function formatPrice(ore: number) {
  return `${(ore / 100).toFixed(0)} kr`;
}

export default function BestallPage() {
  const [qty, setQty] = useState(10);
  const [submitted, setSubmitted] = useState(false);
  const total = qty * BUNDLE.priceOre;

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: POST to /v1/orders/club { bundleId: BUNDLE.id, qty }
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Beställning mottagen</h1>
            <p className="mt-2 text-muted-foreground">
              {qty} st {BUNDLE.name} — totalt {formatPrice(total)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Du får en bekräftelse via e-post.
            </p>
            <Button className="mt-6" onClick={() => setSubmitted(false)}>
              Gör en ny beställning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Beställ</h1>
      <p className="mt-1 text-muted-foreground">
        Välj antal paket för din förening.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{BUNDLE.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{BUNDLE.description}</p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {BUNDLE.products.map((p) => (
              <li key={p.name} className="flex justify-between text-sm text-muted-foreground">
                <span>{p.name}</span>
                <span>{formatPrice(p.priceOre)}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Pris per paket</span>
            <span className="text-lg font-bold">{formatPrice(BUNDLE.priceOre)}</span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="mt-6">
        <Card>
          <CardContent className="p-6">
            <Label>Antal paket</Label>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Totalt</span>
              <span className="text-2xl font-bold">{formatPrice(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" pulse size="lg" className="mt-6 w-full" disabled={submitting}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          {submitting ? "Skickar..." : "Lägg beställning"}
        </Button>
      </form>
    </div>
  );
}
