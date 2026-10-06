import type { Locale } from "../config";

/** Per-slug product marketing copy (listing + detail). Prices stay numeric. */
export type ProductCopy = {
  name: string;
  subtitle: string;
  tagline: string;
  description: string;
  /** Display price in SEK (number only — format in UI). */
  priceSek: number;
  priceOre: number;
  volume: string;
  badge: string | null;
  highlights: string[];
  /** Bundle-only: what is included. */
  contains?: { slug: string; label: string }[];
  /** Category label for structured data / crumbs. */
  category: string;
  ui: {
    orderViaAssociation: string;
    allProducts: string;
    ingredientsHeading: string;
    containsHeading: string;
    inUseAltSuffix: string;
    notFoundTitle: string;
  };
};

type LocalizedProduct = Record<Locale, ProductCopy>;

const sharedUi = {
  sv: {
    orderViaAssociation: "Beställ nu och stötta din förening",
    allProducts: "Alla produkter",
    ingredientsHeading: "Ingredienser (INCI)",
    containsHeading: "Detta ingår",
    inUseAltSuffix: "— i användning",
    notFoundTitle: "Produkt hittades inte",
  },
  en: {
    orderViaAssociation: "Order now and support your club",
    allProducts: "All products",
    ingredientsHeading: "Ingredients (INCI)",
    containsHeading: "What's included",
    inUseAltSuffix: "— in use",
    notFoundTitle: "Product not found",
  },
} as const;

export const products: Record<
  "shampoo" | "conditioner" | "body-wash" | "paket",
  LocalizedProduct
> = {
  shampoo: {
    sv: {
      name: "Roots Schampoo",
      subtitle: "Schampo — 250 ml",
      tagline: "Rengör — och lämnar hårbottens balans i fred",
      description:
        "Hårbotten har ett eget ekosystem av mikrober, egna oljor och en skyddande hudbarriär. Roots Schampoo rengör med milda, sockerbaserade tensider, så att smuts och fett försvinner utan att hårbotten skalas ren. SyriCalm® — av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och stöttar hudbarriären. Polyquaternium reder ut så att du slipper dra och slita. Doften är diskret och neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Milda, sockerbaserade tensider",
        "SyriCalm® – lugn hårbotten",
        "Diskret, neutral doft",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Schampoo",
      subtitle: "Shampoo — 250 ml",
      tagline: "Cleanses — and leaves the scalp's balance alone",
      description:
        "Your scalp has its own ecosystem of microbes, natural oils and a protective skin barrier. Roots Schampoo cleanses with mild, sugar-based surfactants, so dirt and oil wash away without stripping the scalp. SyriCalm® — from reed (Phragmites Communis) and mushroom (Poria Cocos) — soothes and supports the skin barrier. Polyquaternium detangles so you avoid pulling and tugging. The scent is discreet and neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Mild, sugar-based surfactants",
        "SyriCalm® – a calm scalp",
        "Discreet, neutral scent",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  conditioner: {
    sv: {
      name: "Roots Conditioner",
      subtitle: "Balsam — 250 ml",
      tagline: "Ger tillbaka det tvätten tar — inget mer",
      description:
        "Efter tvätten behöver håret fukt och smidighet, inte ett tjockt lager som tynger. Roots Conditioner vårdar med Pro-Vitamin B5 (Panthenol) och ett lätt emollient-komplex, skyddar med E-vitamin och antioxidanter från svartpeppar (Piper Nigrum) och Inga-bark, och lugnar hårbotten med SyriCalm®. Håret blir mjukt, lätt att reda ut och får behålla sin naturliga rörelse. Doften är diskret och neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Panthenol för fukt",
        "E-vitamin & växtantioxidanter",
        "Lätt – tynger inte",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Conditioner",
      subtitle: "Conditioner — 250 ml",
      tagline: "Gives back what washing takes — nothing more",
      description:
        "After washing, hair needs moisture and suppleness, not a heavy layer that weighs it down. Roots Conditioner cares with Pro-Vitamin B5 (Panthenol) and a light emollient complex, protects with vitamin E and antioxidants from black pepper (Piper Nigrum) and Inga bark, and soothes the scalp with SyriCalm®. Hair becomes soft, easy to detangle and keeps its natural movement. The scent is discreet and neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Panthenol for moisture",
        "Vitamin E & plant antioxidants",
        "Light – never heavy",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  "body-wash": {
    sv: {
      name: "Roots Body Wash",
      subtitle: "Body Wash — 250 ml",
      tagline: "Ren hud som får behålla sitt eget skydd",
      description:
        "Huden har samma slags balans som hårbotten: en barriär och ett mikroliv som skyddar. Roots Body Wash rengör med milda tensider och krämigt lödder och lämnar huden mjuk med Panthenol, medan SyriCalm® — av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och hjälper hudbarriären. Doften är diskret — för att du ska känna dig ren, inte parfymerad.",
      priceSek: 179,
      priceOre: 17900,
      volume: "250 ml",
      badge: null,
      highlights: ["Milda tensider", "SyriCalm® för hudbarriären", "Diskret, neutral doft"],
      category: "Kroppsvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Body Wash",
      subtitle: "Body Wash — 250 ml",
      tagline: "Clean skin that keeps its own protection",
      description:
        "Skin has the same kind of balance as the scalp: a barrier and microbial life that protect it. Roots Body Wash cleanses with mild surfactants and a creamy lather and leaves skin soft with Panthenol, while SyriCalm® — from reed (Phragmites Communis) and mushroom (Poria Cocos) — soothes and helps the skin barrier. The scent is discreet — so you feel clean, not perfumed.",
      priceSek: 179,
      priceOre: 17900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Mild surfactants",
        "SyriCalm® for the skin barrier",
        "Discreet, neutral scent",
      ],
      category: "Body care",
      ui: { ...sharedUi.en },
    },
  },

  paket: {
    sv: {
      name: "Roots Premiumpaket",
      subtitle: "Paket — schampo, balsam & body wash",
      tagline: "Hela duschen, samma princip",
      description:
        "Schampo, balsam och kroppstvätt som är gjorda för att fungera tillsammans: rengör skonsamt, vårda det som behöver vårdas och låt hårets och hudens egen balans vara kvar. SyriCalm® — av vass och svamp — går igenom alla tre, och doften är diskret och neutral. Som paket kostar de 399 kr i stället för 577 kr var för sig.",
      priceSek: 399,
      priceOre: 39900,
      volume: "3 × 250 ml",
      badge: "Spara 178 kr",
      highlights: [
        "Alla tre produkterna",
        "Spara 178 kr",
        "SyriCalm® i hela rutinen",
      ],
      contains: [
        { slug: "shampoo", label: "Roots Schampoo — 250 ml" },
        { slug: "conditioner", label: "Roots Conditioner — 250 ml" },
        { slug: "body-wash", label: "Roots Body Wash — 250 ml" },
      ],
      category: "Paket",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Premium pack",
      subtitle: "Pack — shampoo, conditioner & body wash",
      tagline: "The whole shower, one principle",
      description:
        "Shampoo, conditioner and body wash made to work together: cleanse gently, care for what needs care and leave the natural balance of hair and skin intact. SyriCalm® — from reed and mushroom — runs through all three, and the scent is discreet and neutral. As a pack they cost SEK 399 instead of SEK 577 separately.",
      priceSek: 399,
      priceOre: 39900,
      volume: "3 × 250 ml",
      badge: "Save SEK 178",
      highlights: [
        "All three products",
        "Save SEK 178",
        "SyriCalm® throughout the routine",
      ],
      contains: [
        { slug: "shampoo", label: "Roots Schampoo — 250 ml" },
        { slug: "conditioner", label: "Roots Conditioner — 250 ml" },
        { slug: "body-wash", label: "Roots Body Wash — 250 ml" },
      ],
      category: "Premium pack",
      ui: { ...sharedUi.en },
    },
  },
};

/** Short listing card copy (index page) — overlaps detail but keeps listing taglines. */
export const productListingExtras: Record<
  keyof typeof products,
  Record<Locale, { listingTagline: string; listingHighlights: string[] }>
> = {
  shampoo: {
    sv: {
      listingTagline:
        "Rengör skonsamt med sockerbaserade tensider. SyriCalm® lugnar hårbotten och håret får behålla sin naturliga balans.",
      listingHighlights: ["Sockerbaserade tensider", "SyriCalm®", "Neutral doft"],
    },
    en: {
      listingTagline:
        "Cleanses gently with sugar-based surfactants. SyriCalm® soothes the scalp and hair keeps its natural balance.",
      listingHighlights: ["Sugar-based surfactants", "SyriCalm®", "Neutral scent"],
    },
  },
  conditioner: {
    sv: {
      listingTagline:
        "Fukt och smidighet utan att tynga. Panthenol, E-vitamin och SyriCalm® — håret behåller sin rörelse.",
      listingHighlights: ["Panthenol", "E-vitamin", "Tynger inte"],
    },
    en: {
      listingTagline:
        "Moisture and suppleness without weighing hair down. Panthenol, vitamin E and SyriCalm® — hair keeps its movement.",
      listingHighlights: ["Panthenol", "Vitamin E", "Never heavy"],
    },
  },
  "body-wash": {
    sv: {
      listingTagline:
        "Rengör utan att torka ut. Panthenol och SyriCalm® lämnar huden mjuk och i balans.",
      listingHighlights: ["Milda tensider", "SyriCalm®", "Neutral doft"],
    },
    en: {
      listingTagline:
        "Cleanses without drying out. Panthenol and SyriCalm® leave skin soft and balanced.",
      listingHighlights: ["Mild surfactants", "SyriCalm®", "Neutral scent"],
    },
  },
  paket: {
    sv: {
      listingTagline:
        "Hela rutinen med samma skonsamma princip, till ett lägre pris — och det som de flesta väljer när de handlar via sin förening.",
      listingHighlights: [
        "Alla tre produkterna",
        "3 × 250 ml",
        "Lägsta pris per flaska",
      ],
    },
    en: {
      listingTagline:
        "The full routine with the same gentle principle, at a lower price — and what most people choose when shopping through their club.",
      listingHighlights: [
        "All three products",
        "3 × 250 ml",
        "Lowest price per bottle",
      ],
    },
  },
};
