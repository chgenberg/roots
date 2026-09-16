"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Loader2,
  Building2,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LocaleLink } from "@/components/locale-link";
import { GATE_CARD, GATE_PRIMARY_BTN, GateWordmark } from "@/components/gate-room";
import { auth } from "@/i18n/dictionaries/auth";
import { cn } from "@/lib/utils";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const MIN_PASSWORD_LENGTH = 12;

type RegistrationType = "association" | "team" | null;

export default function RegisterPage() {
  const router = useRouter();
  const { locale, href } = useLocale();
  const t = auth.register[locale];
  const [type, setType] = useState<RegistrationType>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Association fields
  const [orgName, setOrgName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [nationalFederation, setNationalFederation] = useState("");
  const [sportType, setSportType] = useState("");

  // Team fields
  const [teamName, setTeamName] = useState("");
  const [newOrgName, setNewOrgName] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const body =
        type === "association"
          ? {
              orgName,
              orgNumber: orgNumber || undefined,
              nationalFederation: nationalFederation || undefined,
              sportType: sportType || undefined,
              email,
              password,
              contactName,
              phone: phone || undefined,
              addressLine1: addressLine1 || undefined,
              city: city || undefined,
              postalCode: postalCode || undefined,
            }
          : {
              teamName,
              orgName: newOrgName || undefined,
              email,
              password,
              contactName,
              phone: phone || undefined,
              addressLine1: addressLine1 || undefined,
              city: city || undefined,
              postalCode: postalCode || undefined,
            };

      const endpoint =
        type === "association"
          ? "/v1/auth/register/association"
          : "/v1/auth/register/team-leader";

      const { ok: resOk, data } = await apiFetch<{ error?: string }>(
        endpoint,
        { method: "POST", body }
      );

      if (!resOk) {
        setError(data.error || t.errorGeneric);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (type === "association") {
          // MASTERPLAN_01 KC3.1: skicka ASSOCIATION_ADMIN till kom-igång-
          // sidan istället för en tom dashboard. ?onboarding=1 låter
          // sidan visa en specifik welcome-header för fresh signups.
          router.push(href("/forening/kom-igang?onboarding=1"));
        } else {
          router.push(href("/lag"));
        }
      }, 1500);
    } catch {
      setError(t.errorServer);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className={cn(GATE_CARD, "mx-auto max-w-md")}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <GateWordmark href="/" ariaLabel={auth.layout[locale].ariaHome} />
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="text-xl font-semibold">{t.successTitle}</h2>
          <p className="text-sm text-muted-foreground text-center">
            {t.successBody}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!type) {
    return (
      <Card className={cn(GATE_CARD, "mx-auto max-w-lg")}>
        <CardHeader className="text-center">
          <GateWordmark href="/" ariaLabel={auth.layout[locale].ariaHome} />
          <CardTitle className="mt-6 text-2xl">{t.chooserTitle}</CardTitle>
          <CardDescription>{t.chooserDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            onClick={() => {
              setType("association");
              setStep(1);
            }}
            className="flex w-full items-start gap-4 rounded-2xl border-2 border-brand-700/20 bg-brand-50 p-6 text-left transition-all hover:border-brand-700/40 hover:shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand-700">
                {t.clubRecommended}
              </p>
              <p className="mt-1 text-lg font-semibold">{t.clubTitle}</p>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                {t.clubDescription}
              </p>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
          </button>

          <button
            onClick={() => {
              setType("team");
              setStep(1);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-all hover:border-brand-400 hover:bg-brand-50/40"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100">
              <Users className="h-4 w-4 text-brand-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.teamTitle}</p>
              <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                {t.teamDescription}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <p className="text-pretty text-center text-xs leading-relaxed text-muted-foreground">
            {t.chooserHint}
          </p>
        </CardContent>
        <Separator />
        <CardFooter className="justify-center pt-6 text-sm text-muted-foreground">
          {t.alreadyHaveAccount}{" "}
          <LocaleLink
            href="/login"
            className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.loginLink}
          </LocaleLink>
        </CardFooter>
      </Card>
    );
  }

  const totalSteps = type === "association" ? 3 : 3;

  return (
    <Card className={cn(GATE_CARD, "mx-auto max-w-lg")}>
      <CardHeader>
        <GateWordmark href="/" ariaLabel={auth.layout[locale].ariaHome} />
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 1) {
                setType(null);
                setStep(0);
              } else {
                setStep(step - 1);
              }
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </button>
          <span className="text-sm text-muted-foreground">
            {tFill(t.stepOf, { step, total: totalSteps })}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? "bg-brand-700" : "bg-brand-100"
              }`}
            />
          ))}
        </div>
        <CardTitle className="mt-4 text-xl">
          {type === "association"
            ? step === 1
              ? t.stepClubInfo
              : step === 2
              ? t.stepYourDetails
              : t.stepYourAccount
            : step === 1
            ? t.stepTeamInfo
            : step === 2
            ? t.stepYourDetails
            : t.stepYourAccount}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* ASSOCIATION Step 1: Organization info */}
        {type === "association" && step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">{t.orgName}</Label>
              <Input
                id="orgName"
                placeholder={t.orgNamePlaceholder}
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgNumber">{t.orgNumber}</Label>
              <Input
                id="orgNumber"
                placeholder={t.orgNumberPlaceholder}
                value={orgNumber}
                onChange={(e) => setOrgNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalFederation">{t.nationalFederation}</Label>
              <Input
                id="nationalFederation"
                placeholder={t.nationalFederationPlaceholder}
                value={nationalFederation}
                onChange={(e) => setNationalFederation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sportType">{t.sportType}</Label>
              <Input
                id="sportType"
                placeholder={t.sportTypePlaceholder}
                value={sportType}
                onChange={(e) => setSportType(e.target.value)}
              />
            </div>
            <Button
              className={GATE_PRIMARY_BTN}
              disabled={!orgName}
              onClick={() => setStep(2)}
            >
              {t.next}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* TEAM Step 1: Team + new club (existing clubs use an invite) */}
        {type === "team" && step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">{t.teamName}</Label>
              <Input
                id="teamName"
                placeholder={t.teamNamePlaceholder}
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newOrgName">{t.newOrgName}</Label>
              <Input
                id="newOrgName"
                placeholder={t.newOrgNamePlaceholder}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.existingClubNote}</p>
            </div>
            <Button
              className={GATE_PRIMARY_BTN}
              disabled={!teamName.trim() || !newOrgName.trim()}
              onClick={() => setStep(2)}
            >
              {t.next}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Shared Step 2: Personal info */}
        {/* MASTERPLAN_01 KC6.7: autoComplete-tokens så att Safari/Chrome
            password-manager + adressfyllning faktiskt fungerar. Annars
            tvingas användaren skriva för hand vilket är friction nr 1
            på mobil. inputMode="numeric" på postnummer triggar
            number-keypad. */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">{t.contactName}</Label>
              <Input
                id="contactName"
                placeholder={t.contactNamePlaceholder}
                required
                autoComplete="name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t.phonePlaceholder}
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t.address}</Label>
              <Input
                id="address"
                placeholder={t.addressPlaceholder}
                autoComplete="street-address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">{t.postalCode}</Label>
                <Input
                  id="postalCode"
                  placeholder={t.postalCodePlaceholder}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  pattern="\d{3}\s?\d{2}"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t.city}</Label>
                <Input
                  id="city"
                  placeholder={t.cityPlaceholder}
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
            <Button
              className={GATE_PRIMARY_BTN}
              disabled={!contactName}
              onClick={() => setStep(3)}
            >
              {t.next}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Shared Step 3: Account */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.emailPlaceholder}
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.passwordPlaceholder}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
            </div>
            <Button
              className={GATE_PRIMARY_BTN}
              disabled={
                loading || !email || password.length < MIN_PASSWORD_LENGTH
              }
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.registering}
                </>
              ) : (
                t.createAccount
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <Separator />
      <CardFooter className="justify-center pt-6 text-sm text-muted-foreground">
        {t.alreadyHaveAccount}{" "}
        <LocaleLink
          href="/login"
          className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.loginLink}
        </LocaleLink>
      </CardFooter>
    </Card>
  );
}
