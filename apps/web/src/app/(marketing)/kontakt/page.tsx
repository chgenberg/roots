"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LEGAL_IDENTITY } from "@/lib/legal-identity";
import { useLocale } from "@/i18n/locale-context";
import { pages } from "@/i18n/dictionaries/pages";

export default function KontaktPage() {
  const { locale } = useLocale();
  const t = pages.kontakt[locale];
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
      locale,
    };

    try {
      const { ok, data: resData } = await apiFetch<{ error?: string }>(
        "/v1/contact",
        { method: "POST", body: data }
      );
      if (!ok) {
        throw new Error(resData?.error || t.errorGeneric);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorSendFailed);
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
              {t.heroTitle}
            </h1>
            <p className="mt-4 text-muted-foreground">{t.heroBody}</p>
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
                <h2 className="mt-6 text-xl font-semibold">{t.successTitle}</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {t.successBody}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t.form.name}</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      placeholder={t.form.namePlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.form.email}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder={t.form.emailPlaceholder}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">{t.form.subject}</Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    placeholder={t.form.subjectPlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t.form.message}</Label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder={t.form.messagePlaceholder}
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" pulse disabled={sending}>
                  {sending ? t.form.submitting : t.form.submit}
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
                    <h3 className="font-semibold">{t.emailLabel}</h3>
                    <a
                      href={`mailto:${t.email}`}
                      className="mt-1 block text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t.email}
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
                    <h3 className="font-semibold">{t.addressLabel}</h3>
                    <address className="mt-1 text-sm not-italic text-muted-foreground">
                      {LEGAL_IDENTITY.legalName}
                      <br />
                      {LEGAL_IDENTITY.address.street}
                      <br />
                      {LEGAL_IDENTITY.address.postalCode}{" "}
                      {LEGAL_IDENTITY.address.city},{" "}
                      {LEGAL_IDENTITY.address.country}
                    </address>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.orgNumberLabel} {LEGAL_IDENTITY.orgNumber}
                      <br />
                      {t.vatLabel} {LEGAL_IDENTITY.vatId}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-6">
              <h3 className="font-semibold">{t.responseTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.responseBody}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
