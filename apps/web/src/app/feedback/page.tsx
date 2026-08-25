"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ReviewerChat } from "@/components/reviewer/ReviewerChat";
import { isReviewerEmail } from "@roots/contracts";
import { useLocale } from "@/i18n/locale-context";

export default function FeedbackPage() {
  const router = useRouter();
  const { href } = useLocale();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{
      user?: { email?: string; name?: string } | null;
    }>("/v1/auth/me").then(({ ok, data }) => {
      if (cancelled) return;
      const email = data.user?.email;
      if (!ok || !isReviewerEmail(email)) {
        router.replace(href("/login?next=/feedback"));
        return;
      }
      setName(data.user?.name || email || "Feedback");
    });
    return () => {
      cancelled = true;
    };
  }, [href, router]);

  if (!name) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-50/40 text-sm text-muted-foreground">
        Laddar…
      </div>
    );
  }

  return <ReviewerChat name={name} />;
}
