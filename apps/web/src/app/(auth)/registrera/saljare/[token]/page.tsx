"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { Loader2, CheckCircle2, ShoppingBag, ExternalLink, LayoutDashboard } from "lucide-react";

import { apiFetch } from "@/lib/api";

export default function SellerRegistrationPage() {
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
      // MASTERPLAN_01 KC3.8: tidigare auto-redirectade vi efter 2s till
      // /min-shop utan att visa shop-länk. Användaren tappar control —
      // särskilt på mobil där en hastig redirect känns som en bugg.
      // Nu visar vi success-skärmen med två tydliga CTA:s och låter
      // sellern välja själv.
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">Välkommen, {displayName.split(" ")[0]}!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Din personliga shop är redo att börja sälja.
          </p>

          {shopSlug && (
            <div className="w-full rounded-lg bg-brand-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Din shop-länk</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                /shop/{shopSlug}
              </p>
            </div>
          )}

          <div className="mt-2 flex w-full flex-col gap-2">
            {shopSlug && (
              <Link href={`/shop/${shopSlug}`} target="_blank" className="w-full">
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visa min shop
                </Button>
              </Link>
            )}
            <Link href="/min-shop" className="w-full">
              <Button variant="outline" className="w-full">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Gå till min dashboard
              </Button>
            </Link>
          </div>
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
            {/* MASTERPLAN_01 KC6.7: autoComplete="name" så att browsern
                föreslår användarens namn — kritiskt på mobil där en
                sellare ofta är 15+ och får invite via SMS-länken. */}
            <Input
              id="displayName"
              placeholder="Förnamn Efternamn"
              required
              autoComplete="name"
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
              autoComplete="tel"
              inputMode="tel"
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
