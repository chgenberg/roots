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
    containsHeading: "Detta ingår",
    inUseAltSuffix: "— i användning",
    notFoundTitle: "Produkt hittades inte",
  },
  en: {
    orderViaAssociation: "Order through your club",
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
      tagline:
        "Schampo som rengör på riktigt — och lämnar hårbotten i ro",
      description:
        "Ett mjukt men effektivt schampo som löser smuts och fett utan att skala bort hårbottnens naturliga balans. Sockerbaserade, sulfatsnåla tvättämnen rengör skonsamt medan SyriCalm® — en forskningsförankrad nordisk aktiv av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och stärker hårbotten. Polyquaternium reder ut och ger naturlig glans. Håret känns rent, lätt och levande, dag efter dag.",
      priceSek: 149,
      priceOre: 14900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Sulfatsnålt",
        "SyriCalm® – lugnar hårbotten",
        "Reder ut & ger glans",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Schampoo",
      subtitle: "Shampoo — 250 ml",
      tagline:
        "Shampoo that truly cleanses — and leaves the scalp calm",
      description:
        "A gentle yet effective shampoo that lifts dirt and oil without stripping the scalp's natural balance. Sugar-based, low-sulphate surfactants cleanse kindly while SyriCalm® — a research-backed Nordic active from reed (Phragmites Communis) and mushroom (Poria Cocos) — soothes and supports the scalp. Polyquaternium detangles and brings natural shine. Hair feels clean, light and alive, day after day.",
      priceSek: 149,
      priceOre: 14900,
      volume: "250 ml",
      badge: "Bestseller",
      highlights: [
        "Low-sulphate",
        "SyriCalm® – soothes the scalp",
        "Detangles & adds shine",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  conditioner: {
    sv: {
      name: "Roots Conditioner",
      subtitle: "Balsam — 250 ml",
      tagline:
        "Balsam som ger håret exakt det det behöver — inget mer, inget mindre",
      description:
        "Ett närande balsam som gör håret mjukt, följsamt och lätt att reda ut utan att tynga ner. Ett lätt emollient-komplex och Pro-Vitamin B5 (Panthenol) återfuktar på djupet, medan E-vitamin och antioxidanter från svartpeppar (Piper Nigrum) och Inga-bark skyddar håret mot daglig miljöstress. SyriCalm® lugnar hårbotten. Resultatet: silkeslent hår med en lyster som håller hela dagen.",
      priceSek: 149,
      priceOre: 14900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "SyriCalm® & Panthenol",
        "E-vitamin & antioxidanter",
        "Närande – utan att tynga",
      ],
      category: "Hårvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Conditioner",
      subtitle: "Conditioner — 250 ml",
      tagline:
        "Conditioner that gives hair exactly what it needs — nothing more, nothing less",
      description:
        "A nourishing conditioner that leaves hair soft, manageable and easy to detangle without weighing it down. A light emollient complex and Pro-Vitamin B5 (Panthenol) moisturise deeply, while vitamin E and antioxidants from black pepper (Piper Nigrum) and Inga bark help protect hair from everyday environmental stress. SyriCalm® soothes the scalp. The result: silky hair with a shine that lasts all day.",
      priceSek: 149,
      priceOre: 14900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "SyriCalm® & Panthenol",
        "Vitamin E & antioxidants",
        "Nourishing – without weighing down",
      ],
      category: "Hair care",
      ui: { ...sharedUi.en },
    },
  },

  "body-wash": {
    sv: {
      name: "Roots Body Wash",
      subtitle: "Body Wash — 250 ml",
      tagline:
        "Body wash som respekterar huden — istället för att störa den",
      description:
        "En skonsam kroppstvätt med krämigt lödder som rengör utan att torka ut. Milda tvättämnen och ett Panthenol-derivat lämnar huden len och återfuktad, medan SyriCalm® — av vass (Phragmites Communis) och svamp (Poria Cocos) — lugnar och stärker hudens naturliga skyddsbarriär. Huden känns ren, mjuk och i balans efter varje dusch.",
      priceSek: 129,
      priceOre: 12900,
      volume: "250 ml",
      badge: null,
      highlights: ["Sulfatsnålt", "SyriCalm® – lugnar huden", "Panthenol (B5)"],
      category: "Kroppsvård",
      ui: { ...sharedUi.sv },
    },
    en: {
      name: "Roots Body Wash",
      subtitle: "Body Wash — 250 ml",
      tagline:
        "Body wash that respects the skin — instead of disrupting it",
      description:
        "A gentle body wash with a creamy lather that cleanses without drying out. Mild surfactants and a Panthenol derivative leave skin soft and hydrated, while SyriCalm® — from reed (Phragmites Communis) and mushroom (Poria Cocos) — soothes and supports the skin's natural barrier. Skin feels clean, soft and balanced after every shower.",
      priceSek: 129,
      priceOre: 12900,
      volume: "250 ml",
      badge: null,
      highlights: [
        "Low-sulphate",
        "SyriCalm® – soothes the skin",
        "Panthenol (B5)",
      ],
      category: "Body care",
      ui: { ...sharedUi.en },
    },
  },

  paket: {
    sv: {
      name: "Roots Komplett paket",
      subtitle: "Paket — schampo, balsam & body wash",
      tagline: "Hela rutinen — schampo, balsam och kroppstvätt i ett paket",
      description:
        "De tre produkterna är formulerade för att användas tillsammans. Schampot rengör utan att rubba hårbottnens balans, balsamet ger tillbaka fukt och följsamhet, och kroppstvätten tar hand om huden på samma skonsamma sätt. SyriCalm® — den nordiska aktiven av vass och svamp — går igenom alla tre. Som paket kostar de 399 kr istället för 427 kr var för sig.",
      priceSek: 399,
      priceOre: 39900,
      volume: "3 × 250 ml",
      badge: "Spara 28 kr",
      highlights: [
        "Alla tre produkterna",
        "Spara 28 kr",
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
      name: "Roots Complete pack",
      subtitle: "Pack — shampoo, conditioner & body wash",
      tagline:
        "The full routine — shampoo, conditioner and body wash in one pack",
      description:
        "The three products are formulated to work together. The shampoo cleanses without upsetting scalp balance, the conditioner restores moisture and manageability, and the body wash cares for skin with the same gentle approach. SyriCalm® — the Nordic reed-and-mushroom active — runs through all three. As a pack they cost SEK 399 instead of SEK 427 separately.",
      priceSek: 399,
      priceOre: 39900,
      volume: "3 × 250 ml",
      badge: "Save SEK 28",
      highlights: [
        "All three products",
        "Save SEK 28",
        "SyriCalm® throughout the routine",
      ],
      contains: [
        { slug: "shampoo", label: "Roots Schampoo — 250 ml" },
        { slug: "conditioner", label: "Roots Conditioner — 250 ml" },
        { slug: "body-wash", label: "Roots Body Wash — 250 ml" },
      ],
      category: "Complete pack",
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
        "Ett milt men effektivt schampo som rengör utan att torka ut. SyriCalm® lugnar hårbotten och Polyquaternium reder ut — håret känns rent, lätt och i balans.",
      listingHighlights: ["Sulfatsnålt", "SyriCalm®", "Reder ut & glans"],
    },
    en: {
      listingTagline:
        "A mild yet effective shampoo that cleanses without drying out. SyriCalm® soothes the scalp and Polyquaternium detangles — hair feels clean, light and balanced.",
      listingHighlights: ["Low-sulphate", "SyriCalm®", "Detangles & shine"],
    },
  },
  conditioner: {
    sv: {
      listingTagline:
        "Ett närande balsam som gör håret mjukt och följsamt utan att tynga. Pro-Vitamin B5 och antioxidanter ger fukt, lyster och skydd — SyriCalm® lugnar hårbotten.",
      listingHighlights: [
        "SyriCalm® & Panthenol",
        "E-vitamin",
        "Närande utan att tynga",
      ],
    },
    en: {
      listingTagline:
        "A nourishing conditioner that leaves hair soft and manageable without weighing it down. Pro-Vitamin B5 and antioxidants deliver moisture, shine and protection — SyriCalm® soothes the scalp.",
      listingHighlights: [
        "SyriCalm® & Panthenol",
        "Vitamin E",
        "Nourishing without weighing down",
      ],
    },
  },
  "body-wash": {
    sv: {
      listingTagline:
        "En skonsam kroppstvätt som rengör utan att torka ut. Milda tvättämnen och SyriCalm® lämnar huden len, återfuktad och i balans.",
      listingHighlights: ["Sulfatsnålt", "SyriCalm®", "Panthenol (B5)"],
    },
    en: {
      listingTagline:
        "A gentle body wash that cleanses without drying out. Mild surfactants and SyriCalm® leave skin soft, hydrated and balanced.",
      listingHighlights: ["Low-sulphate", "SyriCalm®", "Panthenol (B5)"],
    },
  },
  paket: {
    sv: {
      listingTagline:
        "Hela rutinen i ett paket. Samma formuleringar som var för sig, till ett lägre pris — och det som de flesta väljer när de handlar via sin förening.",
      listingHighlights: [
        "Alla tre produkterna",
        "3 × 250 ml",
        "Lägsta pris per flaska",
      ],
    },
    en: {
      listingTagline:
        "The full routine in one pack. The same formulas as sold separately, at a lower price — and what most people choose when shopping through their club.",
      listingHighlights: [
        "All three products",
        "3 × 250 ml",
        "Lowest price per bottle",
      ],
    },
  },
};
