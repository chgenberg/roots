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
        "Föreningar säljer hårvård som folk redan använder. 35 % stannar i föreningen.",
      body: "Tre flaskor. En rutin. Utan sulfater, silikoner och parabener.",
      altDesktop:
        "Roots Shampoo, Conditioner och Body Wash på en stenbänk i ett ljust badrum",
      altMobile:
        "Roots Shampoo, Conditioner och Body Wash i ett ljust badrum",
      ctaHairAnalysis: "Starta din håranalys",
      ctaProducts: "Se produkterna",
      ctaClub: "Räkna på intäkten",
    },
    products: {
      badge: "Sortiment",
      title: "Tre flaskor. En rutin.",
      body: "Schampo, balsam och body wash. Saker alla redan använder — därför går de att sälja.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Shampoo",
          tagline: "Rent hår. Hårbotten i fred.",
          image: "/images/roots-shampoo-bath.jpg",
          price: "199 kr",
          badge: "Schampo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Mjukt, utan att tynga.",
          image: "/images/roots-conditioner-bath.jpg",
          price: "199 kr",
          badge: "Balsam",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "Ren hud som inte torkar.",
          image: "/images/roots-body-wash-bath.jpg",
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
      body: "Varje medlem får en egen butik att dela med länk eller QR-kod. Roots tar order, betalning och leverans.",
      benefits: [
        {
          title: "En butik per medlem",
          description:
            "Inga listor, inga kontanter, ingen minsta order. Medlemmen delar. Kunden handlar. Klart.",
        },
        {
          title: "35 % till föreningen",
          description:
            "Föreningen behåller 35 % av allt som säljs. Samma andel för alla.",
        },
        {
          title: "Vi levererar",
          description:
            "Till klubben eller hem till den som köpt. Ni behöver inte packa en enda låda.",
        },
      ],
      cta: "Anslut din förening",
      ctaCalc: "Räkna på intäkten",
      sellingAlt:
        "Två ungdomar säljer Roots vid klubbstugan och en förälder betalar med Swish",
      campAlt: "Ett flicklag jublar tillsammans på fotbollsplanen",
    },
    gamification: {
      badge: "Milstolpar",
      title: "Först en order. Sen en vana.",
      body: "Anslut föreningen. Resten syns i portalen.",
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
      cta: "Anslut din förening",
    },
    founders: {
      badge: "Varför vi gör det här",
      title: "Hårvård som arbetar med håret, inte mot det",
      paragraphs: [
        "Hår och hårbotten har en egen naturlig balans. Våra produkter är gjorda för att ta hand om den, med milda sockerbaserade tensider, SyriCalm® och en diskret, neutral doft.",
        "Varje köp gör skillnad. 35 % går tillbaka till föreningen.",
      ],
      cta: "Läs varför",
      alt: "Roots Shampoo, Conditioner och Body Wash på en bänk i ett omklädningsrum",
    },
  },
  en: {
    hero: {
      titleLine1: "Everything that grows starts with strong roots",
      titleLine2:
        "Clubs sell hair care people already use. 35% stays with the club.",
      body: "Three bottles. One routine. No sulphates, silicones or parabens.",
      altDesktop:
        "Roots Shampoo, Conditioner and Body Wash on a stone counter in a bright bathroom",
      altMobile: "Roots Shampoo, Conditioner and Body Wash in a bright bathroom",
      ctaHairAnalysis: "Start your hair analysis",
      ctaProducts: "See the products",
      ctaClub: "Calculate your earnings",
    },
    products: {
      badge: "Range",
      title: "Three bottles. One routine.",
      body: "Shampoo, conditioner and body wash. Things everyone already uses — that's why they sell.",
      items: [
        {
          slug: "shampoo",
          name: "Roots Shampoo",
          tagline: "Clean hair. Scalp left alone.",
          image: "/images/roots-shampoo-bath.jpg",
          price: "SEK 199",
          badge: "Shampoo",
        },
        {
          slug: "conditioner",
          name: "Roots Conditioner",
          tagline: "Soft, never heavy.",
          image: "/images/roots-conditioner-bath.jpg",
          price: "SEK 199",
          badge: "Conditioner",
        },
        {
          slug: "body-wash",
          name: "Roots Body Wash",
          tagline: "Clean skin that doesn't dry out.",
          image: "/images/roots-body-wash-bath.jpg",
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
      body: "Every member gets their own shop to share by link or QR code. Roots takes the order, the payment and the delivery.",
      benefits: [
        {
          title: "A shop per member",
          description:
            "No lists, no cash, no minimum order. The member shares. The customer buys. Done.",
        },
        {
          title: "35% to the club",
          description:
            "The club keeps 35% of everything sold. The same share for every club.",
        },
        {
          title: "We deliver",
          description:
            "To the club or to the buyer's door. You don't pack a single box.",
        },
      ],
      cta: "Register your club",
      ctaCalc: "Calculate your earnings",
      sellingAlt:
        "Two young people selling Roots by the clubhouse while a parent pays with Swish",
      campAlt: "A girls' team celebrating together on the football pitch",
    },
    gamification: {
      badge: "Milestones",
      title: "First an order. Then a habit.",
      body: "Register the club. The rest shows up in the portal.",
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
      cta: "Register your club",
    },
    founders: {
      badge: "Why we do this",
      title: "Hair care that works with your hair, not against it",
      paragraphs: [
        "Hair and scalp have their own natural balance. Our products are made to look after it, with mild sugar-based surfactants, SyriCalm® and a discreet, neutral scent.",
        "Every purchase makes a difference. 35% goes back to the club.",
      ],
      cta: "Read why",
      alt: "Roots Shampoo, Conditioner and Body Wash on a bench in a locker room",
    },
  },
};
