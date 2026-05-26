"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  broadcastLogout,
  useCrossTabLogout,
} from "@/lib/use-cross-tab-logout";
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
  HelpCircle,
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
  { href: "/portal/statistik", label: "Statistik", icon: BarChart3 },
  { href: "/portal/ai", label: "AI-assistent", icon: MessageCircle },
  { href: "/portal/installningar", label: "Inställningar", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/portal", label: "Översikt", icon: LayoutDashboard },
  { href: "/portal/klubbar", label: "Alla klubbar", icon: Building2 },
  { href: "/portal/saljare", label: "Säljare", icon: Users },
  { href: "/portal/bestallningar", label: "Beställningar", icon: ShoppingCart },
  { href: "/portal/statistik", label: "KPI & Statistik", icon: BarChart3 },
  { href: "/portal/system", label: "System", icon: Activity },
  { href: "/portal/audit-log", label: "Audit-log", icon: ShieldCheck },
  { href: "/portal/ai", label: "AI-assistent", icon: MessageCircle },
  { href: "/portal/installningar", label: "Inställningar", icon: Settings },
];

function getNavItems(role: string): NavItem[] {
  if (role === "CLUB_ADMIN" || role === "CLUB_MEMBER") return CLUB_NAV;
  if (role === "SALES_REP" || role === "SALES_ADMIN") return SALES_NAV;
  return ADMIN_NAV;
}

function getPageTitle(pathname: string, items: NavItem[]): string {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const prefix = items
    .filter((i) => i.href !== "/portal" && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.label ?? "Portal";
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-inverse-surface" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = getNavItems(user.role);
  const roleLabel = getRoleLabel(user.role);
  const pageTitle = getPageTitle(pathname, navItems);

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
              <RootsLogo variant="black" className="h-7 w-[70px]" />
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

        <div className="flex flex-1 flex-col">
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
            {children}
          </main>
        </div>
      </div>
    </PortalUserProvider>
  );
}
