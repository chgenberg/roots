import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pageMetadata } from "@/lib/seo";

import { ArrowRight, Users, ShieldCheck, Truck, BarChart3 } from "lucide-react";

export const metadata = pageMetadata({
  title: "Föreningsliv",
  description:
    "Stärk er förening med Roots. Sälj naturlig hårvård och generera intäkter till laget — enkelt, snabbt och utan startavgift.",
  path: "/foreningsliv",
});

const STEPS = [
  { step: "01", title: "Anslut", description: "Registrera din förening — tar bara några minuter." },
  { step: "02", title: "Beställ", description: "Välj antal paket direkt i vår portal. Inga minsta volymer." },
  { step: "03", title: "Leverans", description: "Vi levererar direkt till er klubb eller era medlemmar." },
  { step: "04", title: "Intäkt", description: "Del av vinsten går tillbaka till föreningslivet." },
];

const FEATURES = [
  { icon: Users, title: "Ingen minimumbeställning", description: "Beställ det ni behöver, när ni behöver det." },
  { icon: ShieldCheck, title: "Egen portal", description: "Administrera beställningar och se statistik i realtid." },
  { icon: Truck, title: "Fri frakt över 500 kr", description: "Snabb leverans direkt till klubben." },
  { icon: BarChart3, title: "Intäktsrapport", description: "Full transparens över hur vinsten fördelas." },
];

export default function ForeningslivPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-50/40 py-20 md:py-28">
        <div className="pointer-events-none absolute -bottom-20 left-[10%] h-40 w-40 rounded-full border border-brand-200/30 animate-float motion-reduce:animate-none" aria-hidden="true" />
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-lg">
            <Badge variant="secondary" className="mb-4">För föreningar</Badge>
            <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.05] tracking-tight">
              Gör föreningslivet
              <span className="block text-brand-500">starkare</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Roots är byggt för föreningar. Beställ naturlig hudvård direkt i vår
              portal, säkerställ att en del av vinsten går tillbaka till er klubb,
              och ge era medlemmar produkter de älskar.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" pulse asChild>
                <Link href="/registrera">
                  Anslut din förening
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/kontakt">Kontakta oss</Link>
              </Button>
            </div>
          </div>

          <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl shadow-brand-900/10">
            <Image
              src="/images/sport-hockey.jpg"
              alt="Roots produkter i föreningens omklädningsrum"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Så här fungerar det</h2>
            <p className="mt-4 text-muted-foreground">
              Från registrering till leverans — i fyra enkla steg.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="relative">
                <span className="text-5xl font-bold text-brand-200" aria-hidden="true">{s.step}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10">
        <div className="group relative mx-auto max-w-[1280px] overflow-hidden rounded-3xl">
          <div className="relative aspect-[16/10]">
            <Image
              src="/images/sport-hero.jpg"
              alt="Roots produkter i duschen — redo att användas"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="100vw"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Vad ni får</h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                    <f.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-inverse-surface py-16 text-inverse-on-surface md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight">
            Redo att börja?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-inverse-on-surface/80">
            Anslut din förening idag och ge era medlemmar tillgång till naturlig,
            nordisk hudvård.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-white text-neutral-900 shadow-sm hover:bg-neutral-100"
            asChild
          >
            <Link href="/registrera">
              Registrera din förening
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
