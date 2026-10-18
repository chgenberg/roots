"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { RootsLogo } from "@/components/brand";
import { LocaleLink } from "@/components/locale-link";
import { ShareActions } from "@/components/share-actions";
import { useLocale } from "@/i18n/locale-context";
import { absoluteLocaleUrl } from "@/i18n/paths";
import { tFill } from "@/i18n/format";
import {
  DEMO_DEFAULT_GOAL_KR,
  DEMO_GOALS_KR,
  DEMO_RAISED_SHARE,
  clubGenitive,
  demo,
} from "@/i18n/dictionaries/demo";
import { getPublicSiteUrl } from "@/lib/site-url";
import { rememberDemo } from "@/lib/visitor-memory";
import { accentTokens, dominantColour, isHexColour, type AccentTokens } from "@/lib/club-brand/colour";
import { cn } from "@/lib/utils";

export type DemoProduct = { slug: string; name: string; priceSek: number; image: string };

type Props = {
  products: DemoProduct[];
  initialClub?: string;
  initialTeam?: string;
  initialGoalKr?: number;
  initialWebsite?: string;
  initialColour?: string;
  shared?: boolean;
};

type Brand = { host: string; name: string | null; color: string | null; colorSource: "club" | "theme" | null; logo: string | null };
type BrandStatus = "idle" | "loading" | "found" | "nologo" | "error" | "limited";

/** "https://www.brunfloik.se/" → "brunfloik.se". Det som står i delningslänken. */
function compactSite(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .slice(0, 120);
}

const looksLikeSite = (v: string) => /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(compactSite(v));

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function kr(value: number, locale: "sv" | "en"): string {
  const n = Math.round(value).toLocaleString(locale === "en" ? "en-GB" : "sv-SE");
  return locale === "en" ? `SEK ${n}` : `${n} kr`;
}

/** Räknar mjukt upp mot `target` när det ändras. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      fromRef.current = next;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export function DemoShop({
  products,
  initialClub = "",
  initialTeam = "",
  initialGoalKr,
  initialWebsite = "",
  initialColour,
  shared,
}: Props) {
  const { locale } = useLocale();
  const t = demo[locale];
  const [club, setClub] = useState(initialClub);
  const [team, setTeam] = useState(initialTeam);
  const [goalKr, setGoalKr] = useState<number>(
    DEMO_GOALS_KR.includes(initialGoalKr as (typeof DEMO_GOALS_KR)[number])
      ? (initialGoalKr as number)
      : DEMO_DEFAULT_GOAL_KR
  );
  const [qr, setQr] = useState<string | null>(null);
  const [meterReady, setMeterReady] = useState(false);
  const [website, setWebsite] = useState(initialWebsite);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandStatus, setBrandStatus] = useState<BrandStatus>("idle");
  const [colour, setColour] = useState<string | null>(isHexColour(initialColour) ? initialColour : null);
  /** Namnet fylldes i från sajten — då får nästa sajt byta det. */
  const clubFromSite = useRef(false);
  const site = compactSite(website);
  const siteOk = looksLikeSite(website);
  const accent = useMemo(() => (colour ? accentTokens(colour) : null), [colour]);

  useEffect(() => {
    if (!siteOk) {
      setBrand(null);
      setBrandStatus("idle");
      setColour(null);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setBrandStatus("loading");
      try {
        const res = await fetch(`/api/klubbprofil?webb=${encodeURIComponent(site)}`, { signal: controller.signal });
        const data = (await res.json()) as { ok: boolean; brand?: Brand; error?: string };
        if (!data.ok || !data.brand) {
          setBrand(null);
          setBrandStatus(data.error === "limited" ? "limited" : "error");
          return;
        }
        const found = data.brand;
        const fromLogo =
          found.colorSource === "club" ? null : found.logo ? await dominantColour(found.logo) : null;
        if (controller.signal.aborted) return;
        setBrand(found);
        setColour(found.colorSource === "club" ? found.color : fromLogo ?? found.color);
        setBrandStatus(found.logo ? "found" : "nologo");
        if (found.name && (!club.trim() || clubFromSite.current)) {
          setClub(found.name.slice(0, 60));
          clubFromSite.current = true;
        }
      } catch {
        if (!controller.signal.aborted) setBrandStatus("error");
      }
    }, 650);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
    // Bara adressen styr hämtningen; namnet läses vid svaret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, siteOk]);

  const clubName = club.trim();
  const hasClub = clubName.length >= 2;
  const displayClub = hasClub ? clubName : t.previewFallbackClub;
  const teamName = team.trim();
  const raisedTarget = meterReady ? Math.round((goalKr * DEMO_RAISED_SHARE) / 10) * 10 : 0;
  const raised = useCountUp(raisedTarget);
  const pct = goalKr > 0 ? Math.min(100, (raised / goalKr) * 100) : 0;

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (hasClub) p.set("forening", clubName);
    if (teamName) p.set("lag", teamName);
    if (goalKr !== DEMO_DEFAULT_GOAL_KR) p.set("mal", String(goalKr));
    if (siteOk) p.set("webb", site);
    if (siteOk && colour) p.set("farg", colour.slice(1));
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [hasClub, clubName, teamName, goalKr, siteOk, site, colour]);

  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(absoluteLocaleUrl(getPublicSiteUrl(), `/prova${query}`, locale));
  }, [query, locale]);

  useEffect(() => {
    const id = window.setTimeout(() => setMeterReady(true), 350);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const path = `${window.location.pathname}${query}`;
      window.history.replaceState(window.history.state, "", path);
      if (hasClub) rememberDemo(clubName, teamName, goalKr, siteOk ? site : undefined, colour ?? undefined);
    }, 400);
    return () => window.clearTimeout(id);
  }, [query, hasClub, clubName, teamName, goalKr, siteOk, site, colour]);

  useEffect(() => {
    if (!shareUrl) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#3F372B", light: "#FFFFFF" },
      })
        .then((url) => !cancelled && setQr(url))
        .catch(() => !cancelled && setQr(null));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [shareUrl]);

  const genitive = clubGenitive(displayClub, locale);
  const interestHref = hasClub
    ? `/intresseanmalan?forening=${encodeURIComponent(clubName)}`
    : "/intresseanmalan";

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
      <div className="contents lg:block lg:space-y-6">
        {shared && hasClub && (
          <p className="order-1 rounded-2xl bg-[#F3EEE6] px-5 py-3.5 text-sm text-[#5E5341]">
            {tFill(t.sharedBanner, { clubGen: genitive })}
          </p>
        )}

        <div className="order-1 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(94,83,65,0.06),0_12px_32px_-14px_rgba(94,83,65,0.25)] ring-1 ring-[#E6DED2] sm:p-8">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="demo-club" className="text-sm font-medium text-foreground">
                {t.clubLabel}
              </label>
              <input
                id="demo-club"
                value={club}
                onChange={(e) => {
                  clubFromSite.current = false;
                  setClub(e.target.value.slice(0, 60));
                }}
                placeholder={t.clubPlaceholder}
                autoComplete="organization"
                autoFocus={!initialClub}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="demo-site" className="text-sm font-medium text-foreground">
                {t.websiteLabel}
              </label>
              <div className="relative">
                <input
                  id="demo-site"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value.slice(0, 200))}
                  placeholder={t.websitePlaceholder}
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="demo-site-status"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                />
                {website && (
                  <button
                    type="button"
                    onClick={() => setWebsite("")}
                    aria-label={t.websiteClear}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              <p id="demo-site-status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {brandStatus === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {brandStatus === "found" && <Check className="h-3.5 w-3.5 text-brand-700" aria-hidden />}
                {brandStatus === "loading"
                  ? t.websiteLoading
                  : brandStatus === "found"
                    ? tFill(colour ? t.websiteFound : t.websiteLogoOnly, { host: brand?.host ?? site })
                    : brandStatus === "nologo"
                      ? tFill(t.websiteNoLogo, { host: brand?.host ?? site })
                      : brandStatus === "error"
                        ? t.websiteError
                        : brandStatus === "limited"
                          ? t.websiteLimited
                          : t.websiteHint}
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="demo-team" className="text-sm font-medium text-foreground">
                {t.teamLabel}
              </label>
              <input
                id="demo-team"
                value={team}
                onChange={(e) => setTeam(e.target.value.slice(0, 40))}
                placeholder={t.teamPlaceholder}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">{t.goalLabel}</legend>
              <div className="flex flex-wrap gap-2 pt-1">
                {DEMO_GOALS_KR.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={goalKr === g}
                    onClick={() => setGoalKr(g)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm tabular-nums transition-colors",
                      goalKr === g
                        ? "bg-brand-700 text-white"
                        : "bg-brand-50 text-brand-800 hover:bg-brand-100"
                    )}
                  >
                    {kr(g, locale)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="order-3 grid gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="hidden aspect-square items-center justify-center rounded-3xl bg-white p-4 ring-1 ring-[#E6DED2] sm:flex">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={t.qrTitle} className="h-full w-full" />
            ) : (
              <div className="h-full w-full animate-pulse rounded-2xl bg-[#F3EEE6]" />
            )}
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] p-6">
            <div>
              <h2 className="text-lg font-semibold text-[#5E5341]">{t.shareTitle}</h2>
              <p className="mt-1 text-sm text-[#7F715B]">
                <span className="hidden sm:inline">{t.qrBody} </span>
                {t.shareBody}
              </p>
            </div>
            <ShareActions
              url={shareUrl}
              text={tFill(t.shareText, { clubGen: genitive })}
              subject={tFill(t.emailSubject, { clubGen: genitive })}
              label={t.shareButton}
              labels={t}
              disabled={!hasClub || !shareUrl}
            />
          </div>
        </div>

        <div className="order-4 flex flex-col gap-4 rounded-3xl border border-dashed border-[#B9AC97] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t.realTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.realBody}</p>
          </div>
          <LocaleLink
            href={interestHref}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800 sm:self-auto"
          >
            {t.realButton}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LocaleLink>
        </div>

        <p className="order-5 text-xs text-muted-foreground">{t.note}</p>
      </div>

      <div className="order-2 py-2 lg:sticky lg:top-24 lg:self-start lg:py-0">
        <PhonePreview
          club={displayClub}
          team={teamName}
          goalKr={goalKr}
          raised={raised}
          pct={pct}
          products={products}
          locale={locale}
          t={t}
          muted={!hasClub}
          logo={brand?.logo ?? null}
          accent={accent}
          loading={brandStatus === "loading"}
        />
      </div>
    </div>
  );
}

function PhonePreview({
  club,
  team,
  goalKr,
  raised,
  pct,
  products,
  locale,
  t,
  muted,
  logo,
  accent,
  loading,
}: {
  club: string;
  team: string;
  goalKr: number;
  raised: number;
  pct: number;
  products: DemoProduct[];
  locale: "sv" | "en";
  t: (typeof demo)["sv"];
  muted: boolean;
  logo: string | null;
  accent: AccentTokens | null;
  loading: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="rounded-[44px] bg-[#2B2620] p-2.5 shadow-[0_40px_80px_-30px_rgba(43,38,32,0.55)]">
        <div className="relative overflow-hidden rounded-[36px] bg-[#FBF9F5]">
          <div className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-[#2B2620]" aria-hidden />
          <div
            className="bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] px-5 pb-6 pt-12 transition-[background] duration-700"
            style={
              accent
                ? { background: `linear-gradient(160deg, #F7F3EA 0%, ${accent.soft} 60%, ${accent.soft} 100%)` }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <RootsLogo variant="dark" className="h-5 w-[52px] opacity-80" />
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-medium text-[#6D614D]">
                roots.nu
              </span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div
                aria-hidden
                className={cn(
                  "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-semibold transition-[opacity,background-color] duration-500",
                  logo ? "h-[72px] w-[72px] bg-white p-1.5 shadow-sm ring-1 ring-black/5" : "h-14 w-14 bg-[#6D614D] text-white",
                  muted && !logo && "opacity-50",
                  loading && "animate-pulse"
                )}
                style={!logo && accent ? { backgroundColor: accent.solid, color: accent.onSolid } : undefined}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={logo.slice(-32)}
                    src={logo}
                    alt=""
                    className="animate-in fade-in zoom-in-90 h-full w-full object-contain duration-500"
                  />
                ) : (
                  initials(club)
                )}
              </div>
              <div className="min-w-0">
                <p
                  key={club}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 line-clamp-2 text-lg font-semibold leading-tight text-[#3F372B] duration-300",
                    muted && "text-[#9A8D78]"
                  )}
                >
                  {tFill(t.shopSupport, { club })}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#7F715B]">
                  {team ? tFill(t.shopSellerLine, { team }) : t.shopShareLine}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/80 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold tabular-nums text-[#3F372B]">
                  {tFill(t.shopRaised, { raised: kr(raised, locale) })}
                </p>
                <p className="text-[11px] tabular-nums text-[#7F715B]">
                  {tFill(t.shopGoal, { goal: kr(goalKr, locale) })}
                </p>
              </div>
              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#EFE8DD]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8B7E69_0%,#6D614D_100%)]"
                  style={{ width: `${pct}%`, ...(accent ? { background: accent.meter } : {}) }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-[#7F715B]">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t.shopMeterNote}
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 px-4 pb-6 pt-4">
            {products.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-[#EFE8DD]">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F3EEE6]">
                  <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#3F372B]">{p.name}</p>
                  <p className="text-xs tabular-nums text-[#7F715B]">{kr(p.priceSek, locale)}</p>
                </div>
                <span
                  className="rounded-full bg-[#6D614D] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-500"
                  style={accent ? { backgroundColor: accent.solid, color: accent.onSolid } : undefined}
                >
                  {t.shopBuy}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
