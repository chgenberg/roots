"use client";

import { useState } from "react";
import Link from "next/link";
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
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

type RegistrationType = "association" | "team" | null;

interface OrgSearchResult {
  id: string;
  name: string;
  type: string;
}

export default function RegisterPage() {
  const router = useRouter();
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
      const res = await fetch(
        `${API_URL}/v1/auth/organizations/search?q=${encodeURIComponent(query)}`,
        { credentials: "include" }
      );
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
        setError(data.error || "Något gick fel. Försök igen.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (type === "association") {
          router.push("/forening");
        } else {
          router.push("/lag");
        }
      }, 1500);
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
          <h2 className="text-xl font-semibold">Registrering klar!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Du skickas vidare till din dashboard...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!type) {
    return (
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Kom igång med Roots</CardTitle>
          <CardDescription>
            Välj hur du vill registrera dig
          </CardDescription>
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
              <p className="font-semibold">Förening</p>
              <p className="text-sm text-muted-foreground">
                Registrera din förening och hantera lag, mål och försäljning
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
              <p className="font-semibold">Lag eller klass</p>
              <p className="text-sm text-muted-foreground">
                Registrera ditt lag eller din klass och börja sälja direkt
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
        <Separator />
        <CardFooter className="justify-center pt-6 text-sm text-muted-foreground">
          Har ni redan konto?{" "}
          <Link
            href="/login"
            className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            Logga in
          </Link>
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
            Tillbaka
          </button>
          <span className="text-sm text-muted-foreground">
            Steg {step} av {totalSteps}
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
              ? "Din förening"
              : step === 2
              ? "Dina uppgifter"
              : "Ditt konto"
            : step === 1
            ? "Ditt lag eller klass"
            : step === 2
            ? "Dina uppgifter"
            : "Ditt konto"}
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
              <Label htmlFor="orgName">Föreningens namn *</Label>
              <Input
                id="orgName"
                placeholder="T.ex. Sundsvalls FK"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgNumber">Organisationsnummer</Label>
              <Input
                id="orgNumber"
                placeholder="XXXXXX-XXXX"
                value={orgNumber}
                onChange={(e) => setOrgNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalFederation">Riksorganisation</Label>
              <Input
                id="nationalFederation"
                placeholder="T.ex. Riksidrottsförbundet"
                value={nationalFederation}
                onChange={(e) => setNationalFederation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sportType">Idrott / Verksamhet</Label>
              <Input
                id="sportType"
                placeholder="T.ex. Fotboll"
                value={sportType}
                onChange={(e) => setSportType(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!orgName}
              onClick={() => setStep(2)}
            >
              Nästa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* TEAM Step 1: Team + org search */}
        {type === "team" && step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Lag-/klassnamn *</Label>
              <Input
                id="teamName"
                placeholder="T.ex. P13 Blå"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgSearch">Tillhör en förening?</Label>
              <Input
                id="orgSearch"
                placeholder="Sök efter din förening..."
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
                    Ändra
                  </button>
                </div>
              )}
            </div>
            {!selectedOrg && (
              <div className="space-y-2">
                <Label htmlFor="newOrgName">
                  Eller skriv föreningsnamn
                </Label>
                <Input
                  id="newOrgName"
                  placeholder="Om din förening inte finns i listan"
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
              Nästa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Shared Step 2: Personal info */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Ditt namn *</Label>
              <Input
                id="contactName"
                placeholder="Förnamn Efternamn"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
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
            <div className="space-y-2">
              <Label htmlFor="address">Leveransadress (för bulkleverans)</Label>
              <Input
                id="address"
                placeholder="Gatuadress"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postnummer</Label>
                <Input
                  id="postalCode"
                  placeholder="123 45"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ort</Label>
                <Input
                  id="city"
                  placeholder="Stockholm"
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
              Nästa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Shared Step 3: Account */}
        {step === 3 && (
          <div className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                Minst 8 tecken
              </p>
            </div>
            <Button
              className="w-full"
              disabled={loading || !email || password.length < 8}
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrerar...
                </>
              ) : (
                "Skapa konto"
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <Separator />
      <CardFooter className="justify-center pt-6 text-sm text-muted-foreground">
        Har ni redan konto?{" "}
        <Link
          href="/login"
          className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          Logga in
        </Link>
      </CardFooter>
    </Card>
  );
}
