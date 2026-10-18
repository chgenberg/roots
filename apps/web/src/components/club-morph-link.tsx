"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LocaleLink } from "@/components/locale-link";
import { morphToClub } from "@/lib/view-transition";

/** Länk till en klubbsida där loggan (märkt `data-morph-logo`) glider in. */
export function ClubMorphLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <LocaleLink
      href={`/klubbar/${slug}`}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (morphToClub(e.currentTarget, slug, (href) => router.push(href))) e.preventDefault();
      }}
    >
      {children}
    </LocaleLink>
  );
}
