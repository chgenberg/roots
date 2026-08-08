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
import { apiFetch, rootsFetch } from "@/lib/api";
import { getBrowserApiBase } from "@/lib/api-base";
import { LocaleLink } from "@/components/locale-link";
import { auth } from "@/i18n/dictionaries/auth";
import { tFill } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-context";

const API_URL = getBrowserApiBase();

type RegistrationType = "association" | "team" | null;

interface OrgSearchResult {
  id: string;
  name: string;
  type: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { locale } = useLocale();
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
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [orgSearchResults, setOrgSearchResults] = useState<OrgSearchResult[]>(
    []
  );
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchResult | null>(null);
  const [newOrgName, setNewOrgName] = useState("");

  async function searchOrganizations(query: string) {
    setOrgSearchQuery(query);
    if (query.length < 2) {
      setOrgSearchResults([]);
      return;
    }
    try {
      const res = await rootsFetch(`${API_URL}/v1/auth/organizations/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setOrgSearchResults(data.organizations || []);
    } catch {
      setOrgSearchResults([]);
    }
  }

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
              orgName: selectedOrg ? undefined : newOrgName || undefined,
              existingOrgId: selectedOrg?.id,
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
          router.push("/forening/kom-igang?onboarding=1");
        } else {
          router.push("/lag");
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
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12">
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
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t.chooserTitle}</CardTitle>
          <CardDescription>{t.chooserDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={() => {
              setType("association");
              setStep(1);
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-border p-5 text-left transition-all hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <Building2 className="h-6 w-6 text-brand-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{t.clubTitle}</p>
              <p className="text-sm text-muted-foreground">
                {t.clubDescription}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            onClick={() => {
              setType("team");
              setStep(1);
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-border p-5 text-left transition-all hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <Users className="h-6 w-6 text-brand-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{t.teamTitle}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamDescription}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
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
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
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
              className="w-full"
              disabled={!orgName}
              onClick={() => setStep(2)}
            >
              {t.next}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* TEAM Step 1: Team + org search */}
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
              <Label htmlFor="orgSearch">{t.orgSearch}</Label>
              <Input
                id="orgSearch"
                placeholder={t.orgSearchPlaceholder}
                value={orgSearchQuery}
                onChange={(e) => searchOrganizations(e.target.value)}
              />
              {orgSearchResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border bg-background">
                  {orgSearchResults.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org);
                        setOrgSearchQuery(org.name);
                        setOrgSearchResults([]);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {org.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedOrg && (
                <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{selectedOrg.name}</span>
                  <button
                    onClick={() => {
                      setSelectedOrg(null);
                      setOrgSearchQuery("");
                    }}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    {t.changeOrg}
                  </button>
                </div>
              )}
            </div>
            {!selectedOrg && (
              <div className="space-y-2">
                <Label htmlFor="newOrgName">{t.newOrgName}</Label>
                <Input
                  id="newOrgName"
                  placeholder={t.newOrgNamePlaceholder}
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
            )}
            <Button
              className="w-full"
              disabled={!teamName}
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
              className="w-full"
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
              className="w-full"
              disabled={loading || !email || password.length < 8}
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
