import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { RootsLogo } from "@/components/brand";

const FOOTER_LINKS = [
  {
    title: "Produkter",
    links: [
      { href: "/produkter/shampoo", label: "First Growth" },
      { href: "/produkter/conditioner", label: "Pure Root" },
      { href: "/produkter/body-wash", label: "Soft Rinse" },
      { href: "/haranalys", label: "Gratis håranalys" },
    ],
  },
  {
    title: "Företaget",
    links: [
      { href: "/foreningsliv", label: "Föreningsliv" },
      { href: "/om-oss", label: "Om oss" },
      { href: "/kontakt", label: "Kontakt" },
      { href: "/om-oss#press", label: "Press" },
      { href: "/om-oss#jobb", label: "Jobb" },
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
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <RootsLogo variant="black" className="h-8 w-[80px]" />
            <p className="mt-4 max-w-[25ch] text-sm leading-relaxed text-muted-foreground">
              Naturlig hudvård som stärker föreningslivet i Sverige.
            </p>
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
