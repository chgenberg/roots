"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, ShoppingBag } from "lucide-react";

import { apiFetch } from "@/lib/api";

export default function SellerRegistrationPage() {
  const router = useRouter();
  const params = useParams();
  const inviteToken = params.token as string;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shopSlug, setShopSlug] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // apiFetch attaches CSRF + cookies so the POST passes the API's
      // CSRF middleware in production.
      const res = await apiFetch<{ shopSlug?: string; error?: string }>(
        "/v1/auth/register/seller",
        {
          method: "POST",
          body: {
            inviteToken,
            email,
            password,
            displayName,
            phone: phone || undefined,
          },
        }
      );

      if (!res.ok) {
        setError(res.data?.error || "Något gick fel. Försök igen.");
        return;
      }

      setShopSlug(res.data?.shopSlug || "");
      setSuccess(true);
      setTimeout(() => router.push("/min-shop"), 2000);
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">Välkommen!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Din personliga shop är redo. Du skickas vidare...
          </p>
          {shopSlug && (
            <p className="text-xs text-muted-foreground">
              Din shop: /shop/{shopSlug}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <ShoppingBag className="h-6 w-6 text-brand-700" />
        </div>
        <CardTitle className="text-2xl">Gå med som säljare</CardTitle>
        <CardDescription>
          Skapa ditt konto och få din personliga shop direkt
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Ditt namn *</Label>
            <Input
              id="displayName"
              placeholder="Förnamn Efternamn"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-post *</Label>
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
            <Label htmlFor="password">Lösenord *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minst 8 tecken"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="070-XXX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !displayName || !email || password.length < 8}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Skapar konto...
              </>
            ) : (
              "Skapa konto och börja sälja"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
