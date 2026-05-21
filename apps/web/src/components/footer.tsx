import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { RootsLogo, RootsGrassDivider } from "@/components/brand";

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
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-brand-50/30">
      {/* Sprint E14: brand grass element above the footer. Sits in the
          warm-sand bg-brand-50 strip so the dark element reads as a
          gentle horizon line rather than a heavy visual break. */}
      <RootsGrassDivider
        variant="dark"
        className="absolute inset-x-0 -top-12 h-12 md:-top-16 md:h-16 lg:-top-20 lg:h-20"
        aria-hidden
      />
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
