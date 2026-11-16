import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { LOCKED_MARGIN_PERCENT, REVENUE_ORDER_STATUSES } from "@roots/contracts";
import { db } from "@roots/db";
import { customerOrders, payouts } from "@roots/db/schema";
import { goodsOreSql, goodsSumSql } from "../order-money";

/** `db` eller en öppen transaktion. */
type Executor = Pick<typeof db, "select" | "update">;

export interface TeamSettlement {
  /** Lagets försäljning: varuvärde som är betalt och inte återbetalt. */
  totalSalesOre: number;
  /** Föreningens andel, räknad per order med marginalen som gällde då. */
  teamShareOre: number;
  rootsShareOre: number;
  /** Manuella ordrar som ingen bekräftat än, och därför står utanför. */
  unverifiedManualOre: number;
  unverifiedManualCount: number;
}

/**
 * Vad ett lag ska ha för en kampanj, räknat på ordrarna som de ser ut nu.
 *
 * Avräkningen, omräkningen efter en återbetalning och kontrollen av redan
 * betalda utbetalningar använder alla den här funktionen. Skulle de räkna
 * var för sig kan en utbetalning och dess underlag glida isär.
 *
 *   1. Betald räknas via REVENUE_ORDER_STATUSES, inte bara `PAID`:
 *      leveransstatus skriver över betalstatus i samma kolumn.
 *   2. Manuella ordrar räknas bara när lagledare eller föreningsadmin
 *      bekräftat dem.
 *   3. Andelen räknas per order med den marginal som gällde när ordern
 *      lades, inte med kampanjens nuvarande.
 *   4. Underlaget är varuvärdet: frakt ingår aldrig, och återbetalda varor
 *      är borträknade (se `goodsOreSql`).
 */
export async function computeTeamSettlement(
  executor: Executor,
  campaignId: string,
  teamId: string
): Promise<TeamSettlement> {
  const [sales] = await executor
    .select({
      total: goodsSumSql,
      teamShare: sql<number>`COALESCE(SUM(ROUND(${goodsOreSql} * COALESCE(${customerOrders.marginPercentAtSale}, ${LOCKED_MARGIN_PERCENT})::numeric / 100)), 0)`,
    })
    .from(customerOrders)
    .where(
      and(
        eq(customerOrders.teamId, teamId),
        eq(customerOrders.campaignId, campaignId),
        inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
        sql`(${customerOrders.isManual} = false OR ${customerOrders.verifiedAt} IS NOT NULL)`
      )
    );

  const [pending] = await executor
    .select({
      total: goodsSumSql,
      count: sql<number>`COUNT(*)`,
    })
    .from(customerOrders)
    .where(
      and(
        eq(customerOrders.teamId, teamId),
        eq(customerOrders.campaignId, campaignId),
        inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
        eq(customerOrders.isManual, true),
        isNull(customerOrders.verifiedAt)
      )
    );

  const totalSalesOre = Number(sales?.total || 0);
  const teamShareOre = Number(sales?.teamShare || 0);
  return {
    totalSalesOre,
    teamShareOre,
    rootsShareOre: totalSalesOre - teamShareOre,
    unverifiedManualOre: Number(pending?.total || 0),
    unverifiedManualCount: Number(pending?.count || 0),
  };
}

export type PayoutAdjustment =
  /** Ingen utbetalning berördes: kampanjen är inte avräknad, eller så ändrades inte lagets andel. */
  | { kind: "none" }
  /** Utbetalningen väntade och har räknats om. */
  | {
      kind: "recalculated";
      payoutId: string;
      before: { totalSalesOre: number; teamShareOre: number; rootsShareOre: number };
      after: { totalSalesOre: number; teamShareOre: number; rootsShareOre: number };
    }
  /** Utbetalningen är fakturerad eller betald. Den rörs inte, bara flaggas. */
  | {
      kind: "flagged";
      payoutId: string;
      payoutStatus: "INVOICED" | "PAID";
      paidTeamShareOre: number;
      correctTeamShareOre: number;
      /** Hur mycket för mycket föreningen har fått totalt (aldrig negativt). */
      overpaidOre: number;
      /** Hur mycket den här ändringen lade till. */
      addedOre: number;
    };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Avräkning, återbetalning och avbokning rör samma summor för en kampanj
 * och får inte köra om varandra. Utan låset kan en avräkning summera lagets
 * ordrar precis innan en återbetalning sparas och sedan skapa utbetalningen
 * efter att återbetalningen letat efter den: då bär utbetalningen ett belopp
 * som ingen räknar om.
 *
 * Låset släpps när transaktionen avslutas. Efter det ser nästa transaktion
 * den förras sparade ändringar.
 */
export async function lockCampaignSettlement(tx: Tx, campaignId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`roots:settlement:${campaignId}`}))`
  );
}

/**
 * Håller lagets utbetalning i takt med ordrarna när en order återbetalas
 * eller avbokas.
 *
 * Används i två steg i samma transaktion som orderändringen:
 *
 *   const payout = await beginPayoutAdjustment(tx, { campaignId, teamId, orderId });
 *   ... ändra ordern ...
 *   const effect = await payout.finish();
 *
 * Första steget låser kampanjens avräkning och utbetalningsraden och räknar
 * fram vad laget ska ha före ändringen. `finish` räknar om och jämför.
 *
 * Väntar utbetalningen (PENDING) skrivs de nya beloppen in direkt. Är den
 * fakturerad eller betald har pengar eller en faktura redan lämnat oss; då
 * ändras ingenting av belopp, status eller betaluppgifter. Raden får i
 * stället en flagga, och bara om just den här ändringen flyttade lagets
 * andel. En återbetalning av enbart frakt rör inte andelen och flaggar
 * därför inte, och en tidigare kvittering ligger kvar så att det syns vad
 * som redan är reglerat.
 */
export async function beginPayoutAdjustment(
  tx: Tx,
  change: { campaignId: string; teamId: string; orderId: string }
): Promise<{ finish: () => Promise<PayoutAdjustment> }> {
  const { campaignId, teamId, orderId } = change;
  await lockCampaignSettlement(tx, campaignId);
  const [payout] = await tx
    .select()
    .from(payouts)
    .where(and(eq(payouts.campaignId, campaignId), eq(payouts.teamId, teamId)))
    .for("update")
    .limit(1);
  if (!payout) {
    // Inte avräknad än. Avräkningen räknar rätt när den körs, och låset
    // ovan gör att den inte kan köras samtidigt som den här ändringen.
    return { finish: async () => ({ kind: "none" }) };
  }

  // Vad just den här ordern bidrar med till lagets andel, före ändringen.
  // Jämförelsen görs på ordern och inte på lagets summa, så att en annan
  // order som blir betald under tiden inte kan dölja eller hitta på en
  // avvikelse.
  const before = await orderTeamShare(tx, orderId);

  return {
    finish: async () => {
      const after = await orderTeamShare(tx, orderId);
      const current = await computeTeamSettlement(tx, campaignId, teamId);

      if (payout.status === "PENDING") {
        const stored =
          payout.totalSalesOre === current.totalSalesOre &&
          payout.teamShareOre === current.teamShareOre &&
          payout.rootsShareOre === current.rootsShareOre;
        if (stored) return { kind: "none" };
        await tx
          .update(payouts)
          .set({
            totalSalesOre: current.totalSalesOre,
            teamShareOre: current.teamShareOre,
            rootsShareOre: current.rootsShareOre,
            updatedAt: new Date(),
          })
          .where(and(eq(payouts.id, payout.id), eq(payouts.status, "PENDING")));
        return {
          kind: "recalculated",
          payoutId: payout.id,
          before: {
            totalSalesOre: payout.totalSalesOre,
            teamShareOre: payout.teamShareOre,
            rootsShareOre: payout.rootsShareOre,
          },
          after: {
            totalSalesOre: current.totalSalesOre,
            teamShareOre: current.teamShareOre,
            rootsShareOre: current.rootsShareOre,
          },
        };
      }

      if (after === before) return { kind: "none" };

      // Bara tidpunkten för den nya avvikelsen sätts. Belopp, status,
      // betaluppgifter och en tidigare kvittering lämnas orörda.
      await tx
        .update(payouts)
        .set({ reviewRequiredAt: new Date() })
        .where(eq(payouts.id, payout.id));
      return {
        kind: "flagged",
        payoutId: payout.id,
        payoutStatus: payout.status as "INVOICED" | "PAID",
        paidTeamShareOre: payout.teamShareOre,
        correctTeamShareOre: current.teamShareOre,
        overpaidOre: Math.max(0, payout.teamShareOre - current.teamShareOre),
        addedOre: Math.max(0, before - after),
      };
    },
  };
}

/**
 * En enskild orders bidrag till lagets andel, med samma regler som
 * `computeTeamSettlement`: bara betalda ordrar, manuella bara när de är
 * bekräftade, varuvärdet utan frakt och återbetalt.
 */
async function orderTeamShare(tx: Tx, orderId: string): Promise<number> {
  const [row] = await tx
    .select({
      share: sql<number>`COALESCE(SUM(ROUND(${goodsOreSql} * COALESCE(${customerOrders.marginPercentAtSale}, ${LOCKED_MARGIN_PERCENT})::numeric / 100)), 0)`,
    })
    .from(customerOrders)
    .where(
      and(
        eq(customerOrders.id, orderId),
        inArray(customerOrders.status, REVENUE_ORDER_STATUSES),
        sql`(${customerOrders.isManual} = false OR ${customerOrders.verifiedAt} IS NOT NULL)`
      )
    );
  return Number(row?.share || 0);
}

/**
 * Läget för flaggan på en låst utbetalning: vad som är utbetalt, vad som
 * vore rätt i dag och hur mycket av mellanskillnaden som återstår att
 * reglera sedan den senaste kvitteringen.
 */
export function payoutReviewState(
  payout: {
    teamShareOre: number;
    reviewRequiredAt: Date | null;
    reviewResolvedAt: Date | null;
    reviewResolvedTeamShareOre: number | null;
  },
  current: { teamShareOre: number; totalSalesOre: number }
) {
  const needsReview =
    !!payout.reviewRequiredAt &&
    (!payout.reviewResolvedAt ||
      payout.reviewResolvedAt.getTime() < payout.reviewRequiredAt.getTime());
  const overpaidOre = Math.max(0, payout.teamShareOre - current.teamShareOre);
  const settledBaselineOre = payout.reviewResolvedTeamShareOre ?? payout.teamShareOre;
  return {
    needsReview,
    correctTeamShareOre: current.teamShareOre,
    correctTotalSalesOre: current.totalSalesOre,
    /** Total mellanskillnad mot det som betalats ut. */
    overpaidOre,
    /** Det som tillkommit sedan senaste kvitteringen och återstår att reglera. */
    outstandingOre: Math.max(0, settledBaselineOre - current.teamShareOre),
    /** Det som redan reglerats enligt tidigare kvittering. */
    settledOre: Math.max(0, payout.teamShareOre - settledBaselineOre),
  };
}
