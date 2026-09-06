import { eq, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations, payouts } from "@roots/db/schema";
import type { DomainId } from "./graph";
import { isEmailPaused } from "./probes";

export async function readPulse(): Promise<Partial<Record<DomainId, number>>> {
  const pulse: Partial<Record<DomainId, number>> = {};
  pulse.email = isEmailPaused() ? 1 : 0;
  try {
    const [payout] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(payouts)
      .where(eq(payouts.status, "PENDING"));
    pulse.money = payout?.n ?? 0;
  } catch {
    /* schema or db unavailable */
  }
  try {
    const [orgs] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(organizations)
      .where(eq(organizations.verified, false));
    pulse.admin = orgs?.n ?? 0;
  } catch {
    /* schema or db unavailable */
  }
  return pulse;
}
