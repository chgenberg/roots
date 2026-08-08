"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";

/**
 * Legacy CTA from onboarding pointed here (`/forening/installningar`).
 * The real settings surface is shared at `/installningar`.
 */
export default function ForeningInstallningarRedirect() {
  const router = useRouter();
  const { href } = useLocale();
  useEffect(() => {
    router.replace(href("/installningar"));
  }, [router, href]);

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
    </div>
  );
}
