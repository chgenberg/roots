/**
 * Centralised legal / company identity used across the site and emails.
 *
 * Keep this in one place so:
 * - JSON-LD (Organization / Product), footer, checkout receipt and legal
 *   pages all quote the same values.
 * - Updating VAT-ID, Fortnox address or phone number is a single edit.
 *
 * Values intentionally live in code (not env) because they are public and
 * should never silently differ between environments.
 */

export const LEGAL_IDENTITY = {
  legalName: "Roots Nordic AB",
  tradingName: "Roots",
  orgNumber: "559517-3210",
  vatId: "SE559517321001",
  address: {
    street: "Storgatan 1",
    postalCode: "111 51",
    city: "Stockholm",
    country: "Sverige",
    countryCode: "SE",
  },
  contact: {
    email: "hej@roots.se",
    phone: "+46 8 000 000 00",
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
