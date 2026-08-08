"use client";

import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";
import { tFill } from "@/i18n/format";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { absoluteLocaleUrl } from "@/i18n/paths";
import { LocaleLink } from "@/components/locale-link";

/**
 * /installningar — shared settings surface for the three fundraising
 * roles (ASSOCIATION_ADMIN, TEAM_LEADER, SELLER).
 *
 * Sprint E8 deliverable. Previously the only thing a logged-in seller
 * could do beyond their dashboard was sign out — and even that was
 * hidden under a non-sticky sidebar. This page covers:
 *
 *  - Profile card  : name, email, role, organisation (read-only).
 *  - Shop card     : only rendered for SELLER, surfacing the public
 *                    shop URL + a one-click copy.
 *  - Password card : POST /v1/auth/change-password with full client-
 *                    side validation matching the API contract.
 *  - Notification  : placeholder card so the spot is reserved without
 *                    pretending we support it yet.
 *
 * No fake data — every value comes from /v1/auth/me or
 * /v1/dashboard/seller. If the API is unreachable we show a clear
 * empty state instead of mock numbers.
 */

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Building2,
  Shield,
  Lock,
  Bell,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch, rootsFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

interface MeUser {
  email: string;
  role: string;
  name: string;
  orgName: string;
}



export default function InstallningarPage() {
  const { locale, href } = useLocale();
  const t = fundraisingPages.settings[locale];
  const c = fundraisingPages.common[locale];
  const dateLocale = appCommon[locale].dateLocale;

  const { toast } = useToast();

  const [me, setMe] = useState<MeUser | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [sellerShopSlug, setSellerShopSlug] = useState<string | null>(null);

  // Password form state. We don't keep these in a single object so a
  // failed submit doesn't accidentally clear the user's input.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Association org details (ASSOCIATION_ADMIN only).
  const [orgNumber, setOrgNumber] = useState("");
  const [sportType, setSportType] = useState("");
  const [nationalFederation, setNationalFederation] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [orgVerified, setOrgVerified] = useState(false);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const meRes = await rootsFetch(`${API_URL}/v1/auth/me`);
        if (!meRes.ok) {
          if (!cancelled) setMeLoading(false);
          return;
        }
        const meData = await meRes.json();
        if (cancelled) return;
        setMe(meData.user ?? null);

        if (meData.user?.role === "SELLER") {
          const shopRes = await rootsFetch(`${API_URL}/v1/dashboard/seller`);
          if (shopRes.ok) {
            const shopData = await shopRes.json();
            if (!cancelled) setSellerShopSlug(shopData?.seller?.shopSlug ?? null);
          }
        }

        if (meData.user?.role === "ASSOCIATION_ADMIN") {
          const orgRes = await apiFetch<{
            organization?: {
              orgNumber?: string | null;
              sportType?: string | null;
              nationalFederation?: string | null;
              postalCode?: string | null;
              municipality?: string | null;
              verified?: boolean;
            };
          }>("/v1/association/org");
          if (orgRes.ok && orgRes.data.organization && !cancelled) {
            const o = orgRes.data.organization;
            setOrgNumber(o.orgNumber ?? "");
            setSportType(o.sportType ?? "");
            setNationalFederation(o.nationalFederation ?? "");
            setPostalCode(o.postalCode ?? "");
            setMunicipality(o.municipality ?? "");
            setOrgVerified(!!o.verified);
            setOrgLoaded(true);
          }
        }
      } catch {
        // Silent — empty state if me stays null.
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (orgSaving) return;
    setOrgSaving(true);
    try {
      const res = await apiFetch<{ ok?: boolean; error?: string }>(
        "/v1/association/org",
        {
          method: "PATCH",
          body: {
            orgNumber,
            sportType,
            nationalFederation,
            postalCode,
            municipality,
          },
        }
      );
      if (res.ok) {
        toast(t.orgSaved, "success");
      } else {
        toast(res.data?.error || t.orgSaveFailed, "error");
      }
    } catch {
      toast(c.networkError, "error");
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwSubmitting) return;

    // Client-side mirrors the API rules in apps/api/src/routes/auth.ts
    // so the user gets immediate feedback instead of a round-trip.
    if (!currentPassword || !newPassword) {
      toast(t.bothRequired, "error");
      return;
    }
    if (newPassword.length < 8) {
      toast(t.passwordMin, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t.passwordMismatch, "error");
      return;
    }
    if (newPassword === currentPassword) {
      toast(t.passwordSame, "error");
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await apiFetch<{ ok?: true; error?: string }>(
        "/v1/auth/change-password",
        {
          method: "POST",
          body: { currentPassword, newPassword },
        }
      );
      if (res.ok && res.data?.ok) {
        toast(t.passwordUpdated, "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast(
          res.data?.error || t.passwordFailed,
          "error"
        );
      }
    } catch {
      toast(c.networkError, "error");
    } finally {
      setPwSubmitting(false);
    }
  }

  function copyShopLink() {
    if (!sellerShopSlug || !SITE_URL) return;
    try {
      navigator.clipboard.writeText(
        absoluteLocaleUrl(SITE_URL, `/shop/${sellerShopSlug}`, locale)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(c.copyLinkFailed, "error");
    }
  }

  if (meLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t.loadFailed}
        </p>
      </div>
    );
  }

  const roleLabel =
    me.role === "ASSOCIATION_ADMIN"
      ? t.roleAssociationAdmin
      : me.role === "TEAM_LEADER"
        ? t.roleTeamLeader
        : me.role === "SELLER"
          ? t.roleSeller
          : me.role;
  const shopUrl = sellerShopSlug
    ? absoluteLocaleUrl(SITE_URL, `/shop/${sellerShopSlug}`, locale)
    : null;

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {/* ── Profile ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {t.profile}
          </CardTitle>
          <CardDescription>
            {t.profileDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.name}
              </Label>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                {me.name || "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.email}
              </Label>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {me.email}
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.role}
              </Label>
              <p className="mt-1 flex items-center gap-2 text-sm">
                <Badge className="bg-brand-100 text-brand-700">
                  {roleLabel}
                </Badge>
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.organisation}
              </Label>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {me.orgName || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Association org details ─────────────────────────────── */}
      {me.role === "ASSOCIATION_ADMIN" && orgLoaded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t.orgDetails}
            </CardTitle>
            <CardDescription>
              {t.orgDescBase}
              {orgVerified ? t.orgVerified : t.orgPending}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="orgNumber">{t.orgNumber}</Label>
                  <Input
                    id="orgNumber"
                    value={orgNumber}
                    onChange={(e) => setOrgNumber(e.target.value)}
                    placeholder="556677-8899"
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <Label htmlFor="sportType">{t.sportType}</Label>
                  <Input
                    id="sportType"
                    value={sportType}
                    onChange={(e) => setSportType(e.target.value)}
                    placeholder={t.sportPlaceholder}
                  />
                </div>
                <div>
                  <Label htmlFor="nationalFederation">{t.federation}</Label>
                  <Input
                    id="nationalFederation"
                    value={nationalFederation}
                    onChange={(e) => setNationalFederation(e.target.value)}
                    placeholder={t.federationPlaceholder}
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">{t.postalCode}</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="11122"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="municipality">{t.municipality}</Label>
                  <Input
                    id="municipality"
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    placeholder={t.municipalityPlaceholder}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={orgSaving}>
                  {orgSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t.saveOrg}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Shop URL (only for sellers) ─────────────────────────── */}
      {me.role === "SELLER" && shopUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {t.yourShop}
            </CardTitle>
            <CardDescription>
              {t.yourShopDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={shopUrl} className="font-mono text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={copyShopLink}
                aria-label={t.copyShopLink}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Change password ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t.changePassword}
          </CardTitle>
          <CardDescription>
            {t.passwordDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">{t.currentPassword}</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="newPassword">{t.newPassword}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={pwSubmitting}
              >
                {c.clear}
              </Button>
              <Button type="submit" disabled={pwSubmitting}>
                {pwSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t.updatePassword}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Notifications placeholder ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t.notifications}
          </CardTitle>
          <CardDescription>
{t.notificationsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t.notificationsBody}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
