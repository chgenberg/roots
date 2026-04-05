import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@roots/db";
import {
  campaigns,
  teams,
  customerOrders,
  payouts,
} from "@roots/db/schema";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { getInvoiceProvider } from "../lib/invoicing";
import type { SessionData } from "../lib/session";
import { childLogger } from "../lib/logger";

const log = childLogger("settlement");

export const settlement = new Hono();

function getSessionId(c: any): string | null {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

async function requireAdmin(c: any): Promise<SessionData | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;
  try {
    const session = await getSession(sessionId);
    if (
      !session ||
      (session.role !== "ASSOCIATION_ADMIN" && session.role !== "INTERNAL_ADMIN")
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

settlement.post("/generate/:campaignId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  const campaignId = c.req.param("campaignId");

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return c.json({ error: "Kampanj hittades inte" }, 404);
    }

    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas för denna kampanj" }, 403);
    }

    if (campaign.status !== "ENDED") {
      return c.json({ error: "Kampanjen måste vara avslutad innan avräkning kan genereras" }, 400);
    }

    const teamList = await db
      .select()
      .from(teams)
      .where(eq(teams.campaignId, campaignId));

    const results = await db.transaction(async (tx) => {
      const txResults: Array<Record<string, unknown>> = [];

      for (const team of teamList) {
        const salesResult = await tx
          .select({
            total: sql<number>`COALESCE(SUM(${customerOrders.totalOre}), 0)`,
          })
          .from(customerOrders)
          .where(
            and(
              eq(customerOrders.teamId, team.id),
              eq(customerOrders.campaignId, campaignId),
              eq(customerOrders.status, "PAID")
            )
          );

        const totalSalesOre = Number(salesResult[0]?.total || 0);
        const marginPercent = campaign.marginPercent;
        const teamShareOre = Math.round(totalSalesOre * (marginPercent / 100));
        const rootsShareOre = totalSalesOre - teamShareOre;

        const [existing] = await tx
          .select()
          .from(payouts)
          .where(
            and(
              eq(payouts.campaignId, campaignId),
              eq(payouts.teamId, team.id)
            )
          )
          .limit(1);

        if (existing) {
          await tx
            .update(payouts)
            .set({
              totalSalesOre,
              rootsShareOre,
              teamShareOre,
              updatedAt: new Date(),
            })
            .where(eq(payouts.id, existing.id));

          txResults.push({ teamId: team.id, teamName: team.name, totalSalesOre, teamShareOre, rootsShareOre, updated: true });
        } else {
          const [payout] = await tx
            .insert(payouts)
            .values({
              campaignId,
              orgId: campaign.orgId,
              teamId: team.id,
              totalSalesOre,
              rootsShareOre,
              teamShareOre,
              status: "PENDING",
            })
            .returning();

          txResults.push({ teamId: team.id, teamName: team.name, totalSalesOre, teamShareOre, rootsShareOre, payoutId: payout.id });
        }
      }

      await tx
        .update(campaigns)
        .set({ status: "SETTLED", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      return txResults;
    });

    return c.json({ ok: true, settlements: results });
  } catch (err: any) {
    log.error({ err }, "Settlement generation failed");
    return c.json({ error: "Avräkning misslyckades" }, 500);
  }
});

settlement.get("/by-campaign/:campaignId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  const campaignId = c.req.param("campaignId");

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return c.json({ error: "Kampanj hittades inte" }, 404);

    if (
      session.role !== "INTERNAL_ADMIN" &&
      campaign.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const payoutList = await db
      .select()
      .from(payouts)
      .where(eq(payouts.campaignId, campaignId));

    const teamList = await db
      .select()
      .from(teams)
      .where(eq(teams.campaignId, campaignId));

    const teamMap = new Map(teamList.map((t) => [t.id, t.name]));

    return c.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        marginPercent: campaign.marginPercent,
      },
      payouts: payoutList.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        teamName: teamMap.get(p.teamId) || "Okänt lag",
        totalSalesOre: p.totalSalesOre,
        rootsShareOre: p.rootsShareOre,
        teamShareOre: p.teamShareOre,
        status: p.status,
        fortnoxInvoiceId: p.fortnoxInvoiceId,
      })),
    });
  } catch (err) {
    log.error({ err }, "Failed to fetch settlement by campaign");
    return c.json({ error: "Kunde inte hämta avräkning" }, 500);
  }
});

settlement.post("/create-invoice/:payoutId", async (c) => {
  const session = await requireAdmin(c);
  if (!session) return c.json({ error: "Behörighet saknas" }, 403);

  const payoutId = c.req.param("payoutId");

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, payoutId))
      .limit(1);

    if (!payout) {
      return c.json({ error: "Utbetalning hittades inte" }, 404);
    }

    if (
      session.role !== "INTERNAL_ADMIN" &&
      payout.orgId !== session.orgId
    ) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const invoiceProvider = getInvoiceProvider();
    const result = await invoiceProvider.createInvoiceFromOrder({
      orderId: payout.id,
      customer: {
        orgId: payout.orgId,
        name: "Roots AB",
        orgNumber: "",
        email: "",
      },
      lines: [
        {
          sku: "SETTLEMENT",
          description: "Föreningsförsäljning — Roots",
          qty: 1,
          unitPriceOre: payout.rootsShareOre,
        },
      ],
      totalOre: payout.rootsShareOre,
    });

    if (result.status === "error" || !result.externalId) {
      return c.json(
        { error: result.message || "Faktura kunde inte skapas hos leverantören" },
        502
      );
    }

    await db
      .update(payouts)
      .set({
        status: "INVOICED",
        fortnoxInvoiceId: result.externalId,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));

    return c.json({ ok: true, invoiceId: result.externalId });
  } catch (err: any) {
    log.error({ err }, "Invoice creation failed");
    return c.json({ error: "Faktura kunde inte skapas" }, 500);
  }
});
