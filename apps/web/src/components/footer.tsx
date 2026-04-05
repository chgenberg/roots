import Link from "next/link";
import { Separator } from "@/components/ui/separator";

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
    <footer className="border-t border-border bg-brand-50/30">
      <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <span className="text-lg font-bold tracking-tight">Roots</span>
            <p className="mt-3 max-w-[25ch] text-sm leading-relaxed text-muted-foreground">
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

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Roots Nordic AB. Alla rättigheter förbehållna.
        </p>
      </div>
    </footer>
  );
}
