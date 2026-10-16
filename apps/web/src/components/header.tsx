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
  { href: "/sa-har-gar-det-till", key: "howItWorks" as const },
  { href: "/guider", key: "guides" as const },
  { href: "/om-oss", key: "about" as const },
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
        "font-display flex h-10 items-center whitespace-nowrap rounded-full px-3 text-sm font-normal tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "font-medium text-foreground underline decoration-1 underline-offset-[6px]"
          : "text-muted-foreground hover:text-foreground"
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

  // usePathname, not window.location: on a soft navigation the header
  // re-renders before the browser URL changes, so window.location is stale.
  const barePath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
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
            "border-b transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scrolled
              ? "border-border/60 bg-background/95 py-2 backdrop-blur-xl"
              : "border-border/40 bg-background py-3"
          )}
        >
          <div className="relative mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 md:px-6 xl:px-8">
            <div className="flex items-center gap-8">
              <LocaleLink
                href="/"
                aria-label={t.aria.home}
                className="relative z-[60] flex h-12 items-center px-1 transition-opacity duration-200 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RootsLogo variant="auto" priority className="h-7 w-[72px]" />
              </LocaleLink>

              <nav className="hidden items-center gap-1 xl:flex">
                {NAV_HREFS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={t.nav[item.key]}
                    active={isActive(item.href)}
                  />
                ))}
              </nav>
            </div>

            <div className="hidden items-center gap-1 xl:flex">
              <LocaleLink
                href="/sa-fungerar-det#rakna"
                aria-label={t.aria.calcCta}
                className="mr-2 flex h-10 items-center whitespace-nowrap rounded-full border border-foreground/25 px-5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.calcCta}
              </LocaleLink>
              <LocaleLink
                href="/intresseanmalan"
                aria-current={isActive("/intresseanmalan") ? "page" : undefined}
                className="mr-2 flex h-10 items-center whitespace-nowrap rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.sellCta}
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
              <LanguageSwitcher />
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          "fixed inset-0 z-[55] flex flex-col overflow-y-auto overscroll-contain bg-background pt-20 transition-opacity duration-200 ease-out xl:hidden",
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        {/* my-auto, not justify-center: centring with justify-center pushes the first link under the header when the menu is taller than the screen. */}
        <nav className="my-auto flex flex-col items-start px-10 py-6">
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
                    : "text-foreground/55 group-hover:text-foreground"
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
              href="/intresseanmalan"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.sellCta}
              <ArrowRight className="h-4 w-4" />
            </LocaleLink>
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
