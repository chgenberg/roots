import { sql } from "drizzle-orm";
import { customerOrders } from "@roots/db/schema";

/**
 * Varuvärdet på en order i öre: det kunden betalat för varor och inte fått
 * tillbaka. Frakten ingår aldrig, eftersom föreningens andel bara räknas på
 * varorna, och en återbetalning drar bara ner varuvärdet med den del som
 * inte var frakt.
 *
 * All summering av försäljning (avräkning, förtjänst, topplistor, mål) går
 * via det här uttrycket, så att siffrorna i dashboards och utbetalningen
 * alltid räknas på samma underlag. Motsvarar `goodsNetOre` i @roots/contracts.
 */
export const goodsOreSql = sql<number>`GREATEST(${customerOrders.totalOre} - ${customerOrders.shippingOre} - GREATEST(${customerOrders.refundedOre} - ${customerOrders.refundedShippingOre}, 0), 0)`;

/** Summan av varuvärdet för de ordrar frågan omfattar. */
export const goodsSumSql = sql<number>`COALESCE(SUM(${goodsOreSql}), 0)`;
