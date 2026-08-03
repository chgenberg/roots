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
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

/**
 * MASTERPLAN_01 KC2.3: middleware sätter `?next=/where-they-tried-to-go`
 * när en oinloggad user landar på en skyddad route. Login måste honorera
 * den — annars åker man alltid till role-home och tappar context. Vi
 * tillåter bara safe relative paths (start med "/", ingen protokoll-prefix)
 * för att undvika open-redirect.
 */
function pickSafeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // disallow protocol smuggling like "/\\evil.com" or "/javascript:..."
  if (/^\/[\\]/.test(raw)) return null;
  if (/^\/+javascript:/i.test(raw)) return null;
  // P3.61 (audit 2026-05-26): tidigare nappade vi inte percent-encoded
  // slashes — /%2F%2Fevil.com kunde slinka igenom så att Next router
  // decode:ade det och redirectade till en extern host. Decode först
  // och re-checka allt vi precis avvisat ovan.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded !== raw) {
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    if (/^\/[\\]/.test(decoded)) return null;
    if (/^\/+javascript:/i.test(decoded)) return null;
  }
  return raw;
}

function roleHome(role: string | undefined): string {
  switch (role) {
    case "ASSOCIATION_ADMIN":
      return "/forening";
    case "TEAM_LEADER":
      return "/lag";
    case "SELLER":
      return "/min-shop";
    default:
      return "/portal";
  }
}

// P2.28 (audit 2026-05-26): Next 15 kräver att useSearchParams ligger
// bakom <Suspense> så builden inte fallerar. Wrappa innehållet i en
// inre komponent och låt page-default rendera Suspense + skeleton.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageSkeleton() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Logga in</CardTitle>
        <CardDescription>För föreningar, lag och säljare</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-40 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = pickSafeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Andra faktorn. Utmaningen är en kortlivad signerad token från servern
  // och ger ingen behörighet i sig — den bär bara vilket konto som väntar.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodesLeft, setBackupCodesLeft] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { ok, data } = await apiFetch<{
        error?: string;
        user?: { role: string };
        mfaRequired?: boolean;
        challenge?: string;
        backupCodesRemaining?: number;
      }>("/v1/auth/login", { method: "POST", body: { email, password } });

      // Lösenordet stämde men kontot har tvåfaktor. Ingen session har
      // skapats ännu, så vi visar kodsteget istället för att navigera.
      if (data.mfaRequired && data.challenge) {
        setChallenge(data.challenge);
        setBackupCodesLeft(data.backupCodesRemaining ?? 0);
        return;
      }

      if (!ok) {
        setError(data.error || "Något gick fel. Försök igen.");
        return;
      }

      // Honour `?next=` only when provided. Fallback to role-home so
      // a normal login (utan deep-link) lands rätt.
      router.push(safeNext ?? roleHome(data.user?.role));
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { ok, data } = await apiFetch<{
        error?: string;
        user?: { role: string };
      }>("/v1/auth/login/mfa", {
        method: "POST",
        body: { challenge, code },
      });

      if (!ok) {
        setError(data.error || "Koden stämmer inte. Försök igen.");
        setCode("");
        return;
      }
      router.push(safeNext ?? roleHome(data.user?.role));
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  if (challenge) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tvåfaktor</CardTitle>
          <CardDescription>
            Ange den sexsiffriga koden från din autentiseringsapp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Kod</Label>
              <Input
                id="mfa-code"
                // Sifferblock på mobil, och koden hör inte i en
                // lösenordshanterare.
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Har du inte appen tillgänglig? Använd en av dina reservkoder.
                {backupCodesLeft > 0 && ` Du har ${backupCodesLeft} kvar.`}
              </p>
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
                  Kontrollerar…
                </>
              ) : (
                "Fortsätt"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setChallenge(null);
                setCode("");
                setError("");
                setPassword("");
              }}
            >
              Avbryt
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Logga in</CardTitle>
        <CardDescription>För föreningar, lag och säljare</CardDescription>
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
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Lösenord</Label>
              <Link
                href="/glomt-losenord"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Glömt lösenordet?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Ditt lösenord"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loggar in...
              </>
            ) : (
              "Logga in"
            )}
          </Button>
        </form>
      </CardContent>
      <Separator />
      <CardFooter className="flex flex-col gap-2 pt-6 text-center text-sm">
        <p className="text-muted-foreground">
          Ny förening?{" "}
          <Link
            href="/registrera"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Registrera er
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
