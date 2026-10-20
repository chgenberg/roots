import { lt } from "drizzle-orm";
import { db } from "@roots/db";
import { trafficEvents } from "@roots/db/schema";

/**
 * Besöksstatistiken behövs för att se vad som händer nu och de senaste
 * veckorna, inte som arkiv. 90 dagar är också vad integritetspolicyn lovar.
 */
export const TRAFFIC_RETENTION_DAYS = 90;

export async function purgeOldTrafficEvents(): Promise<{ deleted: number; cutoff: string }> {
  const cutoff = new Date(Date.now() - TRAFFIC_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(trafficEvents)
    .where(lt(trafficEvents.createdAt, cutoff))
    .returning({ id: trafficEvents.id });
  return { deleted: deleted.length, cutoff: cutoff.toISOString() };
}
