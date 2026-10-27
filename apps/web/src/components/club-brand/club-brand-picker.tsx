"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareLogo, signatureColours } from "@/lib/club-brand/logo";
import { clubThemeVars, type OrgBrand } from "@/lib/club-brand/theme";
import { isHexColour } from "@/lib/club-brand/colour";
import { clubBrand } from "@/i18n/dictionaries/club-brand";
import { useLocale } from "@/i18n/locale-context";
import { ClubMark } from "./club-mark";

/** Det som skickas till API:t som `brand`. `logo: undefined` = behåll sparad logga. */
export type BrandDraft = {
  color: string | null;
  colors: string[];
  logo: string | null | undefined;
  logoOnDark: boolean;
};

type Scraped = {
  name: string | null;
  color: string | null;
  colorSource: "club" | "theme" | null;
  logo: string | null;
};

type Status = "idle" | "loading" | "found" | "nothing" | "unreachable" | "invalid" | "limited";

export function looksLikeSite(raw: string): boolean {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(raw.trim());
}

export function draftFromBrand(brand: OrgBrand | null | undefined): BrandDraft | null {
  if (!brand) return null;
  return {
    color: brand.color,
    colors: brand.colors,
    logo: undefined,
    logoOnDark: brand.logoOnDark,
  };
}

/**
 * Läser föreningens webbplats när adressen ser rimlig ut och visar logga,
 * signaturfärger och en liten förhandsvisning. Användaren kan byta
 * huvudfärg, lägga till en egen eller ta bort loggan.
 */
export function ClubBrandPicker({
  website,
  clubName,
  value,
  onChange,
  saved,
  auto = true,
}: {
  website: string;
  clubName: string;
  value: BrandDraft | null;
  onChange: (next: BrandDraft | null) => void;
  /** Redan sparad profil (inställningar) — visas tills något nytt hämtas. */
  saved?: OrgBrand | null;
  /** Hämta automatiskt när adressen ändras. Av = bara via knappen. */
  auto?: boolean;
}) {
  const { locale } = useLocale();
  const t = clubBrand[locale];
  const [status, setStatus] = useState<Status>("idle");
  const [nonce, setNonce] = useState(0);
  const site = website.trim();
  const siteOk = looksLikeSite(site);

  useEffect(() => {
    if (!siteOk || (!auto && nonce === 0)) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/klubbprofil?webb=${encodeURIComponent(site)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { ok: boolean; brand?: Scraped; error?: string };
        if (controller.signal.aborted) return;
        if (!data.ok || !data.brand) {
          if (auto) onChange(null);
          setStatus(
            data.error === "limited" ? "limited" : data.error === "invalid" ? "invalid" : "unreachable"
          );
          return;
        }
        const found = data.brand;
        const logo = found.logo ? await prepareLogo(found.logo) : null;
        if (controller.signal.aborted) return;
        const colours = signatureColours(logo?.colours ?? [], {
          club: found.colorSource === "club" ? found.color : null,
          theme: found.colorSource === "theme" ? found.color : null,
        });
        if (!logo && colours.length === 0) {
          if (auto) onChange(null);
          setStatus("nothing");
          return;
        }
        setStatus(logo ? "found" : "nothing");
        onChange({
          color: colours[0] ?? null,
          colors: colours,
          logo: logo?.png ?? null,
          logoOnDark: logo?.onDark ?? false,
        });
      } catch {
        if (controller.signal.aborted) return;
        if (auto) onChange(null);
        setStatus("unreachable");
      }
    }, nonce > 0 ? 0 : 700);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
    // onChange är en setter från föräldern; bara adressen och knappen styr hämtningen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, siteOk, auto, nonce]);

  const logoSrc = value?.logo === undefined ? undefined : value?.logo;
  const showSavedLogo = value?.logo === undefined && Boolean(saved?.logoPath);
  const previewBrand: OrgBrand | null = value
    ? {
        color: value.color,
        colors: value.colors,
        logoPath: showSavedLogo ? (saved?.logoPath ?? null) : null,
        logoOnDark: value.logoOnDark,
        sourceUrl: null,
      }
    : null;
  const vars = clubThemeVars(previewBrand);
  const hasLogo = Boolean(logoSrc) || showSavedLogo;

  function setMain(hex: string) {
    const up = hex.toUpperCase();
    const base = value ?? { color: null, colors: [], logo: null, logoOnDark: false };
    const colors = base.colors.includes(up) ? base.colors : [up, ...base.colors].slice(0, 6);
    onChange({ ...base, color: up, colors });
  }

  if (!siteOk && !value) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {status === "loading" ? t.reading : value ? t.found : t.fetch}
        </p>
        {siteOk && (
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            disabled={status === "loading"}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {status === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {value ? t.fetchAgain : t.fetch}
          </button>
        )}
      </div>

      {(status === "nothing" || status === "unreachable" || status === "invalid" || status === "limited") && (
        <p className="text-xs text-muted-foreground">{t[status]}</p>
      )}

      {(value || status === "nothing" || status === "unreachable") && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {hasLogo ? (
              <ClubMark
                name={clubName || t.logo}
                src={logoSrc ?? null}
                brand={showSavedLogo ? previewBrand : null}
                onDark={value?.logoOnDark}
                className="h-14 w-14"
              />
            ) : (
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-[10px] text-muted-foreground">
                {t.noLogo}
              </span>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t.colours}</p>
            <div className="flex items-center gap-1.5">
              {(value?.colors ?? []).map((hex) => {
                const active = value?.color === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setMain(hex)}
                    aria-label={`${t.pickMain}: ${hex}`}
                    aria-pressed={active}
                    title={active ? t.mainColour : t.pickMain}
                    className={cn(
                      "relative h-7 w-7 rounded-full ring-1 ring-black/10",
                      active && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    {active && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white mix-blend-difference" />}
                  </button>
                );
              })}
              <label
                className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground"
                title={t.ownColour}
              >
                +
                <input
                  type="color"
                  aria-label={t.ownColour}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={isHexColour(value?.color) ? value!.color! : "#6D614D"}
                  onChange={(e) => setMain(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {value && isHexColour(value.color) && (
        <div style={vars} className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="club-stripe h-1" />
          <div className="club-soft flex items-center gap-3 p-3">
            <ClubMark
              name={clubName || "?"}
              src={logoSrc ?? null}
              brand={showSavedLogo ? previewBrand : null}
              onDark={value.logoOnDark}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="club-ink truncate text-xs font-semibold uppercase tracking-wide">
                {clubName || t.preview}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-100">
                <div className="club-meter h-full w-2/3 rounded-full" />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{t.previewGoal}</p>
            </div>
            <span className="rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-primary-foreground">
              {t.previewButton}
            </span>
          </div>
        </div>
      )}

      {value && (
        <div className="flex flex-wrap gap-3 text-xs">
          {hasLogo && (
            <button
              type="button"
              onClick={() => onChange({ ...value, logo: null, logoOnDark: false })}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t.removeLogo}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange({ color: null, colors: [], logo: null, logoOnDark: false })}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.reset}
          </button>
        </div>
      )}
    </div>
  );
}
