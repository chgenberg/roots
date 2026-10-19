"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";

/**
 * Cookiebanner + Google Analytics 4.
 *
 * GA4 sätter analyscookies, så enligt LEK 9 kap. 28 § får skriptet inte
 * laddas förrän besökaren aktivt klickat Acceptera. Neka laddar ingenting.
 * Annonssignalerna i Consent Mode v2 är alltid nekade.
 *
 * GA får bara se publika sidor utan personuppgifter i adressen. Portalen,
 * inbjudningslänkar med token, orderbekräftelser och delade kalkyllänkar
 * (`?saljare=`) skickas aldrig till Google.
 */

const STORAGE_KEY = "roots-consent-v1";
const OPEN_CONSENT_EVENT = "roots:open-consent";
const READY_EVENT = "roots:consent-ready";
const READY_FLAG = "__rootsConsentReady";

type Choice = "granted" | "denied";

const PUBLIC_PREFIXES = [
  "/produkter",
  "/guider",
  "/om-oss",
  "/kontakt",
  "/sa-har-gar-det-till",
  "/sa-fungerar-det",
  "/klubbar",
  "/hjalp",
  "/haranalys",
  "/intresseanmalan",
  "/prova",
  "/villkor",
  "/integritet",
  "/foreningsliv",
];
const SHOP_PATH = /^\/shop\/[^/]+(\/kassa)?\/?$/;
const SAFE_QUERY_KEY = /^(utm_[a-z]+|gclid|gbraid|wbraid|fbclid|lang)$/;

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, "") || "/";
}

function isTrackable(pathname: string, search: string): boolean {
  const path = stripLocale(pathname);
  const pathOk =
    path === "/" ||
    SHOP_PATH.test(path) ||
    PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (!pathOk) return false;
  return [...new URLSearchParams(search).keys()].every((k) =>
    SAFE_QUERY_KEY.test(k)
  );
}

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: Choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* privat läge: valet gäller bara den här sidvisningen */
  }
}

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
} & Record<string, unknown>;

const win = () => window as unknown as GtagWindow;

function loadGa(id: string) {
  const w = win();
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // gtag.js kräver att själva arguments-objektet hamnar i dataLayer.
    w.dataLayer!.push(arguments);
  };
  w.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  w.gtag("js", new Date());
  w.gtag("config", id, { allow_google_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function revokeGa(id: string) {
  const w = win();
  w[`ga-disable-${id}`] = true;
  w.gtag?.("consent", "update", { analytics_storage: "denied" });
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.replace(/^www\./, "")}`];
  for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
    if (!name.startsWith("_ga")) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}

const COPY = {
  sv: {
    title: "Cookies på roots.nu",
    body: "Vi vill använda Google Analytics för att se hur sajten används, så att vi kan göra den bättre. Det sätter analyscookies. Inget används för annonsering.",
    readMore: "Läs mer",
    accept: "Acceptera",
    deny: "Neka",
    settings: "Cookieinställningar",
  },
  en: {
    title: "Cookies on roots.nu",
    body: "We'd like to use Google Analytics to see how the site is used so we can improve it. This sets analytics cookies. Nothing is used for advertising.",
    readMore: "Read more",
    accept: "Accept",
    deny: "Decline",
    settings: "Cookie settings",
  },
} as const;

/** Footerlänk för att ändra valet. Syns bara när GA4 är konfigurerat. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const { locale } = useLocale();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (win()[READY_FLAG]) setEnabled(true);
    const on = () => setEnabled(true);
    window.addEventListener(READY_EVENT, on);
    return () => window.removeEventListener(READY_EVENT, on);
  }, []);

  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {COPY[locale === "en" ? "en" : "sv"].settings}
    </button>
  );
}

export function AnalyticsConsent({ measurementId }: { measurementId: string }) {
  const { locale } = useLocale();
  const pathname = usePathname() ?? "/";
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChoice(readChoice());
    setReady(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    win()[READY_FLAG] = true;
    window.dispatchEvent(new Event(READY_EVENT));
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const trackable = isTrackable(pathname, ready ? location.search : "");

  useEffect(() => {
    if (!ready) return;
    const w = win();
    if (choice === "granted" && trackable) {
      w[`ga-disable-${measurementId}`] = false;
      loadGa(measurementId);
    } else if (w.gtag) {
      w[`ga-disable-${measurementId}`] = true;
    }
  }, [ready, choice, trackable, measurementId]);

  const decide = useCallback(
    (next: Choice) => {
      writeChoice(next);
      setChoice(next);
      setOpen(false);
      if (next === "denied") revokeGa(measurementId);
    },
    [measurementId]
  );

  const visible = ready && (open || (choice === null && trackable));
  if (!visible) return null;

  const t = COPY[locale === "en" ? "en" : "sv"];

  return (
    <div
      data-marketing=""
      role="dialog"
      aria-live="polite"
      aria-labelledby="roots-consent-title"
      className="fixed inset-x-3 bottom-3 z-[90] rounded-2xl border border-brand-100 bg-background p-5 shadow-xl sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md"
    >
      <h2 id="roots-consent-title" className="text-sm font-semibold">
        {t.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t.body}{" "}
        <LocaleLink
          href="/integritet#cookies"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t.readMore}
        </LocaleLink>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => decide("denied")}>
          {t.deny}
        </Button>
        <Button onClick={() => decide("granted")}>{t.accept}</Button>
      </div>
    </div>
  );
}
