import type { Locale } from "./config";
import { appCommon } from "./dictionaries/app-common";
import { auth } from "./dictionaries/auth";
import { chrome } from "./dictionaries/chrome";
import { fundraising } from "./dictionaries/fundraising";
import { fundraisingPages } from "./dictionaries/fundraising-pages";
import { home } from "./dictionaries/home";
import { pages } from "./dictionaries/pages";
import { portal } from "./dictionaries/portal";
import {
  getPortalPage,
  getPortalShared,
  portalPages,
  portalShared,
} from "./dictionaries/portal-pages";
import { preview } from "./dictionaries/preview";
import { shop } from "./dictionaries/shop";
import {
  productListingExtras,
  products,
  type ProductCopy,
} from "./dictionaries/products";

export function getAppCommon(locale: Locale) {
  return appCommon[locale];
}

export function getPortalDict(locale: Locale) {
  return portal[locale];
}

export {
  getPortalPage,
  getPortalShared,
  portalPages,
  portalShared,
};

export function getFundraisingDict(locale: Locale) {
  return fundraising[locale];
}

export function getFundraisingPage<K extends keyof typeof fundraisingPages>(
  key: K,
  locale: Locale
): (typeof fundraisingPages)[K]["sv"] | (typeof fundraisingPages)[K]["en"] {
  const block = fundraisingPages[key];
  return locale === "en" ? block.en : block.sv;
}

export function getChrome(locale: Locale) {
  return chrome[locale];
}

export function getHome(locale: Locale) {
  return home[locale];
}

export function getAuth<K extends keyof typeof auth>(
  key: K,
  locale: Locale
): (typeof auth)[K]["sv"] | (typeof auth)[K]["en"] {
  const block = auth[key];
  return locale === "en" ? block.en : block.sv;
}

export function getShop<K extends keyof typeof shop>(
  key: K,
  locale: Locale
): (typeof shop)[K]["sv"] | (typeof shop)[K]["en"] {
  const block = shop[key];
  return locale === "en" ? block.en : block.sv;
}

export function getPreview(locale: Locale) {
  return preview[locale];
}

export function getPages() {
  return pages;
}

/** Locale copy for a marketing page key. */
export function getPage<K extends keyof typeof pages>(
  key: K,
  locale: Locale
): (typeof pages)[K]["sv"] | (typeof pages)[K]["en"] {
  const block = pages[key];
  return locale === "en" ? block.en : block.sv;
}

export type ProductSlug = keyof typeof products;

/** All product copy for a locale, keyed by slug. */
export function getProducts(
  locale: Locale
): Record<ProductSlug, ProductCopy> {
  return {
    shampoo: products.shampoo[locale],
    conditioner: products.conditioner[locale],
    "body-wash": products["body-wash"][locale],
    paket: products.paket[locale],
  };
}

export function getProduct(
  slug: ProductSlug,
  locale: Locale
): ProductCopy {
  return products[slug][locale];
}

export function getProductListingExtras(
  slug: ProductSlug,
  locale: Locale
) {
  return productListingExtras[slug][locale];
}

export function isProductSlug(value: string): value is ProductSlug {
  return value in products;
}
