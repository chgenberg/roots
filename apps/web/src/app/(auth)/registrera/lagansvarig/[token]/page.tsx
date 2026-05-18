"use client";

/**
 * Team-leader claim page — Sprint E9.
 *
 * The ASSOCIATION_ADMIN creates a `team_invites` row from inside the
 * portal and shares the resulting URL (`/registrera/lagansvarig/[token]`)
 * with the coach. This page:
 *
 *  1. GETs `/v1/association/team-invites/:token` to render the org +
 *     team name as confirmation that the link is for them.
 *  2. POSTs `/v1/association/team-invites/claim` with the leader's
 *     email + password + name once the form is submitted.
 *
 * On success the API sets the session cookie and we navigate to `/lag`.
 */

import { useState, useEffect } from "react";
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
import { Loader2, CheckCircle2, ShieldAlert, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

interface InvitePreview {
  teamName: string;
  invitedEmail: string | null;
  orgName: string;
  campaignName: string;
  expiresAt: string;
}

export default function TeamLeaderClaimPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/association/team-invites/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled)
            setPreviewError(data?.error || "Inbjudan hittades inte.");
        } else {
          const data = (await res.json()) as InvitePreview;
          if (!cancelled) {
            setPreview(data);
            if (data.invitedEmail) setEmail(data.invitedEmail);
          }
        }
      } catch {
        if (!cancelled)
          setPreviewError("Kunde inte hämta inbjudan. Försök igen om en stund.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!contactName.trim() || contactName.trim().length < 2) {
      setFormError("Skriv ditt namn.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Ogiltig e-postadress.");
      return;
    }
    if (password.length < 8) {
      setFormError("Lösenord måste vara minst 8 tecken.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok?: boolean;
        teamId?: string;
        redirect?: string;
        error?: string;
      }>("/v1/association/team-invites/claim", {
        method: "POST",
        body: {
          token,
          email: email.trim(),
          password,
          contactName: contactName.trim(),
          phone: phone.trim() || undefined,
        },
      });

      if (res.ok && res.data?.ok) {
        setSuccess(true);
        setTimeout(() => router.push(res.data?.redirect || "/lag"), 1500);
      } else {
        setFormError(
          res.data?.error || "Något gick fel. Försök igen."
        );
      }
    } catch {
      setFormError("Kunde inte nå servern. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (previewLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </CardContent>
      </Card>
    );
  }

  if (previewError || !preview) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-semibold">Inbjudan kunde inte öppnas</h2>
          <p className="text-center text-sm text-muted-foreground">
            {previewError || "Länken är ogiltig eller har gått ut."}
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Till inloggning
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">Välkommen, {contactName}!</h2>
          <p className="text-center text-sm text-muted-foreground">
            Ditt lag <strong>{preview.teamName}</strong> är skapat. Du
            skickas vidare till lagets dashboard…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" />
          <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
            Inbjudan som lagansvarig
          </span>
        </div>
        <CardTitle className="text-2xl">Bli lagansvarig för {preview.teamName}</CardTitle>
        <CardDescription>
          <strong>{preview.orgName}</strong> har bjudit in dig att leda laget i
          kampanjen "{preview.campaignName}". Skapa ditt konto nedan så är ni
          igång direkt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contactName">Ditt namn</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="För- och efternamn"
              required
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon (valfritt)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="0701234567"
            />
          </div>
          <div>
            <Label htmlFor="password">Välj lösenord</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minst 8 tecken"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Skapa lagansvarig-konto
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Genom att fortsätta godkänner du Roots användarvillkor och
            personuppgiftspolicy.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
