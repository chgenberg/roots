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
  type LucideIcon,
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import { useLocale } from "@/i18n/locale-context";
import { pages } from "@/i18n/dictionaries/pages";
import { portalShared } from "@/i18n/dictionaries/portal-pages";

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

const SECTION_META: Record<
  string,
  { icon: LucideIcon; roles: Role[] }
> = {
  seller: { icon: ShoppingBag, roles: ["SELLER"] },
  "team-leader": { icon: Users, roles: ["TEAM_LEADER"] },
  association: { icon: Building2, roles: ["ASSOCIATION_ADMIN"] },
  club: { icon: ShoppingBag, roles: ["CLUB_ADMIN", "CLUB_MEMBER"] },
  sales: { icon: Briefcase, roles: ["SALES_REP", "SALES_ADMIN"] },
  internal: { icon: Shield, roles: ["INTERNAL_ADMIN"] },
  general: { icon: HelpCircle, roles: ["PUBLIC"] },
};

interface MeResponse {
  user: { id: string; role: Role; name: string; email: string } | null;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template
  );
}

export default function HelpPage() {
  const { locale } = useLocale();
  const t = pages.hjalp[locale];
  const [role, setRole] = useState<Role>("PUBLIC");
  const [meName, setMeName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState<string>(
    t.contactForm.subjectDefault
  );
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setContactSubject((prev) => {
      const defaults: string[] = [
        pages.hjalp.sv.contactForm.subjectDefault,
        pages.hjalp.en.contactForm.subjectDefault,
      ];
      return defaults.includes(prev) ? t.contactForm.subjectDefault : prev;
    });
  }, [locale, t.contactForm.subjectDefault]);

  useEffect(() => {
    (async () => {
      try {
        const res = await rootsFetch(`${API_URL}/v1/auth/me`);
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

  const sections = useMemo(
    () =>
      t.sections.map((section) => {
        const meta = SECTION_META[section.id] ?? {
          icon: HelpCircle,
          roles: ["PUBLIC"] as Role[],
        };
        return {
          ...section,
          icon: meta.icon,
          roles: meta.roles,
        };
      }),
    [t.sections]
  );

  const orderedSections = useMemo(() => {
    const own = sections.filter((s) => s.roles.includes(role));
    const rest = sections.filter((s) => !s.roles.includes(role));
    return [...own, ...rest];
  }, [sections, role]);

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
      setSubmitError(t.contactForm.allFieldsRequired);
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
        setSubmitError(res.data?.error ?? t.contactForm.sendFailed);
      } else {
        setSubmitOk(true);
        setContactMessage("");
      }
    } catch {
      setSubmitError(t.contactForm.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="mb-10 text-center">
        <Badge variant="outline" className="mb-3">
          {t.badge}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t.heroTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
          {t.heroBody}
        </p>
        {meName && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t.loggedInAs} <span className="font-medium">{meName}</span> ·{" "}
            {t.roleLabel}:{" "}
            <span className="font-medium">
              {portalShared[locale].roles[
                role as keyof typeof portalShared.sv.roles
              ] ?? role}
            </span>
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
              {t.backToPortal}
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
                      {interpolate(t.questionsCount, { n: section.items.length })}
                    </p>
                  </div>
                  {isOwn && (
                    <Badge variant="outline" className="text-xs">
                      {t.yourRoleBadge}
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
              <h2 className="text-base font-semibold">{t.contactTitle}</h2>
              <p className="text-xs text-muted-foreground">{t.contactSubtitle}</p>
            </div>
          </div>

          {submitOk ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{t.contactSuccessTitle}</p>
                <p className="text-xs">
                  {interpolate(t.contactSuccessBody, { email: contactEmail })}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contactName">{t.contactForm.name}</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">{t.contactForm.email}</Label>
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
                <Label htmlFor="contactSubject">{t.contactForm.subject}</Label>
                <Input
                  id="contactSubject"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  required
                  maxLength={300}
                />
              </div>
              <div>
                <Label htmlFor="contactMessage">{t.contactForm.message}</Label>
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
                  {interpolate(t.contactForm.charCount, {
                    n: contactMessage.length,
                  })}
                </p>
              </div>
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <Button type="submit" disabled={submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? t.contactForm.submitting : t.contactForm.submit}
              </Button>
            </form>
          )}

          <div className="mt-6 grid gap-3 border-t pt-6 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.emailLabel}</p>
                <a
                  href={`mailto:${t.email}`}
                  className="text-brand-700 hover:underline"
                >
                  {t.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.phoneLabel}</p>
                <p className="text-muted-foreground">{t.phoneHours}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
