"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CalculatorInputs, CalculatorResult } from "@roots/contracts";
import { RevenueCalculator } from "@/components/calculator/revenue-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Sparkles, Play } from "lucide-react";

interface DemoStep {
  id: string;
  tab: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  video: string;
  poster: string;
}

// Filmerna är de inspelade demo-klippen (telefon-i-hand, 9:16) som
// ligger i /public/demo. Varje klipp visar hur enkelt ett steg är.
const STEPS: DemoStep[] = [
  {
    id: "forening",
    tab: "Föreningen",
    eyebrow: "Steg 1",
    title: "Föreningen kommer igång",
    description:
      "Föreningsansvarig loggar in, sätter ett mål och öppnar en säljperiod. Allt syns live i dashboarden — ni ser exakt hur långt ni har kvar.",
    bullets: [
      "Sätt mål per lag och per säljare",
      "Skapa säljperioder med start- och slutdatum",
      "Följ försäljningen i realtid mot målet",
    ],
    video: "/demo/forening.mp4",
    poster: "/demo/forening-poster.jpg",
  },
  {
    id: "lag",
    tab: "Lagledaren",
    eyebrow: "Steg 2",
    title: "Lagledaren bjuder in laget",
    description:
      "Tränaren eller föräldragruppen skickar en registreringslänk till spelarna och peppar laget via topplistan — utan att hålla i någon pärm.",
    bullets: [
      "Bjud in hela laget med en länk",
      "Topplista som driver lite vänskaplig tävling",
      "Chatt och uppföljning på ett ställe",
    ],
    video: "/demo/lag.mp4",
    poster: "/demo/lag-poster.jpg",
  },
  {
    id: "seller",
    tab: "Medlemmen",
    eyebrow: "Steg 3",
    title: "Medlemmen säljer",
    description:
      "Spelaren får sin egen personliga shop-länk. Hen delar den med släkt och vänner — som handlar med Swish eller kort på några sekunder.",
    bullets: [
      "Egen personlig webshop-sida",
      "Dela via SMS, sociala medier eller QR-kod",
      "Swish och kort direkt i mobilen",
    ],
    video: "/demo/seller.mp4",
    poster: "/demo/seller-poster.jpg",
  },
];

// Telefon-inramad film (9:16) med mjuk glöd — matchar demo-sektionen.
function PhoneFilm({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[300px]", className)}>
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-brand-100/50 blur-2xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-[2rem] border border-border/60 shadow-[var(--shadow-card)]">
        <video
          className="aspect-[9/16] w-full bg-brand-50 object-cover"
          poster={poster}
          src={src}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
      </div>
    </div>
  );
}

function DemoFilms() {
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const step = STEPS[active];

  // Starta om klippet när man byter flik så det alltid spelar från början.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {
      /* autoplay kan blockeras — posters visas då */
    });
  }, [active]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Telefon-film */}
      <div className="order-2 lg:order-1">
        <div className="relative mx-auto w-full max-w-[320px]">
          <div
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-brand-100/50 blur-2xl"
            aria-hidden="true"
          />
          <div className="overflow-hidden rounded-[2rem] border border-border/60 shadow-[var(--shadow-card)]">
            <video
              ref={videoRef}
              key={step.id}
              className="aspect-[9/16] w-full bg-brand-50 object-cover"
              poster={step.poster}
              src={step.video}
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
            />
          </div>
        </div>
      </div>

      {/* Beskrivning + flikar */}
      <div className="order-1 lg:order-2">
        <div
          role="tablist"
          aria-label="Välj roll"
          className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-background/60 p-1"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.tab}
            </button>
          ))}
        </div>

        <div className="mt-8 page-enter" key={step.id}>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
            <Play className="h-3.5 w-3.5 fill-current" />
            {step.eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {step.title}
          </h3>
          <p className="mt-3 max-w-md text-muted-foreground">
            {step.description}
          </p>
          <ul className="mt-6 space-y-3">
            {step.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CalculatorBlock() {
  const [inputs, setInputs] = useState<CalculatorInputs | null>(null);
  const [products, setProducts] = useState<
    { name: string; priceOre: number }[]
  >([]);
  const [presets, setPresets] = useState<Partial<CalculatorInputs> | undefined>(
    undefined
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await apiFetch<{
        presets: CalculatorInputs;
        products: { name: string; priceOre: number }[];
      }>("/v1/calculator/public");
      if (cancelled || !ok) return;
      setProducts(data.products ?? []);
      setPresets(data.presets);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCalcChange = useCallback(
    (next: CalculatorInputs, _result: CalculatorResult) => {
      setInputs(next);
    },
    []
  );

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!inputs) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ange en giltig e-postadress.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/calculator/public/lead",
        {
          method: "POST",
          body: {
            email: email.trim(),
            contactName: name.trim() || undefined,
            message: message.trim() || undefined,
            newsletterConsent: consent,
            inputs,
          },
        }
      );
      if (ok) {
        setSent(true);
      } else {
        setError(data?.error || "Något gick fel. Försök igen.");
      }
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <RevenueCalculator
        defaultInputs={presets}
        products={products}
        onChange={onCalcChange}
      />

      <Card className="mt-10 border-brand-200">
        <CardContent className="p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-brand-600" />
              <h3 className="text-xl font-bold">Tack!</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Vi hör av oss med en sammanfattning och hjälper er igång. Under
                tiden kan du fortsätta räkna ovan.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold">
                Vill ni se vad det skulle ge er förening?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Lämna er mejl så skickar vi en sammanfattning och hjälper er
                igång. Inga förpliktelser.
              </p>
              <form
                onSubmit={submitLead}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">E-post *</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="namn@forening.se"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">Namn (valfritt)</Label>
                  <Input
                    id="lead-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ditt namn"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lead-msg">Meddelande (valfritt)</Label>
                  <Input
                    id="lead-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Berätta gärna lite om er förening"
                    maxLength={2000}
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#6B794F]"
                  />
                  <span>
                    Ja, ni får mejla mig om Roots för föreningar. Vi hanterar
                    uppgifterna enligt vår{" "}
                    <Link
                      href="/integritet"
                      className="underline underline-offset-2"
                    >
                      integritetspolicy
                    </Link>
                    .
                  </span>
                </label>
                {error && (
                  <p className="text-sm text-destructive sm:col-span-2">
                    {error}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={sending} size="lg">
                    {sending ? "Skickar…" : "Skicka till mig"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function SaFungerarDetClient() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-50/40 py-20 md:py-28">
        <div
          className="pointer-events-none absolute -top-16 right-[8%] h-48 w-48 rounded-full border border-brand-200/30 animate-float motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[760px] px-6 text-center md:px-10">
          <Badge variant="secondary" className="mb-4">
            För föreningar
          </Badge>
          <h1 className="text-[length:var(--font-size-hero)] font-bold leading-[1.05] tracking-tight">
            Så fungerar det
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Tre enkla steg — från att föreningen kommer igång till att medlemmen
            säljer i mobilen. Se hur det går till och räkna ut vad det kan ge er
            förening.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <a href="#rakna">
                Räkna på er förtjänst
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/kontakt?intent=demo">Boka en demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Filmerna — tre steg */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <Sparkles className="h-4 w-4" />
              Se det i praktiken
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Enkelt för alla — i varje steg
            </h2>
            <p className="mt-3 text-muted-foreground">
              Byt mellan rollerna och se hur lätt det är. Inga pärmar, inga
              kontanter — allt sker i mobilen.
            </p>
          </div>
          <DemoFilms />
        </div>
      </section>

      {/* Kalkylator */}
      <section id="rakna" className="scroll-mt-24 bg-brand-50/40 py-20 md:py-28">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          {/* Titta & prova: film till vänster, intro + reglage nedanför */}
          <div className="mb-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <PhoneFilm src="/demo/kalkylator.mp4" poster="/demo/kalkylator-poster.jpg" />
            </div>
            <div className="order-1 lg:order-2">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                <Sparkles className="h-4 w-4" />
                Räkna på er förtjänst
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Vad kan er förening tjäna?
              </h2>
              <p className="mt-3 max-w-md text-muted-foreground">
                Se hur enkelt det är att räkna — och prova själv direkt nedan.
                Dra i reglagen så uppdateras förtjänsten i realtid.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Justera antal säljare och snittförsäljning",
                  "Se förtjänsten och hur långt ni når mot målet",
                  "Dela resultatet — vi hjälper er igång",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                Prova själv nedan
                <ArrowRight className="h-4 w-4" />
              </p>
            </div>
          </div>
          <CalculatorBlock />
        </div>
      </section>
    </>
  );
}
