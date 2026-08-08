import Link from "next/link";
import { Instagram, Linkedin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { RootsLogo } from "@/components/brand";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { LEGAL_IDENTITY } from "@/lib/legal-identity";

const FOOTER_LINKS = [
  {
    title: "Produkter",
    links: [
      { href: "/produkter/shampoo", label: "Roots Schampoo" },
      { href: "/produkter/conditioner", label: "Roots Conditioner" },
      { href: "/produkter/body-wash", label: "Roots Body Wash" },
      { href: "/produkter/paket", label: "Roots Komplett paket" },
      ...(HAIR_ANALYSIS_ENABLED
        ? [{ href: "/haranalys", label: "Gratis håranalys" }]
        : []),
    ],
  },
  {
    title: "Företaget",
    links: [
      { href: "/foreningsliv", label: "Föreningsliv" },
      { href: "/sa-fungerar-det", label: "Så fungerar det" },
      { href: "/om-oss", label: "Om oss" },
      { href: "/kontakt", label: "Kontakt" },
      { href: "/om-oss#press", label: "Press" },
      { href: "/om-oss#jobb", label: "Jobb" },
    ],
  },
  {
    title: "Kunskap",
    links: [
      { href: "/guider", label: "Guider" },
      { href: "/hjalp", label: "Hjälp" },
    ],
  },
  {
    title: "Juridiskt",
    links: [
      { href: "/integritet", label: "Integritetspolicy" },
      { href: "/villkor", label: "Köpvillkor" },
      // P3.76 (audit 2026-05-26): footer-spec listar "cookies" som
      // separat länk under Juridik. Vi använder samma anchor som
      // privacy-policyn ger i sin cookie-sektion.
      { href: "/integritet#cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    // The grass element used to live above the footer as an absolute-
    // positioned band (-top-12) but the blades floated in the white
    // space above the footer with no ground line to grow from, so
    // they read as broken fragments. Removed in favour of the warm
    // sand bg + brand logotype, which carries the brand on its own.
    <footer className="relative border-t border-border bg-brand-50/30">
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <RootsLogo variant="auto" className="h-8 w-[80px]" />
            <p className="mt-4 max-w-[25ch] text-sm leading-relaxed text-muted-foreground">
              Naturlig hårvård som stärker föreningslivet i Sverige.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={LEGAL_IDENTITY.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Roots på Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={LEGAL_IDENTITY.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Roots på LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </span>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Roots Nordic AB. Alla rättigheter förbehållna.
          </p>
          <LegalIdentityBlock variant="compact" showContact />
        </div>
      </div>
    </footer>
  );
}
