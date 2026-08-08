"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { auth } from "@/i18n/dictionaries/auth";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const MIN_LENGTH = 12;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function Skeleton() {
  const { locale } = useLocale();
  const t = auth.reset[locale];
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="h-40 animate-pulse rounded-md bg-muted"
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const { locale, href } = useLocale();
  const t = auth.reset[locale];
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(tFill(t.errorTooShort, { minLength: MIN_LENGTH }));
      return;
    }
    if (password !== repeat) {
      setError(t.errorMismatch);
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/auth/reset-password",
        { method: "POST", body: { token, newPassword: password } }
      );
      if (!ok) {
        setError(data.error || t.errorGeneric);
        return;
      }
      setDone(true);
      setTimeout(() => router.push(href("/login")), 2500);
    } catch {
      setError(t.errorServer);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t.missingTitle}</CardTitle>
          <CardDescription>{t.missingDescription}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-2 text-sm">
          <LocaleLink
            href="/glomt-losenord"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.requestNewLink}
          </LocaleLink>
        </CardFooter>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CheckCircle2
            className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">{t.doneTitle}</CardTitle>
          <CardDescription>{t.doneDescription}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-2 text-sm">
          <LocaleLink
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.loginNow}
          </LocaleLink>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t.title}</CardTitle>
        <CardDescription>
          {tFill(t.description, { minLength: MIN_LENGTH })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t.newPasswordLabel}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repeat">{t.repeatPasswordLabel}</Label>
            <Input
              id="repeat"
              type="password"
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
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
