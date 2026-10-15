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
    orderViaAssociation: "Beställ via din förening",
    allProducts: "Alla produkter",
    ingredientsHeading: "Ingredienser (INCI)",
    containsHeading: "Det här ingår",
    inUseAltSuffix: "i användning",
    notFoundTitle: "Produkten finns inte",
  },
  en: {
    orderViaAssociation: "Order through your club",
    allProducts: "All products",
    ingredientsHeading: "Ingredients (INCI)",
    containsHeading: "What's included",
    inUseAltSuffix: "in use",
    notFoundTitle: "Product not found",
  },
} as const;

export const products: Record<
  "shampoo" | "conditioner" | "body-wash" | "paket",
  LocalizedProduct
> = {
  shampoo: {
    sv: {
      name: "Roots Shampoo",
      subtitle: "Schampo · 250 ml",
      tagline: "Rengör på riktigt.",
      description:
        "Hårbotten har ett eget ekosystem: mikrober, egna oljor och en hudbarriär. Roots Shampoo rengör med milda, sockerbaserade tensider. Smuts och fett försvinner. Skyddet får vara kvar. SyriCalm® av vass (Phragmites Communis) och svamp (Poria Cocos) lugnar och stöttar barriären. Polyquaternium reder ut, så att du slipper dra. Doften är diskret och neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Milda, sockerbaserade tensider",
        "SyriCalm® för lugn hårbotten",
        "Diskret, neutral doft",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Shampoo",
      subtitle: "Shampoo · 250 ml",
      tagline: "A real clean.",
      description:
        "Your scalp has its own ecosystem: microbes, natural oils and a skin barrier. Roots Shampoo cleanses with mild, sugar-based surfactants. Dirt and oil go. The protection stays. SyriCalm®, from reed (Phragmites Communis) and mushroom (Poria Cocos), soothes and supports the barrier. Polyquaternium detangles, so you don't have to pull. The scent is discreet and neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Mild, sugar-based surfactants",
        "SyriCalm® for a calm scalp",
        "Discreet, neutral scent",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  conditioner: {
    sv: {
      name: "Roots Conditioner",
      subtitle: "Balsam · 250 ml",
      tagline: "Mjukt följsamt hår.",
      description:
        "Efter tvätten behöver håret fukt och smidighet — inte ett lager som tynger. Roots Conditioner vårdar med provitamin B5 (Panthenol) och ett lätt mjukgörande komplex. E-vitamin och antioxidanter från svartpeppar (Piper Nigrum) och Inga-bark skyddar. SyriCalm® lugnar hårbotten. Håret blir mjukt, lätt att reda ut och rör sig som det ska. Doften är diskret och neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Panthenol för fukt",
        "E-vitamin och växtantioxidanter",
        "Lätt, tynger inte",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Conditioner",
      subtitle: "Conditioner · 250 ml",
      tagline: "Soft, smooth hair.",
      description:
        "After washing, hair needs moisture and movement — not a layer that weighs it down. Roots Conditioner cares with pro-vitamin B5 (Panthenol) and a light emollient complex. Vitamin E and antioxidants from black pepper (Piper Nigrum) and Inga bark protect. SyriCalm® soothes the scalp. Hair is left soft, easy to detangle and free to move. The scent is discreet and neutral.",
      priceSek: 199,
      priceOre: 19900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Panthenol for moisture",
        "Vitamin E and plant antioxidants",
        "Light, never heavy",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  "body-wash": {
    sv: {
      name: "Roots Body Wash",
      subtitle: "Body wash · 250 ml",
      tagline: "Skonsam dusch.",
      description:
        "Huden har samma slags balans som hårbotten: en barriär och ett mikroliv som skyddar. Roots Body Wash rengör med milda tensider och ett krämigt lödder. Panthenol lämnar huden mjuk. SyriCalm® av vass (Phragmites Communis) och svamp (Poria Cocos) lugnar och hjälper barriären. Doften är diskret — du känner dig ren, inte parfymerad.",
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
      subtitle: "Body wash · 250 ml",
      tagline: "A gentle shower.",
      description:
        "Skin has the same kind of balance as the scalp: a barrier and microbial life that protect it. Roots Body Wash cleanses with mild surfactants and a creamy lather. Panthenol leaves skin soft. SyriCalm®, from reed (Phragmites Communis) and mushroom (Poria Cocos), soothes and helps the barrier. The scent is discreet — you feel clean, not perfumed.",
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
      subtitle: "Schampo, balsam och body wash",
      tagline: "Tre flaskor. En rutin.",
      description:
        "Schampo, balsam och body wash som är gjorda för att användas tillsammans. De rengör skonsamt, vårdar det som behöver vård och lämnar hårets och hudens balans i fred. SyriCalm® av vass och svamp finns i alla tre. Doften är diskret och neutral. Som paket: 399 kr i stället för 577 kr var för sig.",
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
        { slug: "shampoo", label: "Roots Shampoo, 250 ml" },
        { slug: "conditioner", label: "Roots Conditioner, 250 ml" },
        { slug: "body-wash", label: "Roots Body Wash, 250 ml" },
      ],
      category: "Paket",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Premium pack",
      subtitle: "Shampoo, conditioner and body wash",
      tagline: "Three bottles. One routine.",
      description:
        "Shampoo, conditioner and body wash made to be used together. They cleanse gently, care for what needs care and leave hair and skin alone. SyriCalm®, from reed and mushroom, runs through all three. The scent is discreet and neutral. As a pack: SEK 399 instead of SEK 577 bought separately.",
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
        { slug: "shampoo", label: "Roots Shampoo, 250 ml" },
        { slug: "conditioner", label: "Roots Conditioner, 250 ml" },
        { slug: "body-wash", label: "Roots Body Wash, 250 ml" },
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
        "Rengör med sockerbaserade tensider. SyriCalm® lugnar. Hårbotten får vara.",
      listingHighlights: ["Sockerbaserade tensider", "SyriCalm®", "Neutral doft"],
    },
    en: {
      listingTagline:
        "Cleanses with sugar-based surfactants. SyriCalm® soothes. The scalp is left alone.",
      listingHighlights: ["Sugar-based surfactants", "SyriCalm®", "Neutral scent"],
    },
  },
  conditioner: {
    sv: {
      listingTagline:
        "Fukt och smidighet utan att tynga. Panthenol, E-vitamin och SyriCalm®.",
      listingHighlights: ["Panthenol", "E-vitamin", "Tynger inte"],
    },
    en: {
      listingTagline:
        "Moisture and movement without the weight. Panthenol, vitamin E and SyriCalm®.",
      listingHighlights: ["Panthenol", "Vitamin E", "Never heavy"],
    },
  },
  "body-wash": {
    sv: {
      listingTagline:
        "Rengör utan att torka ut. Panthenol och SyriCalm® lämnar huden mjuk.",
      listingHighlights: ["Milda tensider", "SyriCalm®", "Neutral doft"],
    },
    en: {
      listingTagline:
        "Cleanses without drying. Panthenol and SyriCalm® leave skin soft.",
      listingHighlights: ["Mild surfactants", "SyriCalm®", "Neutral scent"],
    },
  },
  paket: {
    sv: {
      listingTagline:
        "Tre flaskor. En rutin. Alla produkter till ett lägre pris.",
      listingHighlights: [
        "Alla tre produkterna",
        "3 × 250 ml",
        "Lägsta pris per flaska",
      ],
    },
    en: {
      listingTagline:
        "Three bottles. One routine. All the products at a lower price.",
      listingHighlights: [
        "All three products",
        "3 × 250 ml",
        "Lowest price per bottle",
      ],
    },
  },
};
