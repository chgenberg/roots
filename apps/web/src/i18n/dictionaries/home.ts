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
    ctaClub: string;
    ctaSell: string;
  };
  clubs: {
    title: string;
    body: string;
    listLabel: string;
    nextTitle: string;
    nextCta: string;
    prev: string;
    next: string;
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
    sellingAlt: string;
    campAlt: string;
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
      titleLine1: "Allt som växer börjar med starka rötter",
      titleLine2:
        "Naturlig hårvård som ger tillbaka till föreningslivet. 35 % stannar i föreningen.",
      body: "Tre flaskor. En rutin. Utan sulfater, silikoner och parabener.",
      altDesktop:
        "Roots Schampoo, Conditioner och Body Wash på en stenbänk i ett ljust badrum",
      altMobile:
        "Roots Schampoo, Conditioner och Body Wash i ett ljust badrum",
      ctaHairAnalysis: "Starta din håranalys",
      ctaProducts: "Se produkterna",
      ctaClub: "Räkna på intäkten",
      ctaSell: "Sälj med oss",
    },
    clubs: {
      title: "Klubbar vi jobbar med",
      body: "Följande klubbar är ett axplock av de som redan är anslutna.",
      listLabel: "Anslutna klubbar",
      nextTitle: "Er förening här?",
      nextCta: "Sälj med oss",
      prev: "Föregående klubb",
      next: "Nästa klubb",
    },
    products: {
      badge: "Sortiment",
      title: "Tre premiumprodukter",
      body: "Schampo, balsam och body wash med naturliga ingredienser där varje element tjänar ett tydligt syfte för att vårda hår och hud. Produkter för daglig användning av hög kvalitet.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Schampoo",
          tagline: "Rengör på riktigt.",
          image: "/images/roots-shampoo-bath-s.jpg",
          price: "199 kr",
          badge: "Schampo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Mjukt följsamt hår.",
          image: "/images/roots-conditioner-bath-w.jpg",
          price: "199 kr",
          badge: "Balsam",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "Skonsam dusch.",
          image: "/images/roots-body-wash-bath-w.jpg",
          price: "179 kr",
          badge: "Body Wash",
        },
      ],
      bundle: {
        price: "399 kr",
        label: "Roots Premiumpaket, alla tre",
        alt: "Roots Premiumpaket",
      },
    },
    forClubs: {
      badge: "För föreningar",
      title: "Ni säljer. Vi sköter resten.",
      body: "Vi vet hur föreningar fungerar. Därför byggde vi en plattform som gör det enkelt att sälja och beställa. Varje medlem får en egen butik att dela med länk eller QR-kod. Roots tar order, betalning och leverans.",
      benefits: [
        {
          title: "Enkel försäljning",
          description:
            "Inga listor, inga kontanter, ingen minsta order. Medlemmen delar. Kunden handlar. Klart.",
        },
        {
          title: "För föreningar",
          description:
            "Ni stärker varandra. Föreningen behåller 35 % av allt som säljs.",
        },
        {
          title: "Vi levererar",
          description:
            "Leverans direkt till klubben eller enskilda medlemmar. Vi fixar logistiken.",
        },
      ],
      cta: "Sälj med oss",
      ctaCalc: "Räkna på intäkten",
      sellingAlt: "Fotbollsträning för ungdomar på en konstgräsplan en grå höstdag",
      campAlt: "Innebandymatch för ungdomar i en sporthall",
    },
    gamification: {
      badge: "Milstolpar",
      title: "Föreningar växer med Roots",
      body: "Anmäl din förening. Först en order. Sen en vana.",
      achievements: [
        {
          title: "Första beställningen",
          stat: "Då vet ni att det fungerar.",
        },
        {
          title: "10 beställningar",
          stat: "Då är det en vana, inte en kampanj.",
        },
        {
          title: "Ett år med Roots",
          stat: "Då är det en intäkt ni kan räkna med.",
        },
      ],
      cta: "Sälj med oss",
    },
    founders: {
      badge: "Varför vi gör det här",
      title: "Hårvård som arbetar med håret, inte mot det",
      paragraphs: [
        "Hår och hårbotten har en egen naturlig balans. Våra produkter är gjorda för att ta hand om den, med milda sockerbaserade tensider, SyriCalm® och en diskret, neutral doft.",
        "Varje köp gör skillnad. 35 % går tillbaka till föreningen.",
      ],
      cta: "Läs varför",
      alt: "Roots Schampoo, Conditioner och Body Wash på en bänk i ett omklädningsrum",
    },
  },
  en: {
    hero: {
      titleLine1: "Everything that grows starts with strong roots",
      titleLine2:
        "Natural hair care that gives back to club life. 35% stays with the club.",
      body: "Three bottles. One routine. No sulphates, silicones or parabens.",
      altDesktop:
        "Roots Schampoo, Conditioner and Body Wash on a stone counter in a bright bathroom",
      altMobile: "Roots Schampoo, Conditioner and Body Wash in a bright bathroom",
      ctaHairAnalysis: "Start your hair analysis",
      ctaProducts: "See the products",
      ctaClub: "Calculate your earnings",
      ctaSell: "Sell with us",
    },
    clubs: {
      title: "Clubs we work with",
      body: "These clubs are a selection of those already on board.",
      listLabel: "Clubs on board",
      nextTitle: "Your club here?",
      nextCta: "Sell with us",
      prev: "Previous club",
      next: "Next club",
    },
    products: {
      badge: "Range",
      title: "Three premium products",
      body: "Shampoo, conditioner and body wash with natural ingredients, where every element has a clear purpose in caring for hair and skin. High-quality products for everyday use.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Schampoo",
          tagline: "A real clean.",
          image: "/images/roots-shampoo-bath-s.jpg",
          price: "SEK 199",
          badge: "Shampoo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Soft, smooth hair.",
          image: "/images/roots-conditioner-bath-w.jpg",
          price: "SEK 199",
          badge: "Conditioner",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "A gentle shower.",
          image: "/images/roots-body-wash-bath-w.jpg",
          price: "SEK 179",
          badge: "Body Wash",
        },
      ],
      bundle: {
        price: "SEK 399",
        label: "Roots Premium pack, all three",
        alt: "Roots Premium pack",
      },
    },
    forClubs: {
      badge: "For clubs",
      title: "You sell. We handle the rest.",
      body: "We know how clubs work. That's why we built a platform that makes selling and ordering easy. Every member gets their own shop to share by link or QR code. Roots takes the order, the payment and the delivery.",
      benefits: [
        {
          title: "Easy selling",
          description:
            "No lists, no cash, no minimum order. The member shares. The customer buys. Done.",
        },
        {
          title: "For clubs",
          description:
            "You lift each other. The club keeps 35% of everything sold.",
        },
        {
          title: "We deliver",
          description:
            "Delivery straight to the club or to individual members. We handle the logistics.",
        },
      ],
      cta: "Sell with us",
      ctaCalc: "Calculate your earnings",
      sellingAlt: "Youth football practice on an artificial pitch on a grey autumn day",
      campAlt: "Youth floorball match in a sports hall",
    },
    gamification: {
      badge: "Milestones",
      title: "Clubs grow with Roots",
      body: "Register your club. First an order. Then a habit.",
      achievements: [
        {
          title: "First order",
          stat: "That's when you know it works.",
        },
        {
          title: "10 orders",
          stat: "That's a habit, not a campaign.",
        },
        {
          title: "One year with Roots",
          stat: "That's income you can count on.",
        },
      ],
      cta: "Sell with us",
    },
    founders: {
      badge: "Why we do this",
      title: "Hair care that works with your hair, not against it",
      paragraphs: [
        "Hair and scalp have their own natural balance. Our products are made to look after it, with mild sugar-based surfactants, SyriCalm® and a discreet, neutral scent.",
        "Every purchase makes a difference. 35% goes back to the club.",
      ],
      cta: "Read why",
      alt: "Roots Schampoo, Conditioner and Body Wash on a bench in a locker room",
    },
  },
};
