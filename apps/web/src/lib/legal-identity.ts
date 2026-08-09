/**
 * Centralised legal / company identity used across the site and emails.
 *
 * Keep this in one place so:
 * - JSON-LD (Organization / Product), footer, checkout receipt and legal
 *   pages all quote the same values.
 * - Updating address or contact email is a single edit.
 *
 * Values intentionally live in code (not env) because they are public and
 * should never silently differ between environments.
 */

export const LEGAL_IDENTITY = {
  legalName: "Ourroots AB",
  tradingName: "Roots",
  orgNumber: "559355-7126",
  address: {
    street: "Hallängsvägen 8",
    postalCode: "439 55",
    city: "Åsa",
    country: "Sverige",
    countryCode: "SE",
  },
  contact: {
    email: "info@roots.nu",
    /** Omit until a real public phone number is published. */
    phone: null as string | null,
  },
  social: {
    instagram: "https://www.instagram.com/roots.nordic",
    linkedin: "https://www.linkedin.com/company/roots-nordic",
  },
} as const;

export function formatAddressSingleLine(): string {
  const a = LEGAL_IDENTITY.address;
  return `${a.street}, ${a.postalCode} ${a.city}, ${a.country}`;
}
