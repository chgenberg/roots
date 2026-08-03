"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function ForgotPasswordPage() {
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
        setError(data.error || "Något gick fel. Försök igen.");
        return;
      }
      setSent(true);
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
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
          <CardTitle className="text-2xl">Kolla din e-post</CardTitle>
          <CardDescription>
            Finns det ett konto på {email} har vi skickat en länk dit. Den
            fungerar i en timme.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            Hittar du inget mail: titta i skräpposten, eller kontakta oss på{" "}
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

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Glömt lösenordet?</CardTitle>
        <CardDescription>
          Skriv in din e-postadress så skickar vi en återställningslänk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              placeholder="din@epost.se"
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
                Skickar...
              </>
            ) : (
              "Skicka länk"
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
