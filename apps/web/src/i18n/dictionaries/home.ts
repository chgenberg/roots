import type { Locale } from "../config";

type ProductPreview = {
  slug: string;
  name: string;
  tagline: string;
  image: string;
  price: string;
  badge: string;
};

type Benefit = {
  title: string;
  description: string;
};

type Principle = {
  value: string;
  label: string;
};

type Achievement = {
  title: string;
  stat: string;
};

type HomeCopy = {
  hero: {
    titleLine1: string;
    titleLine2: string;
    body: string;
    altDesktop: string;
    altMobile: string;
    ctaHairAnalysis: string;
    ctaProducts: string;
  };
  products: {
    badge: string;
    title: string;
    body: string;
    items: ProductPreview[];
    bundle: {
      price: string;
      label: string;
      alt: string;
    };
  };
  forClubs: {
    badge: string;
    title: string;
    body: string;
    benefits: Benefit[];
    cta: string;
    ctaCalc: string;
  };
  socialProof: {
    principles: Principle[];
  };
  gamification: {
    badge: string;
    title: string;
    body: string;
    achievements: Achievement[];
    cta: string;
  };
  founders: {
    badge: string;
    title: string;
    paragraphs: string[];
    cta: string;
    alt: string;
  };
};

export const home: Record<Locale, HomeCopy> = {
  sv: {
    hero: {
      titleLine1: "Naturlig hårvård.",
      titleLine2: "Ren känsla.",
      body: "Tre produkter för föreningslivet — utan sulfater, silikoner eller parabener.",
      altDesktop:
        "Roots-produkterna vid fotbollsplanen — Schampoo, Conditioner och Body Wash",
      altMobile:
        "Roots — Roots Schampoo, Roots Conditioner och Roots Body Wash",
      ctaHairAnalysis: "Starta din håranalys",
      ctaProducts: "Se produkterna",
    },
    products: {
      badge: "Sortiment",
      title: "Tre produkter. Inget mer.",
      body: "Vi tror på enkelhet. Varje produkt är noggrant formulerad med forskningsförankrade aktiver — för hela familjen.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Schampoo",
          tagline: "Rengör på riktigt — SyriCalm® lugnar hårbotten",
          image: "/images/sport-schampoo.jpg",
          price: "199 kr",
          badge: "Schampo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Mjukt, följsamt hår — Pro-Vitamin B5 & antioxidanter",
          image: "/images/sport-conditioner.jpg",
          price: "199 kr",
          badge: "Balsam",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "Respekterar huden — SyriCalm® lugnar och stärker",
          image: "/images/sport-body-wash.jpg",
          price: "179 kr",
          badge: "Body Wash",
        },
      ],
      bundle: {
        price: "399 kr",
        label: "Komplett paket — alla tre",
        alt: "Roots Komplett paket",
      },
    },
    forClubs: {
      badge: "För föreningar",
      title: "Byggt för föreningslivet",
      body: "Vi vet hur föreningar fungerar. Därför byggde vi en plattform som gör det enkelt att beställa och sälja naturlig hårvård.",
      benefits: [
        {
          title: "Enkel beställning",
          description:
            "Logga in, välj antal paket, klart. Inga krångliga avtal eller minsta beställningar.",
        },
        {
          title: "Stöd till föreningen",
          description:
            "En del av intäkterna går tillbaka till föreningslivet. Ni stärker varandra.",
        },
        {
          title: "Direktleverans",
          description:
            "Leverans direkt till klubben eller enskilda medlemmar. Vi fixar logistiken.",
        },
      ],
      cta: "Anslut din förening",
      ctaCalc: "Räkna på er förtjänst",
    },
    socialProof: {
      principles: [
        { value: "SyriCalm®", label: "lugnande aktiv i varje produkt" },
        { value: "0", label: "sulfater, silikoner, parabener" },
        { value: "Norden", label: "formulerat & tillverkat" },
      ],
    },
    gamification: {
      badge: "Milstolpar",
      title: "Föreningar som växer med Roots",
      body: "Anslut din förening och börja samla milstolpar",
      achievements: [
        {
          title: "Första beställningen",
          stat: "Bli en av de första föreningarna med Roots",
        },
        {
          title: "10 beställningar",
          stat: "Bygg en vana som föder kassan",
        },
        {
          title: "1 års medlem",
          stat: "Skapa en återkommande intäktskälla",
        },
      ],
      cta: "Anslut din förening",
    },
    founders: {
      badge: "Teamet",
      title: "Byggt av grannar med samma mål",
      paragraphs: [
        "Roots byggs av människor med bakgrund i föreningsliv, teknik och produkt. Vi delar samma dröm: att föreningslivet i Sverige ska blomstra.",
        "Naturlig hårvård kan bli en kraft som binder samman människor — från duschen till planen. Enkelt. Naturligt. Gemensamt.",
      ],
      cta: "Möt teamet",
      alt: "Roots teamet",
    },
  },
  en: {
    hero: {
      titleLine1: "Natural hair care.",
      titleLine2: "That clean feeling.",
      body: "Three products for clubs — without sulphates, silicones or parabens.",
      altDesktop:
        "Roots products by the football pitch — Schampoo, Conditioner and Body Wash",
      altMobile:
        "Roots — Roots Schampoo, Roots Conditioner and Roots Body Wash",
      ctaHairAnalysis: "Start your hair analysis",
      ctaProducts: "Browse products",
    },
    products: {
      badge: "Range",
      title: "Three products. Nothing more.",
      body: "We believe in simplicity. Each product is carefully formulated with research-backed actives — for the whole family.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Schampoo",
          tagline: "Cleanses thoroughly — SyriCalm® soothes the scalp",
          image: "/images/sport-schampoo.jpg",
          price: "SEK 199",
          badge: "Shampoo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Soft, manageable hair — Pro-Vitamin B5 & antioxidants",
          image: "/images/sport-conditioner.jpg",
          price: "SEK 199",
          badge: "Conditioner",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "Gentle on skin — SyriCalm® soothes and strengthens",
          image: "/images/sport-body-wash.jpg",
          price: "SEK 179",
          badge: "Body Wash",
        },
      ],
      bundle: {
        price: "SEK 399",
        label: "Complete pack — all three",
        alt: "Roots Complete pack",
      },
    },
    forClubs: {
      badge: "For clubs",
      title: "Built for sports clubs",
      body: "We know how clubs work. That is why we built a platform that makes it simple to order and sell natural hair care.",
      benefits: [
        {
          title: "Simple ordering",
          description:
            "Log in, choose how many packs, and you're done. No complicated contracts or minimum orders.",
        },
        {
          title: "Support for the club",
          description:
            "A share of the revenue goes back into club fundraising — so every sale supports the team.",
        },
        {
          title: "Direct delivery",
          description:
            "Delivery straight to the club or to individual members. We handle the logistics.",
        },
      ],
      cta: "Register your club",
      ctaCalc: "Calculate your earnings",
    },
    socialProof: {
      principles: [
        { value: "SyriCalm®", label: "soothing active in every product" },
        { value: "0", label: "sulphates, silicones, parabens" },
        { value: "Nordics", label: "formulated & manufactured" },
      ],
    },
    gamification: {
      badge: "Milestones",
      title: "Clubs that grow with Roots",
      body: "Register your club and start unlocking milestones.",
      achievements: [
        {
          title: "First order",
          stat: "Become one of the first clubs with Roots",
        },
        {
          title: "10 orders",
          stat: "Build a habit that strengthens the club's finances",
        },
        {
          title: "1-year member",
          stat: "Create a recurring revenue stream",
        },
      ],
      cta: "Register your club",
    },
    founders: {
      badge: "The team",
      title: "Built by neighbours with the same goal",
      paragraphs: [
        "Roots is built by people with backgrounds in sports clubs, technology and product. We share the same dream: that sports clubs in Sweden should thrive.",
        "Natural hair care can become a force that brings people together — from the shower to the pitch. Simple. Natural. Shared.",
      ],
      cta: "Meet the team",
      alt: "The Roots team",
    },
  },
};
