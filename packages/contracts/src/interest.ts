/** Intresseanmälan på förhandsgrinden. Samma värden i formuläret och API:t. */
export const INTEREST_CUSTOMER_TYPES = [
  "forening",
  "lag",
  "grundskola",
  "gymnasium",
] as const;
export type InterestCustomerType = (typeof INTEREST_CUSTOMER_TYPES)[number];

export const INTEREST_INTENTS = ["start", "info"] as const;
export type InterestIntent = (typeof INTEREST_INTENTS)[number];

/**
 * Svenska mobilnummer i valfri form ("070-123 45 67", "+46 70 123 45 67",
 * "0046701234567") blir "+46701234567". Utländska nummer med + behålls.
 * Null när det inte går att läsa som ett telefonnummer.
 */
export function normalizeInterestPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s\-().]*$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `46${digits.slice(1)}`;
  if (!digits.startsWith("46")) return null;
  const national = digits.slice(2);
  if (national.length < 7 || national.length > 10) return null;
  return `+${digits}`;
}
