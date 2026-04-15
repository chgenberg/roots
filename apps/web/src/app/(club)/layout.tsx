"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChatWidget } from "@/components/chat-widget";
import {
  LayoutDashboard,
  ShoppingCart,
  Clock,
  User,
  LogOut,
} from "lucide-react";

const CLUB_NAV = [
  { href: "/club/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/club/bestall", label: "Beställ", icon: ShoppingCart },
  { href: "/club/historik", label: "Historik", icon: Clock },
  { href: "/club/konto", label: "Konto", icon: User },
];

export default function ClubLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-brand-50/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
            Roots
          </Link>
          <Badge variant="secondary">Klubbportal</Badge>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-border bg-background/95 px-3 py-2.5 md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Klubbportal"
        >
          {CLUB_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === item.href
                  ? "bg-inverse-surface text-inverse-on-surface shadow-sm"
                  : "bg-brand-50 text-muted-foreground hover:bg-brand-100"
              )}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => { document.cookie = "rootsSessionId=; path=/; max-age=0"; window.location.href = "/login"; }}
            className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-100"
          >
            Logga ut
          </button>
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <nav className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-border bg-background p-4 md:block">
          <ul className="space-y-1">
            {CLUB_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-brand-50 text-foreground"
                      : "text-muted-foreground hover:bg-brand-50/60 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
            <Separator className="my-3" />
            <li>
              <button onClick={() => { document.cookie = "rootsSessionId=; path=/; max-age=0"; window.location.href = "/login"; }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-50/60 hover:text-foreground">
                <LogOut className="h-4 w-4" />
                Logga ut
              </button>
            </li>
          </ul>
        </nav>

        <main className="flex-1 animate-fade-in p-6 md:p-10">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
