import type { Metadata } from "next";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Heart, Leaf, Shield } from "lucide-react";

export const metadata: Metadata = { title: "Om oss" };

const VALUES = [
  {
    icon: Heart,
    title: "Föreningsdriven",
    description:
      "Allt vi gör har ett mål: att föreningslivet i Sverige ska blomstra. Vårt företag är byggt från grunden med det perspektivet.",
  },
  {
    icon: Leaf,
    title: "Naturligt, inte perfekt",
    description:
      "Vi tror inte på 100% ekologiska certifieringar för certifieringens skull. Vi tror på ingredienser som fungerar och är så naturliga som möjligt.",
  },
  {
    icon: Shield,
    title: "Transparens",
    description:
      "Från ingredienslista till prissättning — vi är öppna med allt. Det är så man bygger förtroende.",
  },
];

export default function OmOssPage() {
  return (
    <>
      <section className="bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Om oss</Badge>
            <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Tre män. Ett mål.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Roots grundades av tre grannar — alla över 1,95 m, med helt
              olika bakgrunder. En ingenjör, en idrottstränare, en företagare.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
          <div className="relative">
            <div className="group relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl shadow-brand-900/5">
              <Image
                src="/images/m4.jpg"
                alt="Nordisk känsla — ren och naturlig"
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
            </div>
          </div>

          <div className="max-w-lg">
            <h2 className="text-3xl font-bold tracking-tight">Vår historia</h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Det började med en enkel insikt: föreningslivet i Sverige ger så
                mycket till samhället, men får alldeles för lite tillbaka. Vi
                ville ändra på det.
              </p>
              <p>
                Med bakgrunder inom teknik, idrott och företagande satte vi oss
                ner och funderade: vad kan alla föreningar ha gemensamt? Svaret
                var enkelt. Alla duschar. Alla behöver hudvård.
              </p>
              <p>
                Så vi skapade Roots. Tre naturliga produkter, utvecklade i
                Norden, med en affärsmodell som kanaliserar intäkter tillbaka
                till föreningslivet. Enkelt. Naturligt. Gemensamt.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-[1200px]" />

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Våra värderingar</h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <Card key={v.title} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                    <v.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
