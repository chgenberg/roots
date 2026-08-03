"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
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

const MIN_LENGTH = 12;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function Skeleton() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Välj nytt lösenord</CardTitle>
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
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Lösenordet måste vara minst ${MIN_LENGTH} tecken.`);
      return;
    }
    if (password !== repeat) {
      setError("Lösenorden matchar inte.");
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        "/v1/auth/reset-password",
        { method: "POST", body: { token, newPassword: password } }
      );
      if (!ok) {
        setError(data.error || "Något gick fel. Försök igen.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Länken saknas</CardTitle>
          <CardDescription>
            Öppna länken från e-postmeddelandet, eller begär en ny.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-2 text-sm">
          <Link
            href="/glomt-losenord"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Begär ny länk
          </Link>
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
          <CardTitle className="text-2xl">Lösenordet är bytt</CardTitle>
          <CardDescription>
            Du loggades ut från alla enheter. Vi skickar dig till
            inloggningen.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-2 text-sm">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Logga in nu
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Välj nytt lösenord</CardTitle>
        <CardDescription>Minst {MIN_LENGTH} tecken.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nytt lösenord</Label>
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
            <Label htmlFor="repeat">Repetera lösenordet</Label>
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
                Sparar...
              </>
            ) : (
              "Spara lösenord"
            )}
          </Button>
        </form>
      </CardContent>
      <Separator />
      <CardFooter className="justify-center pt-6 text-sm">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Tillbaka till inloggningen
        </Link>
      </CardFooter>
    </Card>
  );
}
