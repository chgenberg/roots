"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, MailCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { auth } from "@/i18n/dictionaries/auth";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const t = auth.forgot[locale];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/auth/forgot-password",
        { method: "POST", body: { email } }
      );
      if (!ok) {
        setError(data.error || t.errorGeneric);
        return;
      }
      setSent(true);
    } catch {
      setError(t.errorServer);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <MailCheck
            className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">{t.sentTitle}</CardTitle>
          <CardDescription>
            {tFill(t.sentDescription, { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            {t.noMailHint}{" "}
            <a
              href="mailto:hej@roots.se"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              hej@roots.se
            </a>
            .
          </p>
        </CardContent>
        <Separator />
        <CardFooter className="justify-center pt-6 text-sm">
          <LocaleLink
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.backToLogin}
          </LocaleLink>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.submitting}
              </>
            ) : (
              t.submit
            )}
          </Button>
        </form>
      </CardContent>
      <Separator />
      <CardFooter className="justify-center pt-6 text-sm">
        <LocaleLink
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.backToLogin}
        </LocaleLink>
      </CardFooter>
    </Card>
  );
}
