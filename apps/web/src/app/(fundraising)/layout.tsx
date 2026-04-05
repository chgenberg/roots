"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Target,
  CreditCard,
  ShoppingBag,
  ClipboardList,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FundraisingUser {
  email: string;
  role: string;
  name: string;
  orgName: string;
  orgId?: string;
  userId?: string;
}

export default function FundraisingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<FundraisingUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.push("/login");
          return;
        }
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
      </div>
    );
  }

  const isAssociation = user?.role === "ASSOCIATION_ADMIN";
  const isTeamLeader = user?.role === "TEAM_LEADER";

  const navItems = isAssociation
    ? [
        { href: "/forening", label: "Översikt", icon: BarChart3 },
        { href: "/forening/lag", label: "Lag", icon: Users },
        { href: "/forening/mal", label: "Mål", icon: Target },
        { href: "/forening/avrakning", label: "Avräkning", icon: CreditCard },
      ]
    : isTeamLeader
    ? [
        { href: "/lag", label: "Översikt", icon: BarChart3 },
        { href: "/lag/saljare", label: "Säljare", icon: Users },
        { href: "/lag/bestallningar", label: "Beställningar", icon: ClipboardList },
        { href: "/lag/avrakning", label: "Avräkning", icon: CreditCard },
      ]
    : [
        { href: "/min-shop", label: "Min shop", icon: ShoppingBag },
      ];

  const roleBadge = isAssociation
    ? { label: "Förening", className: "bg-brand-100 text-brand-700" }
    : isTeamLeader
    ? { label: "Lagansvarig", className: "bg-brand-100 text-brand-700" }
    : { label: "Säljare", className: "bg-brand-50 text-brand-600" };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Roots
          </Link>
          <Badge className={`ml-auto text-xs ${roleBadge.className}`}>
            {roleBadge.label}
          </Badge>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
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
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            {user?.name}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 lg:hidden">
          <Link href="/" className="text-lg font-bold">
            Roots
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {mobileOpen && (
          <nav className="space-y-1 border-b bg-background p-3 lg:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
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
                </Link>
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
              Logga ut
            </button>
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
