"use client";

import { useEffect } from "react";

/**
 * Sätter fliktiteln på klientrenderade sidor.
 *
 * Portalen och fundraising-vyerna består av 34 sidor som alla är
 * "use client". En sådan sida kan inte exportera `metadata`, så samtliga
 * ärvde root-titeln "Roots — Föreningsnära hudvård". Med tre flikar öppna
 * — beställningar, avräkning, statistik — såg de identiska ut, och den som
 * använder skärmläsare fick samma sidtitel uppläst vid varje navigering.
 *
 * Titeln sätts från layouten och inte från varje sida, eftersom layouten
 * redan räknar ut rubriken från navigationen (getPageTitle). Ett anrop i
 * layouten täcker alla sidor och kan inte glömmas bort när någon lägger
 * till en ny.
 */
/**
 * Rubriken för den aktuella sidan, given navigationen.
 *
 * Exakt matchning först, annars längsta prefixet — så att
 * /lag/bestallningar/nagot ärver "Beställningar" i stället för att falla
 * tillbaka på översikten. Delas av portal- och fundraising-layouten; de
 * hade annars fått varsin kopia som glider ifrån varandra.
 */
export function titleFromNav(
  pathname: string,
  items: { href: string; label: string }[],
  fallback: string
): string {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const prefix = items
    // Rot-href:en (t.ex. "/lag") är ett prefix till allting under sig och
    // hade annars alltid vunnit. Den fångas av exakt-matchningen ovan.
    .filter((i) => i.href !== pathname && pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.label ?? fallback;
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} — Roots`;
    // Återställer vid unmount så att en navigering ut ur portalen inte
    // lämnar kvar en titel som inte hör till sidan man landar på.
    return () => {
      document.title = previous;
    };
  }, [title]);
}
