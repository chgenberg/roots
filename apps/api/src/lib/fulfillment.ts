import { countsAsRevenue } from "@roots/contracts";

/**
 * Spärrarna för leveransstatus, delade av knappen på en enskild order och
 * gruppmarkeringen i lagervyn. De ska vara samma på båda ställena: en spärr
 * som bara finns på den ena vägen är ingen spärr.
 */

export type FulfillmentTarget = "SHIPPED" | "DELIVERED" | "PAID";

export type FulfillmentRefusal =
  /** Avbokad, återbetald eller misslyckad: ordern är stängd. */
  | "closed"
  /** Ordern är inte betald. */
  | "not_paid";

/**
 * Varför leveransstatus inte får ändras på ordern, eller null om det går.
 *
 * En stängd order får aldrig tillbaka en status som räknas som betald: då
 * hade "ångra leveransmarkering" kunnat återuppliva pengar som redan lämnat
 * systemet. Och bara en betald order kan skickas, annars kunde en obetald
 * order bli betald den vägen och räknas in i avräkningen.
 */
export function fulfillmentRefusal(order: { status: string }): FulfillmentRefusal | null {
  if (
    order.status === "CANCELLED" ||
    order.status === "REFUNDED" ||
    order.status === "FAILED"
  ) {
    return "closed";
  }
  if (!countsAsRevenue(order.status)) return "not_paid";
  return null;
}

/** Kolumnerna som ändras när en order flyttas till `status`. */
export function fulfillmentPatch(
  order: { shippedAt: Date | null },
  status: FulfillmentTarget,
  now: Date = new Date()
): {
  status: FulfillmentTarget;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  updatedAt: Date;
} {
  if (status === "SHIPPED") {
    return { status, shippedAt: order.shippedAt ?? now, updatedAt: now };
  }
  if (status === "DELIVERED") {
    return { status, shippedAt: order.shippedAt ?? now, deliveredAt: now, updatedAt: now };
  }
  // PAID: ångra leveransmarkeringen.
  return { status, shippedAt: null, deliveredAt: null, updatedAt: now };
}
