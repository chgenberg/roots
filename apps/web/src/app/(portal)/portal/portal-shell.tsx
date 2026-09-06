"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  broadcastLogout,
  useCrossTabLogout,
} from "@/lib/use-cross-tab-logout";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useIsDesktop } from "@/lib/use-media-query";
import { useDocumentTitle, titleFromNav } from "@/lib/use-document-title";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  MessageCircle,
  Target,
  Building2,
  FileText,
  Activity,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Calculator,
  Inbox,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalUserProvider,
  type PortalUser,
} from "@/lib/portal-context";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import NotificationBell from "@/components/notification-bell";
import { RootsLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { portal as portalDict } from "@/i18n/dictionaries/portal";
import { stripLocalePrefix } from "@/i18n/paths";
import type { Locale } from "@/i18n/config";

const API_URL = getBrowserApiBase();

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function buildClubNav(t: (typeof portalDict)[Locale]): NavItem[] {
  return [
    { href: "/portal", label: t.navOverview, icon: LayoutDashboard },
    { href: "/portal/bestallningar", label: t.navOrder, icon: ShoppingCart },
    { href: "/portal/fakturor", label: t.navInvoices, icon: FileText },
    { href: "/portal/medlemmar", label: t.navMembers, icon: Users },
    { href: "/portal/intakter", label: t.navRevenue, icon: BarChart3 },
    { href: "/portal/produkter", label: t.navProducts, icon: Package },
    { href: "/portal/ai", label: t.navAi, icon: MessageCircle },
    { href: "/portal/installningar", label: t.navSettings, icon: Settings },
  ];
}

function buildSalesNav(t: (typeof portalDict)[Locale]): NavItem[] {
  return [
    { href: "/portal", label: t.navOverview, icon: LayoutDashboard },
    { href: "/portal/pipeline", label: t.navPipeline, icon: Target },
    { href: "/portal/klubbar", label: t.navClubs, icon: Building2 },
    { href: "/portal/offerter", label: t.navQuotes, icon: FileText },
    { href: "/portal/raknesnurra", label: t.navCalculator, icon: Calculator },
    { href: "/portal/statistik", label: t.navStats, icon: BarChart3 },
    { href: "/portal/ai", label: t.navAi, icon: MessageCircle },
    { href: "/portal/installningar", label: t.navSettings, icon: Settings },
  ];
}

function buildAdminNav(t: (typeof portalDict)[Locale]): NavItem[] {
  return [
    { href: "/portal", label: t.navOverview, icon: LayoutDashboard },
    { href: "/portal/granskning", label: t.navReview, icon: ShieldAlert },
    { href: "/portal/feedback", label: t.navFeedback, icon: Inbox },
    { href: "/portal/utbetalningar", label: t.navPayouts, icon: FileText },
    { href: "/portal/klubbar", label: t.navAllClubs, icon: Building2 },
    { href: "/portal/saljare", label: t.navSellers, icon: Users },
    { href: "/portal/bestallningar", label: t.navOrders, icon: ShoppingCart },
    { href: "/portal/statistik", label: t.navKpiStats, icon: BarChart3 },
    { href: "/portal/system", label: t.navSystem, icon: Activity },
    { href: "/portal/agenten", label: t.navAgenten, icon: Network },
    { href: "/portal/audit-log", label: t.navAuditLog, icon: ShieldCheck },
    { href: "/portal/ai", label: t.navAi, icon: MessageCircle },
    { href: "/portal/installningar", label: t.navSettings, icon: Settings },
  ];
}

/**
 * När rollen kräver tvåfaktor men ingen app är registrerad svarar API:et 403
 * på i princip allt. Utan den här bannern hade sidorna bara sett trasiga ut,
 * och den enda ledtråden legat i ett felmeddelande långt ner i en lista.
 */
function MfaEnrollmentBanner() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = portalDict[locale];
  const bare = stripLocalePrefix(pathname || "/");
  if (bare === "/portal/installningar") return null;
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-edge bg-warning-surface p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
        <div>
          <p className="text-sm font-medium text-warning-strong">{t.mfaTitle}</p>
          <p className="text-sm text-muted-foreground">{t.mfaBody}</p>
        </div>
      </div>
      <LocaleLink
        href="/portal/installningar"
        className="rounded-lg bg-inverse-surface px-4 py-2 text-sm font-medium text-inverse-on-surface transition-opacity hover:opacity-90"
      >
        {t.mfaCta}
      </LocaleLink>
    </div>
  );
}

function getNavItems(role: string, t: (typeof portalDict)[Locale]): NavItem[] {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") return buildClubNav(t);
  if (role === "SALES_REP") {
    // Säljarens siffror ligger på Pipeline. /portal/statistik bygger på
    // orderintäkter som en säljare inte äger — API:et svarar 403 för rollen,
    // så länken ledde till en sida som aldrig kunde fyllas med data.
    return buildSalesNav(t).filter((i) => i.href !== "/portal/statistik");
  }
  if (role === "SALES_ADMIN") return buildSalesNav(t);
  return buildAdminNav(t);
}

function getRoleLabel(role: string, t: (typeof portalDict)[Locale]) {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") return t.roleClub;
  if (role === "SALES_REP" || role === "SALES_ADMIN") return t.roleSeller;
  return t.roleAdmin;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, href } = useLocale();
  const t = portalDict[locale];
  const c = appCommon[locale];
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const isDesktop = useIsDesktop();
  const sidebarRef = useFocusTrap(sidebarOpen && !isDesktop, closeSidebar);
  const barePath = stripLocalePrefix(pathname || "/");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    rootsFetch(`${API_URL}/v1/auth/me`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          router.replace(href("/login"));
        } else {
          setUser(data.user);
        }
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        router.replace(href("/login"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router, href]);

  async function handleLogout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    broadcastLogout();
    router.replace(href("/login"));
  }

  const onCrossTabLogout = useCallback(() => {
    setUser(null);
    router.replace(href("/login"));
  }, [router, href]);
  useCrossTabLogout(onCrossTabLogout);

  const navItems = useMemo(
    () => (user ? getNavItems(user.role, t) : []),
    [user, t]
  );
  const pageTitle = titleFromNav(pathname || "/", navItems, "Portal");
  useDocumentTitle(pageTitle);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-inverse-surface" />
      </div>
    );
  }

  if (!user) return null;

  const roleLabel = getRoleLabel(user.role, t);

  return (
    <PortalUserProvider user={user}>
      <div className="flex min-h-screen bg-brand-50/30">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          id="portal-sidebar"
          ref={sidebarRef as React.RefObject<HTMLElement>}
          inert={!sidebarOpen && !isDesktop}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b border-border px-4">
            <LocaleLink
              href="/"
              aria-label={c.homeAria}
              className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
            >
              <RootsLogo variant="auto" className="h-7 w-[70px]" />
            </LocaleLink>
            <div className="ml-auto flex items-center gap-1">
              <LocaleLink
                href="/hjalp"
                aria-label={c.help}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </LocaleLink>
              <LanguageSwitcher />
              <NotificationBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="ml-1 rounded-lg p-1 text-muted-foreground hover:text-foreground lg:hidden"
                aria-label={c.closeMenu}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label={c.mainMenu}>
            {navItems.map((item) => {
              const active =
                item.href === "/portal"
                  ? barePath === "/portal"
                  : barePath.startsWith(item.href);
              return (
                <LocaleLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 py-2 pl-3 pr-3 text-sm transition-colors",
                    active
                      ? "border-inverse-surface bg-brand-50 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-brand-50/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </LocaleLink>
              );
            })}
          </nav>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {roleLabel} · {user.orgName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground"
                aria-label={c.logout}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 min-h-16 items-center gap-4 border-b border-border bg-background px-6 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2.5 text-muted-foreground hover:text-foreground"
              aria-expanded={sidebarOpen}
              aria-controls="portal-sidebar"
              aria-label={c.openMenu}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold tracking-tight">
                {pageTitle}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t.subtitle}
              </p>
            </div>
            <LanguageSwitcher />
            <NotificationBell />
          </header>
          <main id="main-content" className="flex-1 p-6 md:p-8">
            {user.mfaEnrollmentRequired && <MfaEnrollmentBanner />}
            {children}
          </main>
        </div>
      </div>
    </PortalUserProvider>
  );
}
