"use client";

import { useRouter } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { RootsLogo } from "@/components/brand";
import { apiFetch } from "@/lib/api";
import { broadcastLogout } from "@/lib/use-cross-tab-logout";
import { useLocale } from "@/i18n/locale-context";
import { REVIEWER_HOME } from "@roots/contracts";

export function ReviewerShell({
  name,
  onNewChat,
  children,
}: {
  name: string;
  onNewChat?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { href } = useLocale();

  async function logout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    broadcastLogout();
    router.replace(href("/login"));
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-brand-50/40">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-brand-50/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <a href={href(REVIEWER_HOME)} className="inline-flex items-center">
            <RootsLogo variant="auto" className="h-[22px] w-auto" />
          </a>
          <div className="flex items-center gap-1">
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Ny chatt
              </button>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Logga ut"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{name.split(" ")[0] || "Logga ut"}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
