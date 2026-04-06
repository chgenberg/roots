"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HairAnalysisLeadDialog } from "@/components/hair-analysis-lead-dialog";
import {
  Camera,
  Brain,
  Sparkles,
  CheckCircle2,
  Leaf,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

export default function HaranalysPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-50/40 py-24 md:py-32">
        <div className="pointer-events-none absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-brand-100/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-[5%] bottom-[10%] h-48 w-48 rounded-full bg-brand-200/30 blur-2xl" aria-hidden="true" />

        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">AI-driven håranalys</Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Gratis håranalys online
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Ladda upp två bilder, svara på några frågor och få en personlig
              håranalys — helt gratis. Powered by AI och nordiska ingredienser.
            </p>
            <div className="mt-10">
              <HairAnalysisLeadDialog
                trigger={
                  <Button size="lg" pulse className="text-base">
                    Starta din håranalys
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>

          {/* 3-step overview */}
          <div className="mx-auto mt-20 grid max-w-3xl gap-6 md:grid-cols-3">
            {[
              { icon: Camera, title: "Ladda upp bilder", desc: "Två foton — bakifrån och uppifrån" },
              { icon: Brain, title: "Svara på frågor", desc: "Korta frågor om dina vanor" },
              { icon: Sparkles, title: "Få rekommendation", desc: "Personlig analys på under 2 min" },
            ].map((s) => (
              <div key={s.title} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-card-foreground shadow-sm">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Varför Roots håranalys?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              En komplett analys baserad på ditt hår, dina vanor och nordisk expertis.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: CheckCircle2,
                title: "Personlig analys",
                desc: "AI analyserar dina bilder och svar för att ge rekommendationer anpassade just till dig.",
              },
              {
                icon: Leaf,
                title: "Nordiska ingredienser",
                desc: "Våra rekommendationer bygger på produkter med naturliga, nordiska råvaror utan sulfater.",
              },
              {
                icon: Sparkles,
                title: "Kostnad: Helt gratis",
                desc: "Ingen betalning, inget abonnemang. Gör analysen hur många gånger du vill.",
              },
            ].map((b) => (
              <Card key={b.title} className="border-0 bg-brand-50/40 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-card-foreground">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {b.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Så här fungerar det */}
      <section className="bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Steg för steg</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Så här fungerar det</h2>
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-10">
            {[
              {
                num: "1",
                title: "Ladda upp två bilder",
                desc: "Ta ett foto av ditt hår bakifrån och ett uppifrån. Torrt hår utan styling ger bäst resultat. Använd jämnt ljus och undvik blixt.",
              },
              {
                num: "2",
                title: "Besvara korta frågor",
                desc: "Berätta hur ofta du tvättar håret, om du använder värmeverktyg, kemiska behandlingar och din stressnivå. Tar ungefär 1 minut.",
              },
              {
                num: "3",
                title: "Få din personliga analys",
                desc: "Vår AI analyserar bilderna och dina svar, och ger dig en detaljerad bedömning med livsstils-, kost- och produktrekommendationer anpassade till ditt hår.",
              },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">
                  {step.num}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <HairAnalysisLeadDialog
              trigger={
                <Button size="lg" pulse>
                  Starta din håranalys nu
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* Social proof counter */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-5xl font-bold tracking-tight md:text-6xl">500+</p>
            <p className="text-lg text-muted-foreground">analyser gjorda</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-brand-50/40 py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Vanliga frågor</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Allt du behöver veta om håranalysen.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl space-y-3">
            {FAQ_ITEMS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card text-card-foreground transition-shadow hover:shadow-sm"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-medium">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Redo att förstå ditt hår bättre?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Det tar under 2 minuter och kostar ingenting.
            </p>
            <div className="mt-8">
              <HairAnalysisLeadDialog
                trigger={
                  <Button size="lg" pulse className="text-base">
                    Starta gratis håranalys
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.a,
              },
            })),
          }),
        }}
      />
    </>
  );
}

const FAQ_ITEMS = [
  {
    q: "Är håranalysen verkligen gratis?",
    a: "Ja, helt gratis. Du behöver bara ange din e-postadress och ladda upp två bilder. Det finns inga dolda kostnader.",
  },
  {
    q: "Hur lång tid tar det?",
    a: "Hela processen tar under 2 minuter — bilduppladdning, frågor och analys inkluderat.",
  },
  {
    q: "Vad händer med mina bilder?",
    a: "Dina bilder analyseras av AI och raderas automatiskt efter att analysen är klar. Vi sparar inte dina bilder. Läs mer i vår integritetspolicy.",
  },
  {
    q: "Ersätter analysen ett besök hos frisör eller hudläkare?",
    a: "Nej, analysen är indikativ och ger vägledande rekommendationer. Vid ihållande besvär bör du alltid kontakta en professionell.",
  },
  {
    q: "Vilka produkter rekommenderas?",
    a: "Baserat på din analys föreslår vi produkter ur Roots sortiment — naturlig hårvård utan sulfater, silikoner eller parabener, med nordiska ingredienser.",
  },
];
