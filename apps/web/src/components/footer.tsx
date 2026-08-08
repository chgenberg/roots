"use client";

import { Instagram, Linkedin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { RootsLogo } from "@/components/brand";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { LEGAL_IDENTITY } from "@/lib/legal-identity";
import { LocaleLink } from "@/components/locale-link";
import { useLocale } from "@/i18n/locale-context";

export function Footer() {
  const { t } = useLocale();
  const groups = t.footer.groups.map((group) => ({
    ...group,
    links: group.links.filter(
      (link) => HAIR_ANALYSIS_ENABLED || link.href !== "/haranalys"
    ),
  }));

  return (
    <footer className="relative border-t border-border bg-brand-50/30">
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <RootsLogo variant="auto" className="h-8 w-[80px]" />
            <p className="mt-4 max-w-[25ch] text-sm leading-relaxed text-muted-foreground">
              {t.footer.tagline}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={LEGAL_IDENTITY.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t.aria.instagram}
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={LEGAL_IDENTITY.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t.aria.linkedin}
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </span>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <LocaleLink
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Roots Nordic AB. {t.footer.copyright}
          </p>
          <LegalIdentityBlock variant="compact" showContact />
        </div>
      </div>
    </footer>
  );
}
