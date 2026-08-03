import { lt, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { hairAnalysisLeads } from "@roots/db/schema";
import { childLogger } from "./logger";

const log = childLogger("lead-retention");

/**
 * Retention för håranalys-leads.
 *
 * Leads sparades tills vidare, utan raderingsväg. En e-postadress som lämnas
 * för att få ett hårresultat är inte ett kundförhållande, och GDPR:s
 * lagringsminimering betyder att den ska bort när syftet är uppfyllt.
 *
 * 24 månader är default (ett marknadsföringssamtycke brukar anses färskt
 * inom två år). Konfigurerbart via HAIR_LEAD_RETENTION_DAYS.
 */
const DEFAULT_RETENTION_DAYS = 730;

export function leadRetentionDays(): number {
  const raw = Number(process.env.HAIR_LEAD_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS;
}

export interface LeadPurgeResult {
  deleted: number;
  retentionDays: number;
  cutoff: string;
}

export async function purgeExpiredHairAnalysisLeads(): Promise<LeadPurgeResult> {
  const retentionDays = leadRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deletedRows = await db
    .delete(hairAnalysisLeads)
    .where(lt(hairAnalysisLeads.createdAt, cutoff))
    .returning({ id: hairAnalysisLeads.id });

  const deleted = deletedRows.length;
  if (deleted > 0) {
    log.info({ deleted, retentionDays }, "purged expired hair-analysis leads");
  }

  return { deleted, retentionDays, cutoff: cutoff.toISOString() };
}

/**
 * Radera en enskild lead på begäran (GDPR art. 17). Matchar på e-post
 * eftersom det är allt den som mejlar oss känner till.
 */
export async function deleteHairAnalysisLeadsByEmail(
  email: string
): Promise<number> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return 0;
  const rows = await db
    .delete(hairAnalysisLeads)
    .where(sql`lower(${hairAnalysisLeads.email}) = ${normalized}`)
    .returning({ id: hairAnalysisLeads.id });
  return rows.length;
}
