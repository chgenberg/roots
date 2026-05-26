"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight, User, CalendarCheck, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchDialog, SearchTrigger } from "@/components/search-dialog";
import { RootsLogo } from "@/components/brand";

const NAV_ITEMS = [
  { href: "/produkter", label: "Produkter" },
  { href: "/foreningsliv", label: "Föreningsliv" },
  { href: "/om-oss", label: "Om oss" },
];

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
// Keeping the logic simple — black logo + warm sand backdrop on the
// header at the top of every page — means the logotype is always
// visible from frame 1, with zero per-route special cases.

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

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Scroll progress */}
      <div className="fixed left-0 top-0 z-[60] h-[2px] w-full">
        <div
          className="h-full bg-foreground/20 transition-[width] duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <header
        className={cn(
          "fixed left-0 right-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          // Two surface states, both light:
          //  - scrolled   → translucent background backdrop + shadow
          //  - !scrolled  → warm sand backdrop (brand-50/70 + blur)
          // Both keep the BLACK logotype readable from frame 1.
          scrolled
            ? "h-14 border-b border-border/40 bg-background/90 shadow-[var(--shadow-card)] backdrop-blur-xl"
            : "h-20 bg-brand-50/70 backdrop-blur-xl"
        )}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center px-6 md:px-10">
          {/* Logo — Sprint E14: real brand logotype from the kit.
              Always uses the BLACK variant — the header has a light
              sand/cream backdrop on every page state, so a single
              variant is enough. */}
          <Link
            href="/"
            aria-label="Roots — startsida"
            className="relative z-[60] inline-flex items-center transition-opacity duration-200 hover:opacity-70"
          >
            <RootsLogo
              variant="black"
              priority
              className={cn(
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                scrolled ? "h-7 w-[70px] md:h-8 md:w-[80px]" : "h-8 w-[80px] md:h-9 md:w-[90px]"
              )}
            />
          </Link>

          {/* Spacer pushes nav + icons to the right */}
          <div className="flex-1" />

          {/* Desktop nav + icons — all grouped on the right */}
          <div className="hidden items-center gap-8 md:flex">
            <nav className="flex items-center gap-8">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative rounded-md px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span
                      className={cn(
                        "text-sm tracking-wide transition-colors duration-200",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 left-0 h-[1.5px] bg-foreground transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
                        active ? "w-full" : "w-0 group-hover:w-full"
                      )}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1">
              <SearchTrigger />
              <ThemeToggle />
              <Link
                href="/login"
                className="group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                className="group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Boka demo"
              >
                <CalendarCheck className="h-[18px] w-[18px] text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
              </Link>
            </div>
          </div>

          {/* Mobile burger */}
          {/* MASTERPLAN_01 KC6.1: 44x44 minimum touch-target (WCAG 2.5.5).
              Tidigare p-2 runt 24x20 burger gav ~40x36 — fail. */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative z-[60] -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
            aria-expanded={menuOpen}
          >
            <MorphingBurger open={menuOpen} />
          </button>
        </div>
      </header>

      {/* Spacer */}
      <div className={cn(
        "transition-all duration-500",
        scrolled ? "h-14" : "h-20"
      )} />

      {/* Fullscreen mobile overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigeringsmeny"
        className={cn(
          "fixed inset-0 z-[55] flex flex-col bg-background transition-opacity duration-200 ease-out md:hidden",
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
            Naturlig hudvård för föreningslivet
          </p>
        </div>
      </div>
    </>
  );
}
