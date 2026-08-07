"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  broadcastLogout,
  useCrossTabLogout,
} from "@/lib/use-cross-tab-logout";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useIsDesktop } from "@/lib/use-media-query";
import { useDocumentTitle, titleFromNav } from "@/lib/use-document-title";
import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalUserProvider,
  type PortalUser,
} from "@/lib/portal-context";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/notification-bell";
import { RootsLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const API_URL = getBrowserApiBase();

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const CLUB_NAV: NavItem[] = [
  { href: "/portal", label: "Översikt", icon: LayoutDashboard },
  { href: "/portal/bestallningar", label: "Beställ", icon: ShoppingCart },
  { href: "/portal/fakturor", label: "Fakturor", icon: FileText },
  { href: "/portal/medlemmar", label: "Medlemmar", icon: Users },
  { href: "/portal/intakter", label: "Intäkter", icon: BarChart3 },
  { href: "/portal/produkter", label: "Produkter", icon: Package },
  { href: "/portal/ai", label: "AI-assistent", icon: MessageCircle },
  { href: "/portal/installningar", label: "Inställningar", icon: Settings },
];

const SALES_NAV: NavItem[] = [
  { href: "/portal", label: "Översikt", icon: LayoutDashboard },
  { href: "/portal/pipeline", label: "Pipeline", icon: Target },
  { href: "/portal/klubbar", label: "Klubbar", icon: Building2 },
  { href: "/portal/offerter", label: "Offerter", icon: FileText },
  { href: "/portal/raknesnurra", label: "Räknesnurra", icon: Calculator },
  { href: "/portal/statistik", label: "Statistik", icon: BarChart3 },
  { href: "/portal/ai", label: "AI-assistent", icon: MessageCircle },
  { href: "/portal/installningar", label: "Inställningar", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/portal", label: "Översikt", icon: LayoutDashboard },
  { href: "/portal/granskning", label: "Granskning", icon: ShieldAlert },
  { href: "/portal/klubbar", label: "Alla klubbar", icon: Building2 },
  { href: "/portal/saljare", label: "Säljare", icon: Users },
  { href: "/portal/bestallningar", label: "Beställningar", icon: ShoppingCart },
  { href: "/portal/statistik", label: "KPI & Statistik", icon: BarChart3 },
  { href: "/portal/system", label: "System", icon: Activity },
  { href: "/portal/audit-log", label: "Audit-log", icon: ShieldCheck },
  { href: "/portal/ai", label: "AI-assistent", icon: MessageCircle },
  { href: "/portal/installningar", label: "Inställningar", icon: Settings },
];

/**
 * När rollen kräver tvåfaktor men ingen app är registrerad svarar API:et 403
 * på i princip allt. Utan den här bannern hade sidorna bara sett trasiga ut,
 * och den enda ledtråden legat i ett felmeddelande långt ner i en lista.
 */
function MfaEnrollmentBanner() {
  const pathname = usePathname();
  if (pathname === "/portal/installningar") return null;
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-edge bg-warning-surface p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
        <div>
          <p className="text-sm font-medium text-warning-strong">
            Aktivera tvåfaktor för att fortsätta
          </p>
          <p className="text-sm text-muted-foreground">
            Din roll ser data för alla föreningar. Portalen är låst tills du
            registrerat en autentiseringsapp.
          </p>
        </div>
      </div>
      <Link
        href="/portal/installningar"
        className="rounded-lg bg-inverse-surface px-4 py-2 text-sm font-medium text-inverse-on-surface transition-opacity hover:opacity-90"
      >
        Till inställningar
      </Link>
    </div>
  );
}

function getNavItems(role: string): NavItem[] {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") return CLUB_NAV;
  if (role === "SALES_REP") {
    // Säljarens siffror ligger på Pipeline. /portal/statistik bygger på
    // orderintäkter som en säljare inte äger — API:et svarar 403 för rollen,
    // så länken ledde till en sida som aldrig kunde fyllas med data.
    return SALES_NAV.filter((i) => i.href !== "/portal/statistik");
  }
  if (role === "SALES_ADMIN") return SALES_NAV;
  return ADMIN_NAV;
}

function getPageTitle(pathname: string, items: NavItem[]): string {
  // Delad med fundraising-layouten — de hade varsin kopia av samma logik.
  return titleFromNav(pathname, items, "Portal");
}

function getRoleLabel(role: string) {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") return "Förening";
  if (role === "SALES_REP" || role === "SALES_ADMIN") return "Säljare";
  return "Admin";
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Escape fanns redan, men inte fokuslåset: menyn öppnades och fokus låg
  // kvar i innehållet bakom mörkläggningen. Hooken lägger till fokuslås och
  // scroll-lås och behåller Escape.
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  // Fokuslåset ska bara gälla när sidebaren är en utfälld panel. På desktop
  // är den en permanent del av sidan och ska inte fånga fokus.
  const isDesktop = useIsDesktop();
  const sidebarRef = useFocusTrap(sidebarOpen && !isDesktop, closeSidebar);

  useEffect(() => {
    // P2.27 (audit 2026-05-26): tidigare saknades cancel-guard på
    // bootstrap-fetch:en — om användaren navigerade snabbt vidare
    // hann svaret komma efter unmount och triggade både setUser och
    // router.replace på en avmontad komponent. AbortController +
    // cancelled-flag stoppar både fetch och setState.
    let cancelled = false;
    const controller = new AbortController();

    fetch(`${API_URL}/v1/auth/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          router.replace("/login");
        } else {
          setUser(data.user);
        }
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router]);

  async function handleLogout() {
    // apiFetch attaches CSRF + cookies; production rejects un-tokened
    // POSTs with 403 which previously left users logged in.
    await apiFetch("/v1/auth/logout", { method: "POST" });
    // MASTERPLAN_01 KC2.5: trigga andra tabs INNAN router.replace så
    // de hinner navigera bort innan en /me-poll därinne får 401:s
    // tomma user-obj och stör state-machine.
    broadcastLogout();
    router.replace("/login");
  }

  // MASTERPLAN_01 KC2.5: lyssna på cross-tab logout-event och redirecta
  // utan att själv kalla logout-endpointen (sessionen är redan död).
  const onCrossTabLogout = useCallback(() => {
    setUser(null);
    router.replace("/login");
  }, [router]);
  useCrossTabLogout(onCrossTabLogout);

  // Räknas ut före de tidiga returerna nedan, eftersom hooken måste anropas
  // på varje rendering. Under laddning ger getPageTitle "Portal", vilket är
  // en riktigare fliktitel än root-defaulten ändå.
  const navItems = user ? getNavItems(user.role) : [];
  const pageTitle = getPageTitle(pathname, navItems);
  useDocumentTitle(pageTitle);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-inverse-surface" />
      </div>
    );
  }

  if (!user) return null;

  const roleLabel = getRoleLabel(user.role);

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
          // Utfälld på mobil, permanent på desktop. När den är utanför
          // skärmen ligger länkarna kvar i tab-ordningen — translate flyttar
          // dem bara visuellt — så en mobilanvändare tabbar genom en meny
          // hen inte ser. `inert` tar dem ur ordningen, men bara i det läget
          // där sidebaren faktiskt är dold.
          inert={!sidebarOpen && !isDesktop}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b border-border px-4">
            <Link
              href="/"
              aria-label="Roots — startsida"
              className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
            >
              <RootsLogo variant="auto" className="h-7 w-[70px]" />
            </Link>
            {/* Sprint E11: header gets help-link + notification bell so
                every portal page surfaces them consistently. Mobile-close
                button sits to the right of the bell, only on lg:hidden. */}
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/hjalp"
                aria-label="Hjälp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </Link>
              <NotificationBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="ml-1 rounded-lg p-1 text-muted-foreground hover:text-foreground lg:hidden"
                aria-label="Stäng meny"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {navItems.map((item) => {
              const active =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(item.href);
              return (
                <Link
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
                </Link>
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
                aria-label="Logga ut"
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
              aria-label="Öppna meny"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold tracking-tight">{pageTitle}</p>
              <p className="truncate text-xs text-muted-foreground">Roots portal</p>
            </div>
            <NotificationBell />
          </header>
          {/* P2.56 (audit 2026-05-26): id="main-content" så att den
              globala skip-link:en i root layout.tsx kan hoppa hit. */}
          <main id="main-content" className="flex-1 p-6 md:p-8">
            {user.mfaEnrollmentRequired && <MfaEnrollmentBanner />}
            {children}
          </main>
        </div>
      </div>
    </PortalUserProvider>
  );
}
