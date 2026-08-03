"use client";

import { useEffect, useState } from "react";

/**
 * Läser en CSS-mediefråga från JavaScript.
 *
 * Behövs för de sidebars som är utfällbara på mobil men permanent synliga
 * på desktop. Där räcker inte Tailwinds `lg:`-varianter, eftersom det som
 * ska ändras är `inert` — ett attribut, inte en klass. Utan det blir en
 * synlig sidebar på desktop otillgänglig, eller en osynlig sidebar på mobil
 * fokuserbar. Läget måste alltså vara känt i JavaScript.
 *
 * Startvärdet är false så att server- och klientrendering matchar; rätt
 * värde sätts i den första effekten.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwinds `lg`-brytpunkt, samma 1024px som klasserna använder. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
