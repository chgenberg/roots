"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ArrowRight, User, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchTrigger } from "@/components/search-dialog";
import { AnnouncementBar } from "@/components/announcement-bar";
import { RootsLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";

const NAV_HREFS = [
  { href: "/produkter", key: "products" as const },
  { href: "/foreningsliv", key: "clubLife" as const },
  { href: "/guider", key: "guides" as const },
  { href: "/om-oss", key: "about" as const },
];

const NAV_LEFT = NAV_HREFS.slice(0, 2);
const NAV_RIGHT = NAV_HREFS.slice(2);

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
    <LocaleLink
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center whitespace-nowrap rounded-full px-3 text-sm tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand-200 font-medium text-foreground"
          : "text-muted-foreground hover:bg-brand-50 hover:text-foreground"
      )}
    >
      {label}
    </LocaleLink>
  );
}

export function Header() {
  const pathname = usePathname();
  const { t, locale } = useLocale();
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
    document.documentElement.lang = locale;
  }, [locale]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useFocusTrap(menuOpen, closeMenu);

  // Prefer browser URL: middleware rewrite can strip `/en` from usePathname.
  const asPath =
    typeof window !== "undefined"
      ? window.location.pathname
      : pathname || "/";
  const barePath = asPath.replace(/^\/en(?=\/|$)/, "") || "/";
  const isActive = (href: string) =>
    barePath === href || barePath.startsWith(href + "/");

  const bandHidden = scrolled || menuOpen;

  return (
    <>
      <div className="fixed left-0 top-0 z-[65] h-[2px] w-full">
        <div
          className="h-full bg-foreground/25 transition-[width] duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <div className="fixed left-0 right-0 top-0 z-[60]">
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            bandHidden ? "max-h-0 opacity-0" : "max-h-9 opacity-100"
          )}
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
          <div className="relative mx-auto flex max-w-[1400px] items-center px-4 lg:px-8">
            <LocaleLink
              href="/"
              aria-label={t.aria.home}
              className="relative z-[60] flex h-12 items-center px-1 transition-opacity duration-200 hover:opacity-70 lg:hidden"
            >
              <RootsLogo variant="auto" priority className="h-7 w-[72px]" />
            </LocaleLink>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
              <div className={cn(PILL, "flex items-center gap-1")}>
                {NAV_LEFT.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={t.nav[item.key]}
                    active={isActive(item.href)}
                  />
                ))}

                <LocaleLink
                  href="/"
                  aria-label={t.aria.home}
                  className="mx-1 flex h-10 items-center px-2 transition-opacity duration-200 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RootsLogo variant="auto" priority className="h-6 w-[64px]" />
                </LocaleLink>

                {NAV_RIGHT.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={t.nav[item.key]}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </nav>

            <div className={cn(PILL, "ml-auto hidden items-center gap-0.5 lg:flex")}>
              <LocaleLink
                href="/sa-fungerar-det#rakna"
                aria-label={t.aria.calcCta}
                className="flex h-10 items-center whitespace-nowrap rounded-full bg-brand-700 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.calcCta}
              </LocaleLink>
              <SearchTrigger />
              <ThemeToggle />
              <Link
                href="/login"
                className="group flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t.aria.login}
              >
                <User className="h-[18px] w-[18px] text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
              </Link>
              <LocaleLink
                href="/kontakt?intent=demo"
                className="flex h-10 items-center whitespace-nowrap rounded-full px-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.contactCta}
              </LocaleLink>
              <LanguageSwitcher />
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                PILL,
                "relative z-[60] ml-auto inline-flex h-12 w-12 items-center justify-center lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={menuOpen ? t.aria.closeMenu : t.aria.openMenu}
              aria-expanded={menuOpen}
            >
              <MorphingBurger open={menuOpen} />
            </button>
          </div>
        </header>
      </div>

      <div
        className={cn(
          "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled ? "h-16" : "h-[108px]"
        )}
      />

      <div
        ref={menuRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-label={t.aria.navMenu}
        inert={!menuOpen}
        className={cn(
          "fixed inset-0 z-[55] flex flex-col bg-background transition-opacity duration-200 ease-out lg:hidden",
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <nav className="flex flex-1 flex-col items-start justify-center px-10">
          {NAV_HREFS.map((item) => (
            <LocaleLink
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
                {t.nav[item.key]}
              </span>
              <span
                className={cn(
                  "absolute -bottom-0 left-0 h-[1px] bg-foreground transition-all duration-200 ease-[cubic-bezier(0.77,0,0.18,1)]",
                  isActive(item.href) ? "w-full" : "w-0 group-hover:w-full"
                )}
              />
            </LocaleLink>
          ))}

          <div className="mt-12 flex flex-col gap-4">
            <LocaleLink
              href="/sa-fungerar-det#rakna"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-md text-lg font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.calcCta}
              <ArrowRight className="h-4 w-4" />
            </LocaleLink>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                window.dispatchEvent(new CustomEvent("roots:open-search"));
              }}
              className="flex items-center gap-2 rounded-md text-lg font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
              {t.mobileMenu.search}
            </button>
            <LocaleLink
              href="/kontakt?intent=demo"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-md text-lg font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.mobileMenu.bookDemo}
              <ArrowRight className="h-4 w-4" />
            </LocaleLink>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.mobileMenu.login}
            </Link>
            <LocaleLink
              href="/hjalp"
              onClick={() => setMenuOpen(false)}
              className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.mobileMenu.help}
            </LocaleLink>
            <div className="mt-2 flex items-center gap-3">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </nav>

        <div className="px-10 pb-10">
          <div
            className={cn(
              "h-[1px] w-full bg-border transition-opacity duration-200 ease-out",
              menuOpen ? "opacity-100" : "opacity-0"
            )}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {t.mobileMenu.tagline}
          </p>
        </div>
      </div>
    </>
  );
}
