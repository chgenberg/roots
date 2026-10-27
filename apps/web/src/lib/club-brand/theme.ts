/**
 * Föreningens färger ovanpå Roots bruna: CSS-variabler som `.club-*`-klasserna
 * i globals.css läser. Utan sparad profil faller allt tillbaka på Roots.
 */
import type { CSSProperties } from "react";
import { getBrowserApiBase } from "@/lib/api-base";
import { accentTokens, isHexColour } from "./colour";

/** Samma form som API:ts `OrgBrand`. */
export type OrgBrand = {
  color: string | null;
  colors: string[];
  logoPath: string | null;
  logoOnDark: boolean;
  sourceUrl: string | null;
};

export function clubThemeVars(brand: OrgBrand | null | undefined): CSSProperties | undefined {
  if (!brand || !isHexColour(brand.color)) return undefined;
  const a = accentTokens(brand.color);
  const second = brand.colors.find((c) => isHexColour(c) && c.toUpperCase() !== brand.color?.toUpperCase());
  return {
    "--club-solid": a.solid,
    "--club-on": a.onSolid,
    "--club-meter": a.meter,
    "--club-soft": a.tint,
    "--club-soft-dark": a.softDark,
    "--club-ink": a.ink,
    "--club-ink-dark": a.inkDark,
    "--club-second": second ?? a.solid,
  } as CSSProperties;
}

export function clubLogoSrc(brand: OrgBrand | null | undefined): string | null {
  return brand?.logoPath ? `${getBrowserApiBase()}${brand.logoPath}` : null;
}
