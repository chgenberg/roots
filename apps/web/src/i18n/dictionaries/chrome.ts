export type Locale = "sv" | "en";

type NavKey = "products" | "clubLife" | "howItWorks" | "guides" | "about";

type FooterLink = { href: string; label: string };
type FooterGroup = { title: string; links: FooterLink[] };

type ChromeCopy = {
  nav: Record<NavKey, string>;
  calcCta: string;
  sellCta: string;
  contactCta: string;
  aria: {
    login: string;
    bookDemo: string;
    calcCta: string;
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
  announcement: string;
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
      howItWorks: "Så här går det till",
      guides: "Guider",
      about: "Om oss",
    },
    calcCta: "Räkna på intäkten",
    sellCta: "Sälj med oss",
    contactCta: "Kontakta oss",
    aria: {
      login: "Logga in",
      bookDemo: "Boka demo",
      calcCta: "Räkna på intäkten",
      openMenu: "Öppna meny",
      closeMenu: "Stäng meny",
      home: "Roots startsida",
      navMenu: "Navigeringsmeny",
      announcement: "Föreningens andel",
      instagram: "Roots på Instagram",
      linkedin: "Roots på LinkedIn",
    },
    footer: {
      tagline: "Hårvård som föreningar säljer. 35 % stannar i föreningen.",
      copyright: "Alla rättigheter förbehållna.",
      groups: [
        {
          title: "Produkter",
          links: [
            { href: "/produkter/shampoo", label: "Roots Schampoo" },
            { href: "/produkter/conditioner", label: "Roots Conditioner" },
            { href: "/produkter/body-wash", label: "Roots Body Wash" },
            { href: "/produkter/paket", label: "Roots Premiumpaket" },
            { href: "/haranalys", label: "Gratis håranalys" },
          ],
        },
        {
          title: "Företaget",
          links: [
            { href: "/intresseanmalan", label: "Sälj med oss" },
            { href: "/sa-har-gar-det-till", label: "Så här går det till" },
            { href: "/sa-fungerar-det#rakna", label: "Räkna på intäkten" },
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
    announcement: "Föreningen behåller 35 %.",
    mobileMenu: {
      search: "Sök",
      bookDemo: "Boka demo",
      login: "Logga in →",
      help: "Hjälp & FAQ",
      tagline: "Hårvård som föreningar säljer.",
    },
  },
  en: {
    nav: {
      products: "Products",
      clubLife: "For clubs",
      howItWorks: "How it works",
      guides: "Guides",
      about: "About us",
    },
    calcCta: "Calculate your earnings",
    sellCta: "Sell with us",
    contactCta: "Contact us",
    aria: {
      login: "Log in",
      bookDemo: "Book a demo",
      calcCta: "Calculate your earnings",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      home: "Roots home",
      navMenu: "Navigation menu",
      announcement: "Club share",
      instagram: "Roots on Instagram",
      linkedin: "Roots on LinkedIn",
    },
    footer: {
      tagline: "Hair care that clubs sell. 35% stays with the club.",
      copyright: "All rights reserved.",
      groups: [
        {
          title: "Products",
          links: [
            { href: "/produkter/shampoo", label: "Roots Schampoo" },
            { href: "/produkter/conditioner", label: "Roots Conditioner" },
            { href: "/produkter/body-wash", label: "Roots Body Wash" },
            { href: "/produkter/paket", label: "Roots Premium pack" },
            { href: "/haranalys", label: "Free hair analysis" },
          ],
        },
        {
          title: "Company",
          links: [
            { href: "/intresseanmalan", label: "Sell with us" },
            { href: "/sa-har-gar-det-till", label: "How it works" },
            { href: "/sa-fungerar-det#rakna", label: "Calculate your earnings" },
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
    announcement: "The club keeps 35%.",
    mobileMenu: {
      search: "Search",
      bookDemo: "Book a demo",
      login: "Log in →",
      help: "Help & FAQ",
      tagline: "Hair care that clubs sell.",
    },
  },
};
