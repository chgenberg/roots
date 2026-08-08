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
import { apiFetch, rootsFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";
import { LocaleLink } from "@/components/locale-link";
import { auth } from "@/i18n/dictionaries/auth";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

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
  const { locale, href } = useLocale();
  const t = auth.registerTeamLeader[locale];

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
        const res = await rootsFetch(`${API_URL}/v1/association/team-invites/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled)
            setPreviewError(data?.error || t.inviteNotFound);
        } else {
          const data = (await res.json()) as InvitePreview;
          if (!cancelled) {
            setPreview(data);
            if (data.invitedEmail) setEmail(data.invitedEmail);
          }
        }
      } catch {
        if (!cancelled) setPreviewError(t.inviteFetchFailed);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t.inviteNotFound, t.inviteFetchFailed]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!contactName.trim() || contactName.trim().length < 2) {
      setFormError(t.nameRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError(t.invalidEmail);
      return;
    }
    if (password.length < 8) {
      setFormError(t.passwordTooShort);
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
        setTimeout(
          () => router.push(href(res.data?.redirect || "/lag")),
          1500
        );
      } else {
        setFormError(res.data?.error || t.errorGeneric);
      }
    } catch {
      setFormError(t.errorServer);
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
          <h2 className="text-xl font-semibold">{t.inviteErrorTitle}</h2>
          <p className="text-center text-sm text-muted-foreground">
            {previewError || t.inviteFallback}
          </p>
          <Button variant="outline" asChild>
            <LocaleLink href="/login">{t.goToLogin}</LocaleLink>
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
          <h2 className="text-xl font-semibold">
            {tFill(t.welcome, { name: contactName })}
          </h2>
          <p className="text-center text-sm text-muted-foreground">
            {tFill(t.successBody, { teamName: preview.teamName })}
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
            {t.badge}
          </span>
        </div>
        <CardTitle className="text-2xl">
          {tFill(t.title, { teamName: preview.teamName })}
        </CardTitle>
        <CardDescription>
          {tFill(t.description, {
            orgName: preview.orgName,
            campaignName: preview.campaignName,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contactName">{t.contactName}</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t.contactNamePlaceholder}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="email">{t.email}</Label>
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
            <Label htmlFor="phone">{t.phone}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder={t.phonePlaceholder}
            />
          </div>
          <div>
            <Label htmlFor="password">{t.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={t.passwordPlaceholder}
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.submit}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t.legalNote}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
