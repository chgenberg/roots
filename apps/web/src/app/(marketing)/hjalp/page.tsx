"use client";

/**
 * Help / FAQ portal — Sprint E11.
 *
 * Single hub for every role. We *deliberately* serve it under
 * (marketing) so the page is reachable both pre- and post-login
 * without forcing a redirect. The FAQ sections are tagged by role,
 * and when the user is logged in we surface the relevant section
 * first — but everything is visible to every visitor so support
 * doesn't have to maintain N portals.
 *
 * Contact form posts to the existing `POST /v1/contact` (used by the
 * marketing kontakt-page). No new backend route was added.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Mail,
  Send,
  Phone,
  ShoppingBag,
  Users,
  Briefcase,
  Building2,
  Shield,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api";

const API_URL = getBrowserApiBase();

type Role =
  | "PUBLIC"
  | "SELLER"
  | "TEAM_LEADER"
  | "ASSOCIATION_ADMIN"
  | "CLUB_ADMIN"
  | "CLUB_MEMBER"
  | "SALES_REP"
  | "SALES_ADMIN"
  | "INTERNAL_ADMIN";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqSection {
  id: string;
  title: string;
  icon: typeof ShoppingBag;
  roles: Role[];
  items: FaqItem[];
}

const SECTIONS: FaqSection[] = [
  {
    id: "seller",
    title: "Säljare & egen shop",
    icon: ShoppingBag,
    roles: ["SELLER"],
    items: [
      {
        q: "Hur delar jag min shop?",
        a: "Gå till Min shop → kopiera länken eller använd QR-koden. Du kan dela direkt via SMS, e-post och sociala medier från delningssidan.",
      },
      {
        q: "Var ser jag mina beställningar?",
        a: "Klicka på Beställningar i vänsterspalten. Där kan du filtrera på status och datum, samt exportera till CSV.",
      },
      {
        q: "Hur byter jag lösenord?",
        a: "Inställningar → Byt lösenord. Demo-konton kan inte byta lösenord.",
      },
      {
        q: "Får jag pengarna direkt?",
        a: "Nej. Klarna-betalningarna går till föreningen och redovisas till lagansvarig vid kampanjens slut.",
      },
    ],
  },
  {
    id: "team-leader",
    title: "Lagansvarig",
    icon: Users,
    roles: ["TEAM_LEADER"],
    items: [
      {
        q: "Hur bjuder jag in säljare?",
        a: "Lag → Säljare → Bjud in. Du får en unik länk per säljare som de följer för att registrera sig.",
      },
      {
        q: "Kan jag sätta olika mål per säljare?",
        a: "Ja. På Säljar-listan klickar du på 'Sätt mål' eller 'Ändra' bredvid varje säljares progress-bar.",
      },
      {
        q: "Hur ser jag lagets totala försäljning?",
        a: "Översikten visar lagets samlade resultat, antal aktiva säljare och nuvarande genomsnitt per säljare.",
      },
    ],
  },
  {
    id: "association",
    title: "Förening & kampanjer",
    icon: Building2,
    roles: ["ASSOCIATION_ADMIN"],
    items: [
      {
        q: "Hur startar jag en ny kampanj?",
        a: "Förening → Ny kampanj. Ange namn, mål, marginal och datum så aktiveras kampanjen direkt.",
      },
      {
        q: "Hur lägger jag till ett nytt lag?",
        a: "Förening → Lag → Skapa nytt lag. Du genererar en inbjudningslänk som lagansvarig använder för att aktivera sig.",
      },
      {
        q: "Hur hanterar jag flera kampanjer samtidigt?",
        a: "Du kan ha en kampanj per lag aktiv. Skapa en kampanj per säsong; historiken behålls automatiskt.",
      },
    ],
  },
  {
    id: "club",
    title: "Klubb & abonnemang",
    icon: ShoppingBag,
    roles: ["CLUB_ADMIN", "CLUB_MEMBER"],
    items: [
      {
        q: "Var hittar jag mina fakturor?",
        a: "Portal → Fakturor. Filtrera på status (öppen, betald, makulerad) och datum. CSV-export finns för bokföring.",
      },
      {
        q: "Hur lägger jag till medlemmar?",
        a: "Portal → Medlemmar → Bjud in. Inbjudningar går via e-post och giltighetstid är 7 dagar.",
      },
      {
        q: "Hur ändrar jag mitt abonnemang?",
        a: "Kontakta din kontoansvariga säljare eller skicka in formuläret längst ned på denna sida.",
      },
    ],
  },
  {
    id: "sales",
    title: "Sälj-team & pipeline",
    icon: Briefcase,
    roles: ["SALES_REP", "SALES_ADMIN"],
    items: [
      {
        q: "Hur skapar jag ett nytt lead?",
        a: "Portal → Pipeline → Nytt lead. Ange klubbnamn, källa och potential så hamnar leadet på dig direkt.",
      },
      {
        q: "Hur stänger jag en deal?",
        a: "Flytta leadet i Pipeline-vyn från QUALIFIED → WON. Då skapas automatiskt en organisation och första-kontakts-faktura.",
      },
      {
        q: "Hur ser jag min provision?",
        a: "Portal → Översikt visar dina aktuella deals, deras värde och förväntad provision.",
      },
    ],
  },
  {
    id: "internal",
    title: "Drift & administration",
    icon: Shield,
    roles: ["INTERNAL_ADMIN"],
    items: [
      {
        q: "Var hittar jag audit-loggen?",
        a: "Portal → Audit-log. Du kan filtrera på åtgärd, entitetstyp, användar-UUID och datumintervall.",
      },
      {
        q: "Hur ser jag systemhälsa?",
        a: "Portal → System visar API-uppetid, Sentry-event och senaste deployer.",
      },
      {
        q: "Hur återställs ett demokonto?",
        a: "Demo-konton återställs automatiskt varje natt via cron-jobbet seed-demo:nightly.",
      },
    ],
  },
  {
    id: "general",
    title: "Allmänt om Roots",
    icon: HelpCircle,
    roles: ["PUBLIC"],
    items: [
      {
        q: "Vad är Roots?",
        a: "En plattform för insamlings­kampanjer där föreningar säljer produkter via personliga shopar. Betalning via Klarna eller direkt till lagansvarig.",
      },
      {
        q: "Hur startar vi en kampanj?",
        a: "Besök kontakt-sidan eller boka demo. En av våra ASM:er kontaktar er inom 24 timmar.",
      },
      {
        q: "Vad kostar det?",
        a: "Roots tar inga uppstartsavgifter — vi finansieras via marginalen på sålda produkter. Kontakta sälj för aktuell prislista.",
      },
      {
        q: "Är det GDPR-säkert?",
        a: "Ja. All data lagras inom EU, betalningar hanteras av Klarna, och vi loggar alla användaråtgärder för spårbarhet.",
      },
    ],
  },
];

interface MeResponse {
  user: { id: string; role: Role; name: string; email: string } | null;
}

export default function HelpPage() {
  const [role, setRole] = useState<Role>("PUBLIC");
  const [meName, setMeName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("Hjälp via portalen");
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const j = (await res.json()) as MeResponse;
        if (j.user) {
          setRole(j.user.role);
          setMeName(j.user.name);
          setContactName(j.user.name);
          setContactEmail(j.user.email);
        }
      } catch {
        // ignored — page works for logged-out visitors too.
      }
    })();
  }, []);

  // Roles see their own section first, then everything else. The
  // PUBLIC bucket is always last because logged-in users rarely
  // need it but it's nice to keep it discoverable.
  const orderedSections = useMemo(() => {
    const own = SECTIONS.filter((s) => s.roles.includes(role));
    const rest = SECTIONS.filter((s) => !s.roles.includes(role));
    return [...own, ...rest];
  }, [role]);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(false);
    if (
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactSubject.trim() ||
      !contactMessage.trim()
    ) {
      setSubmitError("Alla fält måste fyllas i.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ error?: string }>("/v1/contact", {
        method: "POST",
        body: {
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
        },
      });
      if (!res.ok) {
        setSubmitError(res.data?.error ?? "Kunde inte skicka meddelandet.");
      } else {
        setSubmitOk(true);
        setContactMessage("");
      }
    } catch {
      setSubmitError("Nätverksfel. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="mb-10 text-center">
        <Badge variant="outline" className="mb-3">
          Hjälp & support
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Vi hjälper dig komma igång
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
          Vanliga frågor sorterade efter din roll. Hittar du inte svaret?
          Skicka in formuläret längst ned så svarar vi inom 24 timmar.
        </p>
        {meName && (
          <p className="mt-2 text-sm text-muted-foreground">
            Inloggad som <span className="font-medium">{meName}</span> · roll:{" "}
            <span className="font-mono">{role}</span>
            {/* P2.57 (audit 2026-05-26): tidigare tappade /hjalp helt
                navigation tillbaka till portalen — användaren landade
                på marketing-chrome med "Logga in / Registrera" trots
                aktiv session. Visar en uttrycklig länk till hemma-
                portalen baserat på roll så vägen tillbaka är ett klick. */}
            {" · "}
            <a
              href={
                role === "ASSOCIATION_ADMIN"
                  ? "/forening"
                  : role === "TEAM_LEADER"
                  ? "/lag"
                  : role === "SELLER"
                  ? "/min-shop"
                  : "/portal"
              }
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Tillbaka till portalen
            </a>
          </p>
        )}
      </div>

      <div className="space-y-4">
        {orderedSections.map((section) => {
          const Icon = section.icon;
          const isOwn = section.roles.includes(role);
          return (
            <Card
              key={section.id}
              className={isOwn ? "border-brand-200 bg-brand-50/40" : undefined}
            >
              <CardContent className="p-0">
                <div className="flex items-center gap-3 border-b px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold">{section.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {section.items.length} frågor
                    </p>
                  </div>
                  {isOwn && (
                    <Badge variant="outline" className="text-xs">
                      Din roll
                    </Badge>
                  )}
                </div>
                <div className="divide-y">
                  {section.items.map((it, idx) => {
                    const key = `${section.id}:${idx}`;
                    const isOpen = expanded === key;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-brand-50/50"
                        >
                          <span className="flex-1 text-sm font-medium">
                            {it.q}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                            {it.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-10">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Kontakta support</h2>
              <p className="text-xs text-muted-foreground">
                Vi svarar normalt inom en arbetsdag.
              </p>
            </div>
          </div>

          {submitOk ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Meddelandet har skickats</p>
                <p className="text-xs">Vi återkommer till {contactEmail}.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contactName">Namn</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">E-post</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    maxLength={254}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contactSubject">Ämne</Label>
                <Input
                  id="contactSubject"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  required
                  maxLength={300}
                />
              </div>
              <div>
                <Label htmlFor="contactMessage">Meddelande</Label>
                <textarea
                  id="contactMessage"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                  rows={5}
                  maxLength={5000}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {contactMessage.length}/5000 tecken
                </p>
              </div>
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <Button type="submit" disabled={submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Skickar…" : "Skicka meddelande"}
              </Button>
            </form>
          )}

          <div className="mt-6 grid gap-3 border-t pt-6 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">E-post</p>
                <a
                  href="mailto:hej@roots.se"
                  className="text-brand-700 hover:underline"
                >
                  hej@roots.se
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Telefon</p>
                <p className="text-muted-foreground">
                  Vardagar 09–17 (via formulär ovan)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
