import { z } from "zod";

/**
 * Frakt vid hemleverans. Kunden betalar frakten, och beloppen är en
 * inställning som bara Roots sätter (`platform_settings`, nyckel `shipping`).
 *
 * `homeDeliveryFeeOre = null` betyder att ingen avgift är bestämd. Då går
 * hemleverans inte att välja, så att den aldrig blir gratis av misstag. Fri
 * hemleverans är ett uttryckligt val: avgiften 0.
 */
export interface ShippingSettings {
  /** Fraktavgift i öre inklusive moms. null = inte bestämd, hemleverans stängd. */
  homeDeliveryFeeOre: number | null;
  /** Varuvärde i öre från vilket frakten är fri. null = ingen fri frakt. */
  freeShippingThresholdOre: number | null;
}

export const SHIPPING_SETTINGS_UNSET: ShippingSettings = {
  homeDeliveryFeeOre: null,
  freeShippingThresholdOre: null,
};

export const MAX_SHIPPING_FEE_ORE = 100_000;
export const MAX_FREE_SHIPPING_THRESHOLD_ORE = 10_000_000;

// Hela kronor. Kassan visar belopp utan ören, så en avgift på 49,50 kr hade
// visats som 50 kr och dragits som 49,50.
export const ShippingSettingsSchema = z.object({
  homeDeliveryFeeOre: z
    .number()
    .int()
    .min(0)
    .max(MAX_SHIPPING_FEE_ORE)
    .multipleOf(100)
    .nullable(),
  freeShippingThresholdOre: z
    .number()
    .int()
    .min(100)
    .max(MAX_FREE_SHIPPING_THRESHOLD_ORE)
    .multipleOf(100)
    .nullable(),
});

/** Läser en sparad inställning. Allt som inte är ett giltigt värde räknas som inte bestämt. */
export function parseShippingSettings(raw: unknown): ShippingSettings {
  const parsed = ShippingSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...SHIPPING_SETTINGS_UNSET };
}

export function isHomeDeliveryAvailable(settings: ShippingSettings): boolean {
  return settings.homeDeliveryFeeOre !== null;
}

/**
 * Frakten för en order. Kassan och API:t räknar med samma funktion, så att
 * kunden ser exakt det belopp som sedan dras.
 *
 * Gränsen jämförs mot varuvärdet (utan frakt): når varorna gränsen är frakten
 * fri. Returnerar null när hemleverans inte går att välja.
 */
export function shippingOreForOrder(
  settings: ShippingSettings,
  order: { deliveryType: "BULK" | "DIRECT"; goodsOre: number }
): number | null {
  if (order.deliveryType !== "DIRECT") return 0;
  if (settings.homeDeliveryFeeOre === null) return null;
  if (
    settings.freeShippingThresholdOre !== null &&
    order.goodsOre >= settings.freeShippingThresholdOre
  ) {
    return 0;
  }
  return settings.homeDeliveryFeeOre;
}

/** Hur mycket mer kunden behöver handla för att nå fri frakt. null = ingen gräns eller redan nådd. */
export function oreLeftToFreeShipping(
  settings: ShippingSettings,
  goodsOre: number
): number | null {
  if (settings.homeDeliveryFeeOre === null || settings.homeDeliveryFeeOre === 0) return null;
  if (settings.freeShippingThresholdOre === null) return null;
  const left = settings.freeShippingThresholdOre - goodsOre;
  return left > 0 ? left : null;
}

/**
 * Varuvärdet som föreningens andel räknas på: det kunden betalat för varor
 * och inte fått tillbaka. Frakt ingår aldrig.
 */
export function goodsNetOre(order: {
  totalOre: number;
  shippingOre: number;
  refundedOre?: number | null;
  refundedShippingOre?: number | null;
}): number {
  const refundedGoods = (order.refundedOre ?? 0) - (order.refundedShippingOre ?? 0);
  return Math.max(0, order.totalOre - order.shippingOre - Math.max(0, refundedGoods));
}
