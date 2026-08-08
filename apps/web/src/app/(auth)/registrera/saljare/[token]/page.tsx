"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, ShoppingBag, ExternalLink, LayoutDashboard } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { GUARDIAN_CONSENT_AGE } from "@roots/contracts";
import { LocaleLink } from "@/components/locale-link";
import { auth } from "@/i18n/dictionaries/auth";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_PASSWORD_LENGTH = 12;

export default function SellerRegistrationPage() {
  const params = useParams();
  const inviteToken = params.token as string;
  const { locale } = useLocale();
  const t = auth.registerSeller[locale];

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shopSlug, setShopSlug] = useState("");

  // Vi jämför bara årtal, precis som servern, så gränsfall hamnar på den
  // säkra sidan: den som fyller 18 senare i år får ändå frågan.
  const parsedBirthYear = Number(birthYear);
  const validBirthYear =
    /^\d{4}$/.test(birthYear) &&
    parsedBirthYear <= CURRENT_YEAR &&
    parsedBirthYear >= CURRENT_YEAR - 100;
  const needsGuardian =
    validBirthYear && CURRENT_YEAR - parsedBirthYear < GUARDIAN_CONSENT_AGE;
  const guardianComplete =
    !needsGuardian ||
    (guardianConsent &&
      guardianName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim()) &&
      guardianEmail.trim().toLowerCase() !== email.trim().toLowerCase());

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
            birthYear: parsedBirthYear,
            guardianName: needsGuardian ? guardianName.trim() : undefined,
            guardianEmail: needsGuardian ? guardianEmail.trim() : undefined,
            guardianConsent: needsGuardian ? guardianConsent : undefined,
          },
        }
      );

      if (!res.ok) {
        setError(res.data?.error || t.errorGeneric);
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
      setError(t.errorServer);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">
            {tFill(t.welcome, { firstName: displayName.split(" ")[0] })}
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            {t.successBody}
          </p>

          {shopSlug && (
            <div className="w-full rounded-lg bg-brand-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">{t.shopLinkLabel}</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {locale === "en" ? `/en/shop/${shopSlug}` : `/shop/${shopSlug}`}
              </p>
            </div>
          )}

          <div className="mt-2 flex w-full flex-col gap-2">
            {shopSlug && (
              <LocaleLink
                href={`/shop/${shopSlug}`}
                target="_blank"
                className="w-full"
              >
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t.viewShop}
                </Button>
              </LocaleLink>
            )}
            <LocaleLink href="/min-shop" className="w-full">
              <Button variant="outline" className="w-full">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {t.goToDashboard}
              </Button>
            </LocaleLink>
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
        <CardTitle className="text-2xl">{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* MASTERPLAN_01 KC6.6: FormField sköter id↔htmlFor + aria-
              describedby + aria-invalid + aria-required åt oss. Tidigare
              handcraftade <div><Label/><Input/></div>-block saknade
              describedby vilket gjorde att skärmläsaren aldrig hörde
              hjälptexterna. */}
          <FormField
            label={t.displayName}
            description={t.displayNameDescription}
            required
          >
            <Input
              placeholder={t.displayNamePlaceholder}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </FormField>
          <FormField label={t.email} required>
            <Input
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField
            label={t.password}
            description={tFill(t.passwordDescription, {
              minLength: MIN_PASSWORD_LENGTH,
            })}
            required
          >
            <Input
              type="password"
              placeholder={tFill(t.passwordPlaceholder, {
                minLength: MIN_PASSWORD_LENGTH,
              })}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField
            label={t.birthYear}
            description={tFill(t.birthYearDescription, {
              age: GUARDIAN_CONSENT_AGE,
            })}
            required
          >
            <Input
              type="text"
              inputMode="numeric"
              placeholder={t.birthYearPlaceholder}
              maxLength={4}
              autoComplete="bday-year"
              value={birthYear}
              onChange={(e) =>
                setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </FormField>

          {needsGuardian && (
            <div className="space-y-4 rounded-lg border border-brand-200 bg-brand-50/60 p-4">
              <p className="text-sm font-medium text-foreground">
                {t.guardianTitle}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t.guardianBody}
              </p>
              <FormField label={t.guardianName} required>
                <Input
                  placeholder={t.guardianNamePlaceholder}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </FormField>
              <FormField label={t.guardianEmail} required>
                <Input
                  type="email"
                  placeholder={t.guardianEmailPlaceholder}
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                />
              </FormField>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-700"
                />
                <span className="leading-relaxed text-muted-foreground">
                  {t.consentBefore}
                  <LocaleLink
                    href="/integritet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {t.privacyLink}
                  </LocaleLink>
                  {t.consentAfter}
                </span>
              </label>
            </div>
          )}
          <FormField label={t.phone} description={t.phoneDescription}>
            <Input
              type="tel"
              placeholder={t.phonePlaceholder}
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !displayName ||
              !email ||
              password.length < MIN_PASSWORD_LENGTH ||
              !validBirthYear ||
              !guardianComplete
            }
          >
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
    </Card>
  );
}
