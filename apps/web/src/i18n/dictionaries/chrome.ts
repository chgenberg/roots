export type Locale = "sv" | "en";

type NavKey = "products" | "clubLife" | "guides" | "about";

type FooterLink = { href: string; label: string };
type FooterGroup = { title: string; links: FooterLink[] };

type ChromeCopy = {
  nav: Record<NavKey, string>;
  aria: {
    login: string;
    bookDemo: string;
    openMenu: string;
    closeMenu: string;
    home: string;
    navMenu: string;
    announcement: string;
    instagram: string;
    linkedin: string;
  };
  footer: {
    tagline: string;
    copyright: string;
    groups: FooterGroup[];
  };
  announcement: string[];
  mobileMenu: {
    search: string;
    bookDemo: string;
    login: string;
    help: string;
    tagline: string;
  };
};

export const chrome: Record<Locale, ChromeCopy> = {
  sv: {
    nav: {
      products: "Produkter",
      clubLife: "Föreningsliv",
      guides: "Guider",
      about: "Om oss",
    },
    aria: {
      login: "Logga in",
      bookDemo: "Boka demo",
      openMenu: "Öppna meny",
      closeMenu: "Stäng meny",
      home: "Roots — startsida",
      navMenu: "Navigeringsmeny",
      announcement: "Aktuellt från Roots",
      instagram: "Roots på Instagram",
      linkedin: "Roots på LinkedIn",
    },
    footer: {
      tagline: "Naturlig hårvård som stärker föreningslivet i Sverige.",
      copyright: "Alla rättigheter förbehållna.",
      groups: [
        {
          title: "Produkter",
          links: [
            { href: "/produkter/shampoo", label: "Roots Schampoo" },
            { href: "/produkter/conditioner", label: "Roots Conditioner" },
            { href: "/produkter/body-wash", label: "Roots Body Wash" },
            { href: "/produkter/paket", label: "Roots Komplett paket" },
            { href: "/haranalys", label: "Gratis håranalys" },
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
            { href: "/integritet#cookies", label: "Cookies" },
          ],
        },
      ],
    },
    announcement: [
      "Föreningen behåller 35 % av försäljningen",
      "Utan sulfater, silikoner och parabener",
      "Utvecklat i Norden",
      "Inga uppstartsavgifter för föreningen",
      "Intäkterna går tillbaka till föreningslivet",
    ],
    mobileMenu: {
      search: "Sök",
      bookDemo: "Boka demo",
      login: "Logga in →",
      help: "Hjälp & FAQ",
      tagline: "Naturlig hårvård för föreningslivet",
    },
  },
  en: {
    nav: {
      products: "Products",
      clubLife: "For clubs",
      guides: "Guides",
      about: "About us",
    },
    aria: {
      login: "Log in",
      bookDemo: "Book a demo",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      home: "Roots — home",
      navMenu: "Navigation menu",
      announcement: "Latest from Roots",
      instagram: "Roots on Instagram",
      linkedin: "Roots on LinkedIn",
    },
    footer: {
      tagline: "Natural hair care that strengthens sports clubs in Sweden.",
      copyright: "All rights reserved.",
      groups: [
        {
          title: "Products",
          links: [
            { href: "/produkter/shampoo", label: "Roots Schampoo" },
            { href: "/produkter/conditioner", label: "Roots Conditioner" },
            { href: "/produkter/body-wash", label: "Roots Body Wash" },
            { href: "/produkter/paket", label: "Roots Complete pack" },
            { href: "/haranalys", label: "Free hair analysis" },
          ],
        },
        {
          title: "Company",
          links: [
            { href: "/foreningsliv", label: "For clubs" },
            { href: "/sa-fungerar-det", label: "How it works" },
            { href: "/om-oss", label: "About us" },
            { href: "/kontakt", label: "Contact" },
            { href: "/om-oss#press", label: "Press" },
            { href: "/om-oss#jobb", label: "Careers" },
          ],
        },
        {
          title: "Learn",
          links: [
            { href: "/guider", label: "Guides" },
            { href: "/hjalp", label: "Help" },
          ],
        },
        {
          title: "Legal",
          links: [
            { href: "/integritet", label: "Privacy policy" },
            { href: "/villkor", label: "Terms of sale" },
            { href: "/integritet#cookies", label: "Cookies" },
          ],
        },
      ],
    },
    announcement: [
      "The club keeps 35% of sales",
      "Free from sulphates, silicones and parabens",
      "Developed in the Nordics",
      "No start-up fees for the club",
      "Revenue goes back to sports clubs",
    ],
    mobileMenu: {
      search: "Search",
      bookDemo: "Book a demo",
      login: "Log in →",
      help: "Help & FAQ",
      tagline: "Natural hair care for sports clubs",
    },
  },
};
