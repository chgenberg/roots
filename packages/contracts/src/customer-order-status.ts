/**
 * Vilka statusar på en kundorder (`customer_orders`) som räknas som intäkt.
 *
 * `status` bär två saker samtidigt: om kunden har betalat och hur långt
 * leveransen kommit. När en lagledare markerar en betald order som skickad
 * skrivs `PAID` över med `SHIPPED`, och därefter finns det inget i
 * statusfältet som säger att pengarna kommit in.
 *
 * Det gjorde att varje ställe som summerade försäljning skrev sitt eget
 * `status = 'PAID'` och därmed tappade allt som hunnit levereras. Värst i
 * avräkningen: ett lag som skötte sig och markerade sina ordrar som
 * levererade fick lägre utbetalning än ett lag som lät dem ligga kvar.
 *
 * Listan nedan är därför den enda platsen där gränsen dras. Lägg till en
 * ny status i `customerOrderStatusEnum` och den måste in här också, annars
 * försvinner pengarna tyst igen.
 *
 * Utanför listan, och varför:
 *   DRAFT, PENDING  inte betalda
 *   FAILED          betalningen gick inte igenom
 *   CANCELLED       avbruten
 *   REFUNDED        pengarna är återbetalda till kunden
 */
export type RevenueOrderStatus =
  | "PAID"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED";

// Typad som en vanlig array och inte `as const`: Drizzles `inArray` tar inte
// emot en readonly-tuple, och ett `[...SPREAD]` på varje anropsplats hade
// bara flyttat bruset dit.
export const REVENUE_ORDER_STATUSES: RevenueOrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
];

/**
 * Har kunden betalat för den här ordern?
 *
 * Använd den här i stället för att jämföra mot `"PAID"` närhelst frågan är
 * "ska ordern räknas med i en summa".
 */
export function countsAsRevenue(status: string | null | undefined): boolean {
  return !!status && (REVENUE_ORDER_STATUSES as string[]).includes(status);
}
