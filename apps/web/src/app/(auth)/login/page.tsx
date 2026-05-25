"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = pickSafeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { ok, data } = await apiFetch<{ error?: string; user?: { role: string } }>(
        "/v1/auth/login",
        { method: "POST", body: { email, password } }
      );

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
            <Label htmlFor="password">Lösenord</Label>
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
