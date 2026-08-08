"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  broadcastLogout,
  useCrossTabLogout,
} from "@/lib/use-cross-tab-logout";
import {
  BarChart3,
  LineChart,
  Users,
  Target,
  CreditCard,
  ShoppingBag,
  ClipboardList,
  MessageCircle,
  CalendarDays,
  Menu,
  X,
  LogOut,
  Settings,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getBrowserApiBase } from "@/lib/api-base";
import { apiFetch, rootsFetch } from "@/lib/api";
import NotificationBell from "@/components/notification-bell";
import { RootsLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleLink } from "@/components/locale-link";
import { LocaleProvider, useLocale } from "@/i18n/locale-context";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { fundraising as fundraisingDict } from "@/i18n/dictionaries/fundraising";
import { stripLocalePrefix } from "@/i18n/paths";
import type { Locale } from "@/i18n/config";
import {
  useDocumentTitle,
  titleFromNav,
} from "@/lib/use-document-title";

const API_URL = getBrowserApiBase();

interface FundraisingUser {
  email: string;
  role: string;
  name: string;
  orgName: string;
  orgId?: string;
  userId?: string;
}

function buildNavItems(role: string, t: (typeof fundraisingDict)[Locale]) {
  if (role === "ASSOCIATION_ADMIN") {
    return [
      { href: "/forening", label: t.navOverview, icon: BarChart3 },
      { href: "/forening/statistik", label: t.navStats, icon: LineChart },
      { href: "/forening/kom-igang", label: t.navGetStarted, icon: Sparkles },
      { href: "/forening/lag", label: t.navTeams, icon: Users },
      { href: "/forening/mal", label: t.navGoals, icon: Target },
      { href: "/forening/kalender", label: t.navCalendar, icon: CalendarDays },
      { href: "/forening/avrakning", label: t.navSettlement, icon: CreditCard },
      { href: "/installningar", label: t.navSettings, icon: Settings },
    ];
  }
  if (role === "TEAM_LEADER") {
    return [
      { href: "/lag", label: t.navOverview, icon: BarChart3 },
      { href: "/lag/statistik", label: t.navStats, icon: LineChart },
      { href: "/lag/saljare", label: t.navSellers, icon: Users },
      { href: "/lag/bestallningar", label: t.navOrders, icon: ClipboardList },
      { href: "/lag/chatt", label: t.navChat, icon: MessageCircle },
      { href: "/lag/avrakning", label: t.navSettlement, icon: CreditCard },
      { href: "/installningar", label: t.navSettings, icon: Settings },
    ];
  }
  return [
    { href: "/min-shop", label: t.navMyShop, icon: ShoppingBag },
    { href: "/min-shop/statistik", label: t.navStats, icon: LineChart },
    {
      href: "/min-shop/bestallningar",
      label: t.navOrders,
      icon: ClipboardList,
    },
    { href: "/min-shop/chatt", label: t.navTeamChat, icon: MessageCircle },
    { href: "/installningar", label: t.navSettings, icon: Settings },
  ];
}

function FundraisingShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, href } = useLocale();
  const t = fundraisingDict[locale];
  const c = appCommon[locale];
  const [user, setUser] = useState<FundraisingUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const barePath = stripLocalePrefix(pathname || "/");

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    async function load() {
      try {
        const res = await rootsFetch(`${API_URL}/v1/auth/me`);
        if (!res.ok) {
          router.push(href("/login"));
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.push(href("/login"));
          return;
        }
        setUser(data.user);
      } catch {
        router.push(href("/login"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, href]);

  async function handleLogout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    broadcastLogout();
    router.push(href("/login"));
  }

  const onCrossTabLogout = useCallback(() => {
    setUser(null);
    router.push(href("/login"));
  }, [router, href]);
  useCrossTabLogout(onCrossTabLogout);

  const navItems = useMemo(
    () => (user ? buildNavItems(user.role, t) : []),
    [user, t]
  );
  useDocumentTitle(titleFromNav(pathname || "/", navItems, "Roots"));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
      </div>
    );
  }

  if (!user) return null;

  const isAssociation = user.role === "ASSOCIATION_ADMIN";
  const isTeamLeader = user.role === "TEAM_LEADER";

  const roleBadge = isAssociation
    ? { label: t.roleAssociation, className: "bg-brand-100 text-brand-700" }
    : isTeamLeader
      ? { label: t.roleTeamLeader, className: "bg-brand-100 text-brand-700" }
      : { label: t.roleSeller, className: "bg-brand-50 text-brand-600" };

  const initials =
    (user.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <LocaleLink
            href="/"
            aria-label={c.homeAria}
            className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
          >
            <RootsLogo variant="auto" className="h-7 w-[70px]" />
          </LocaleLink>
          <Badge className={`text-xs ${roleBadge.className}`}>
            {roleBadge.label}
          </Badge>
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
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={c.mainMenu}>
          {navItems.map((item) => {
            const active = barePath === item.href;
            return (
              <LocaleLink
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-brand-100 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-brand-50 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </LocaleLink>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={user.name}>
                {user.name}
              </p>
              <p
                className="truncate text-xs text-muted-foreground"
                title={user.email}
              >
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {c.logout}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 lg:hidden">
          <LocaleLink
            href="/"
            aria-label={c.homeAria}
            className="inline-flex items-center transition-opacity duration-200 hover:opacity-70"
          >
            <RootsLogo variant="auto" className="h-6 w-[60px]" />
          </LocaleLink>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <NotificationBell />
            <ThemeToggle />
            <button
              ref={menuButtonRef}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? c.closeMenu : c.openMenu}
              aria-expanded={mobileOpen}
              aria-controls="fundraising-mobile-nav"
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-50 hover:text-foreground"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <nav
            id="fundraising-mobile-nav"
            aria-label={c.mainMenu}
            className="space-y-1 border-b bg-background p-3 lg:hidden"
          >
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-brand-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <Badge className={`text-xs ${roleBadge.className}`}>
                {roleBadge.label}
              </Badge>
            </div>
            {navItems.map((item) => {
              const active = barePath === item.href;
              return (
                <LocaleLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-brand-100 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-brand-50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </LocaleLink>
              );
            })}
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              {c.logout}
            </button>
          </nav>
        )}

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function FundraisingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <FundraisingShell>{children}</FundraisingShell>
    </LocaleProvider>
  );
}
