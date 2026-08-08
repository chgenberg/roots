"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ArrowRight, User, CalendarCheck, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchTrigger } from "@/components/search-dialog";
import { AnnouncementBar } from "@/components/announcement-bar";
import { RootsLogo } from "@/components/brand";

const NAV_ITEMS = [
  { href: "/produkter", label: "Produkter" },
  { href: "/foreningsliv", label: "Föreningsliv" },
  { href: "/guider", label: "Guider" },
  { href: "/om-oss", label: "Om oss" },
];

// Logotypen sitter mitt i navigeringen, så länkarna delas jämnt på var
// sin sida om den. Läsordningen i DOM:en är oförändrad.
// "Så fungerar det" ligger i footer + /guider — behåller 2/2-balans här.
const NAV_LEFT = NAV_ITEMS.slice(0, 2);
const NAV_RIGHT = NAV_ITEMS.slice(2);

// Båda flytande grupperna delar yta: samma radie, kant, ljusgenomsläpp
// och skugga. Inre element är 40 px höga, plus 4 px padding = 48 px.
// bg-background/90 och inte /80: grupperna svävar över hero-bilder när
// sidan rullas, och vid lägre täckning tappar de dämpade länkarna
// kontrast mot en mörk bild bakom.
const PILL =
  "rounded-full border border-border/60 bg-background/90 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl";

function MorphingBurger({ open }: { open: boolean }) {
  return (
    <div className="relative h-5 w-6">
      <span
        className={cn(
          "absolute left-0 h-[1.5px] w-full bg-current transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
          open ? "top-[9px] rotate-45" : "top-[3px] rotate-0"
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[9px] h-[1.5px] bg-current transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
          open ? "w-full -rotate-45" : "w-4 rotate-0"
        )}
      />
      <span
        className={cn(
          "absolute left-0 h-[1.5px] w-full bg-current transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
          open ? "top-[9px] rotate-45 opacity-0" : "top-[15px] rotate-0 opacity-100"
        )}
      />
    </div>
  );
}

// E14 had a "dark hero routes" allow-list that flipped the header
// logo to white on pages assumed to lead with a dark hero photo.
// Removed in the next follow-up: the actual hero on / is cream/sand
// (woman in a beige top against a beige backdrop) and every other
// marketing route opens with bg-brand-50 sand sections, so the
// white-logo branch never had a surface dark enough to read against.
// Keeping the logic simple — black logo on a light, translucent
// surface on every page — means the logotype is always visible from
// frame 1, with zero per-route special cases.

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center whitespace-nowrap rounded-full px-3 text-sm tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand-50 text-foreground"
          : "text-muted-foreground hover:bg-brand-50/70 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docH > 0 ? window.scrollY / docH : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape, fokuslås och scroll-lås. Menyn hade tidigare bara scroll-låset,
  // så den som navigerar med tangentbord tabbade vidare ner i innehållet
  // bakom mörkläggningen utan väg tillbaka.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useFocusTrap(menuOpen, closeMenu);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Bandet fälls ihop vid rullning, och även när mobilmenyn är öppen —
  // annars ligger en rullande textremsa kvar över helskärmsmenyn.
  const bandHidden = scrolled || menuOpen;

  return (
    <>
      {/* Scroll progress — ligger över bandet, därav z-index ovanför
          hela den fasta stapeln. */}
      <div className="fixed left-0 top-0 z-[65] h-[2px] w-full">
        <div
          className="h-full bg-foreground/25 transition-[width] duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Ligger över mobilmenyn (z-55) så att logotypen och krysset syns
          medan menyn är öppen. Låg z-index här gjorde tidigare att
          overlayen målades ovanpå stängknappen. */}
      <div className="fixed left-0 right-0 top-0 z-[60]">
        {/* Rullande band. Det syns högst upp på sidan och fälls ihop så
            fort man börjar läsa, så att den flytande navigeringen får
            hela överkanten för sig själv. */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            bandHidden ? "max-h-0 opacity-0" : "max-h-9 opacity-100"
          )}
          // Ihopfällt band ska inte gå att tabba in i eller läsas upp.
          inert={bandHidden}
        >
          <AnnouncementBar />
        </div>

        <header
          className={cn(
            "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scrolled ? "py-2" : "py-3"
          )}
        >
          {/* Brytpunkten är lg, inte md: den centrerade grupp­en är 535 px
              bred och ikongruppen 176 px, så under ~1000 px skär de in i
              varandra. Surfplattor får därför samma logotyp + menyknapp
              som telefoner. */}
          <div className="relative mx-auto flex max-w-[1400px] items-center px-4 lg:px-8">
            {/* Mobil och surfplatta: logotypen ligger kvar till vänster. */}
            <Link
              href="/"
              aria-label="Roots — startsida"
              className={cn(
                PILL,
                // h-12 explicit så logotypgruppen blir exakt lika hög som
                // menyknappen till höger.
                "relative z-[60] flex h-12 items-center px-5 transition-opacity duration-200 hover:opacity-70 lg:hidden"
              )}
            >
              <RootsLogo variant="auto" priority className="h-7 w-[72px]" />
            </Link>

            {/* Centrerad navigering — absolut positionerad för äkta
                centrering oavsett hur bred ikongruppen till höger är. */}
            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
              <div className={cn(PILL, "flex items-center gap-1")}>
                {NAV_LEFT.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                  />
                ))}

                <Link
                  href="/"
                  aria-label="Roots — startsida"
                  className="mx-1 flex h-10 items-center rounded-full border border-border/50 px-4 transition-opacity duration-200 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RootsLogo variant="auto" priority className="h-6 w-[64px]" />
                </Link>

                {NAV_RIGHT.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </nav>

            {/* Ikoner till höger, i en egen flytande grupp */}
            <div className={cn(PILL, "ml-auto hidden items-center gap-0.5 lg:flex")}>
              <SearchTrigger />
              <ThemeToggle />
              <Link
                href="/login"
                className="group flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Logga in"
              >
                <User className="h-[18px] w-[18px] text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
              </Link>
              <Link
                // P3.72 (audit 2026-05-26): CalendarCheck-ikonen hade
                // aria-label "Boka demo" men pekade på /foreningsliv.
                // Användare med skärmläsare/keyboard fick fel mål.
                // Skicka till /kontakt där demo-bokningen sker.
                href="/kontakt?intent=demo"
                className="group flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Boka demo"
              >
                <CalendarCheck className="h-[18px] w-[18px] text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
              </Link>
            </div>

            {/* Mobile burger */}
            {/* MASTERPLAN_01 KC6.1: 44x44 minimum touch-target (WCAG 2.5.5).
                Tidigare p-2 runt 24x20 burger gav ~40x36 — fail. */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                PILL,
                "relative z-[60] ml-auto inline-flex h-12 w-12 items-center justify-center lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
              aria-expanded={menuOpen}
            >
              <MorphingBurger open={menuOpen} />
            </button>
          </div>
        </header>
      </div>

      {/* Spacer — band (36) + luft (2×12) + grupphöjd (48) = 108,
          och utan band 2×8 + 48 = 64 när sidan har rullats. */}
      <div className={cn(
        "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        scrolled ? "h-16" : "h-[108px]"
      )} />

      {/* Fullscreen mobile overlay */}
      <div
        ref={menuRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-label="Navigeringsmeny"
        // Panelen ligger kvar i DOM:en för att övergången ska fungera. Utan
        // `inert` är länkarna kvar i tab-ordningen även när menyn är stängd,
        // så Tab landar i osynliga länkar mitt på en vanlig sida — opacity
        // tar inte bort något ur fokusordningen. `inert` gör det, och till
        // skillnad från visibility:hidden stör det inte inledningen.
        inert={!menuOpen}
        className={cn(
          "fixed inset-0 z-[55] flex flex-col bg-background transition-opacity duration-200 ease-out lg:hidden",
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <nav className="flex flex-1 flex-col items-start justify-center px-10">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="group relative rounded-md py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "text-4xl font-light tracking-tight transition-colors duration-200",
                  isActive(item.href)
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "absolute -bottom-0 left-0 h-[1px] bg-foreground transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
                  isActive(item.href) ? "w-full" : "w-0 group-hover:w-full"
                )}
              />
            </Link>
          ))}

          <div className="mt-12 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("roots:open-search")); }}
              className="flex items-center gap-2 rounded-md text-lg font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
              Sök
            </button>
            <Link
              href="/kontakt?intent=demo"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-md text-lg font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Boka demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Logga in →
            </Link>
            {/* P3.73 (audit 2026-05-26): mobile menu saknade Hjälp;
                desktop sidebar har det redan. Telefon-användare ska
                inte behöva kunna URL:en utantill. */}
            <Link
              href="/hjalp"
              onClick={() => setMenuOpen(false)}
              className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Hjälp & FAQ
            </Link>
            <div className="mt-2">
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* Bottom line */}
        <div className="px-10 pb-10">
          <div
            className={cn(
              "h-[1px] w-full bg-border transition-opacity duration-200 ease-out",
              menuOpen ? "opacity-100" : "opacity-0"
            )}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Naturlig hårvård för föreningslivet
          </p>
        </div>
      </div>
    </>
  );
}
