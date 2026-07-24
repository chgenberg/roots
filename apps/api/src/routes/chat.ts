/**
 * In-app-chatt mellan lagledare och säljare (team_messages).
 *
 * Trådmodell:
 *   - En "tråd" identifieras av (teamId, sellerId).
 *   - Meddelanden med recipient_seller_id = sellerId tillhör den privata
 *     tråden mellan lagledaren och säljaren (båda riktningar).
 *   - Meddelanden med recipient_seller_id = NULL är broadcast från
 *     lagledaren till hela laget (alla säljare ser dem).
 *
 * Behörighet:
 *   - SELLER ser sin egen privata tråd + broadcasts, kan skriva till sin
 *     lagledare (recipient = sin egen sellerId).
 *   - TEAM_LEADER ser/skriver i alla trådar i sitt lag samt broadcast.
 *   - ASSOCIATION_ADMIN (samma org) och INTERNAL_ADMIN har läs-/skrivinsyn.
 */

import { Hono } from "hono";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { teamMessages, teams, sellers } from "@roots/db/schema";
import { isDemoSession } from "../lib/session";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";

const log = childLogger("chat");

export const chat = new Hono();

const MAX_BODY = 4000;
const PAGE = 100;

function leaderHasTeamAccess(
  session: SessionData,
  team: { orgId: string; leaderId: string }
): boolean {
  return (
    session.role === "INTERNAL_ADMIN" ||
    (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
    (session.role === "TEAM_LEADER" && team.leaderId === session.userId)
  );
}

/* --------------------------- SÄLJAR-VYN ---------------------------- */

/** Säljarens egen tråd + broadcasts, äldst först. */
chat.get("/seller", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);
    if (!seller) return c.json({ error: "Ingen säljar-profil" }, 404);

    const msgs = await db
      .select()
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.teamId, seller.teamId),
          or(
            eq(teamMessages.recipientSellerId, seller.id),
            isNull(teamMessages.recipientSellerId)
          )
        )
      )
      .orderBy(asc(teamMessages.createdAt))
      .limit(PAGE);

    return c.json({
      sellerId: seller.id,
      teamId: seller.teamId,
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        fromMe: m.senderUserId === session.userId,
        isBroadcast: m.recipientSellerId === null,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "seller chat fetch failed");
    return c.json({ error: "Kunde inte hämta meddelanden" }, 500);
  }
});

/** Säljaren skickar ett meddelande till sin lagledare. */
chat.post("/seller", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: "Demoläget kan inte skicka meddelanden." }, 403);
  }

  let body: { body?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }
  const text = (body.body ?? "").trim();
  if (!text) return c.json({ error: "Meddelandet är tomt." }, 400);
  if (text.length > MAX_BODY) {
    return c.json({ error: "Meddelandet är för långt." }, 400);
  }

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);
    if (!seller) return c.json({ error: "Ingen säljar-profil" }, 404);

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, seller.teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);

    const [msg] = await db
      .insert(teamMessages)
      .values({
        orgId: team.orgId,
        teamId: seller.teamId,
        senderUserId: session.userId,
        recipientSellerId: seller.id,
        body: text,
      })
      .returning();

    return c.json({
      ok: true,
      message: {
        id: msg.id,
        body: msg.body,
        fromMe: true,
        isBroadcast: false,
        readAt: null,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    log.error({ err }, "seller chat send failed");
    return c.json({ error: "Kunde inte skicka meddelandet" }, 500);
  }
});

/** Säljaren markerar sin tråd som läst. */
chat.post("/seller/read", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);
    if (!seller) return c.json({ error: "Ingen säljar-profil" }, 404);

    await db
      .update(teamMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(teamMessages.teamId, seller.teamId),
          or(
            eq(teamMessages.recipientSellerId, seller.id),
            isNull(teamMessages.recipientSellerId)
          ),
          sql`${teamMessages.senderUserId} <> ${session.userId}`,
          isNull(teamMessages.readAt)
        )
      );
    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "seller chat read failed");
    return c.json({ error: "Kunde inte uppdatera lässtatus" }, 500);
  }
});

/* --------------------------- LAGLEDAR-VYN -------------------------- */

/** Lista alla säljar-trådar i ett lag med oläst-räknare. */
chat.get("/team/:teamId/threads", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  const teamId = c.req.param("teamId");

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);
    if (!leaderHasTeamAccess(session, team)) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const sellerList = await db
      .select({
        id: sellers.id,
        displayName: sellers.displayName,
      })
      .from(sellers)
      .where(eq(sellers.teamId, teamId));

    // Oläst per säljar-tråd (meddelanden från säljaren som ledaren ej läst).
    const unreadRows = await db
      .select({
        sellerId: teamMessages.recipientSellerId,
        unread: sql<number>`COUNT(*)`,
        lastAt: sql<string>`MAX(${teamMessages.createdAt})`,
      })
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.teamId, teamId),
          sql`${teamMessages.recipientSellerId} IS NOT NULL`,
          sql`${teamMessages.senderUserId} <> ${session.userId}`,
          isNull(teamMessages.readAt)
        )
      )
      .groupBy(teamMessages.recipientSellerId);

    const unreadMap = new Map(
      unreadRows.map((r) => [r.sellerId, Number(r.unread)])
    );

    return c.json({
      teamId,
      threads: sellerList.map((s) => ({
        sellerId: s.id,
        displayName: s.displayName,
        unread: unreadMap.get(s.id) ?? 0,
      })),
    });
  } catch (err) {
    log.error({ err }, "leader threads fetch failed");
    return c.json({ error: "Kunde inte hämta trådar" }, 500);
  }
});

/** Meddelanden i en specifik säljar-tråd (för lagledaren). */
chat.get("/team/:teamId/seller/:sellerId", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  const teamId = c.req.param("teamId");
  const sellerId = c.req.param("sellerId");

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);
    if (!leaderHasTeamAccess(session, team)) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    const msgs = await db
      .select()
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.teamId, teamId),
          eq(teamMessages.recipientSellerId, sellerId)
        )
      )
      .orderBy(asc(teamMessages.createdAt))
      .limit(PAGE);

    return c.json({
      teamId,
      sellerId,
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        fromMe: m.senderUserId === session.userId,
        isBroadcast: false,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "leader thread fetch failed");
    return c.json({ error: "Kunde inte hämta meddelanden" }, 500);
  }
});

/**
 * Lagledaren skickar ett meddelande.
 *   body.recipientSellerId = sellerId → privat tråd
 *   body.recipientSellerId = null/utelämnat → broadcast till hela laget
 */
chat.post("/team/:teamId", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (isDemoSession(session)) {
    return c.json({ error: "Demoläget kan inte skicka meddelanden." }, 403);
  }
  const teamId = c.req.param("teamId");

  let body: { body?: string; recipientSellerId?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }
  const text = (body.body ?? "").trim();
  if (!text) return c.json({ error: "Meddelandet är tomt." }, 400);
  if (text.length > MAX_BODY) {
    return c.json({ error: "Meddelandet är för långt." }, 400);
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);
    if (!leaderHasTeamAccess(session, team)) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    let recipientSellerId: string | null = null;
    if (body.recipientSellerId) {
      const [recipient] = await db
        .select({ id: sellers.id })
        .from(sellers)
        .where(
          and(
            eq(sellers.id, body.recipientSellerId),
            eq(sellers.teamId, teamId)
          )
        )
        .limit(1);
      if (!recipient) {
        return c.json({ error: "Mottagaren tillhör inte laget." }, 400);
      }
      recipientSellerId = recipient.id;
    }

    const [msg] = await db
      .insert(teamMessages)
      .values({
        orgId: team.orgId,
        teamId,
        senderUserId: session.userId,
        recipientSellerId,
        body: text,
      })
      .returning();

    return c.json({
      ok: true,
      message: {
        id: msg.id,
        body: msg.body,
        fromMe: true,
        isBroadcast: recipientSellerId === null,
        readAt: null,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    log.error({ err }, "leader chat send failed");
    return c.json({ error: "Kunde inte skicka meddelandet" }, 500);
  }
});

/** Lagledaren markerar en säljar-tråd som läst. */
chat.post("/team/:teamId/read", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  const teamId = c.req.param("teamId");

  let body: { sellerId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON i request body." }, 400);
  }
  const sellerId = (body.sellerId ?? "").trim();
  if (!sellerId) return c.json({ error: "sellerId krävs" }, 400);

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return c.json({ error: "Lag hittades inte" }, 404);
    if (!leaderHasTeamAccess(session, team)) {
      return c.json({ error: "Behörighet saknas" }, 403);
    }

    await db
      .update(teamMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(teamMessages.teamId, teamId),
          eq(teamMessages.recipientSellerId, sellerId),
          sql`${teamMessages.senderUserId} <> ${session.userId}`,
          isNull(teamMessages.readAt)
        )
      );
    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "leader chat read failed");
    return c.json({ error: "Kunde inte uppdatera lässtatus" }, 500);
  }
});
