"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function KontaktPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      subject: (form.elements.namedItem("subject") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch(`${API_URL}/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Något gick fel.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka meddelandet.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="bg-brand-50/40 py-16 md:py-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Kontakta oss
            </h1>
            <p className="mt-4 text-muted-foreground">
              Har du frågor om våra produkter, ditt föreningssamarbete eller
              något annat? Hör av dig — vi svarar så snart vi kan.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:px-10 lg:grid-cols-5 lg:gap-20">
          <div className="lg:col-span-3">
            {sent ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-100 bg-brand-50/30 px-6 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
                  <Send className="h-6 w-6 text-foreground" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">Tack för ditt meddelande</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Vi har mottagit ditt meddelande och återkommer så snart vi kan,
                  vanligtvis inom 1–2 arbetsdagar.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Namn</Label>
                    <Input id="name" name="name" required placeholder="Ditt namn" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="din@epost.se"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Ämne</Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    placeholder="Vad gäller ditt ärende?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Meddelande</Label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Beskriv ditt ärende..."
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" size="lg" pulse disabled={sending}>
                  {sending ? "Skickar..." : "Skicka meddelande"}
                  {!sending && <Send className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <Mail className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">E-post</h3>
                    <a
                      href="mailto:hej@roots.se"
                      className="mt-1 block text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      hej@roots.se
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <MapPin className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Adress</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Roots Nordic AB
                      <br />
                      Stockholm, Sverige
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-6">
              <h3 className="font-semibold">Svarstid</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vi besvarar alla meddelanden inom 1–2 arbetsdagar. För akuta
                ärenden, skriv &quot;Brådskande&quot; i ämnesraden.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
