import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { sellers, teams, campaigns } from "@roots/db/schema";
import { getInviteTemplate, getShopShareTemplate } from "../lib/communication-templates";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";
import { resolveUiLocale, uiError } from "../lib/ui-locale";

const log = childLogger("sharing");

export const sharing = new Hono();

sharing.get("/invite-template/:teamId", async (c) => {
  const session = await requireSession(c);
  const locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  const teamId = c.req.param("teamId");

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return c.json({ error: uiError(locale, "teamNotFoundShort") }, 404);

    const hasAccess =
      session.role === "INTERNAL_ADMIN" ||
      (session.role === "ASSOCIATION_ADMIN" && session.orgId === team.orgId) ||
      (session.role === "TEAM_LEADER" && team.leaderId === session.userId);

    if (!hasAccess) {
      return c.json({ error: uiError(locale, "permissionDenied") }, 403);
    }

    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, team.campaignId)).limit(1);

    const template = getInviteTemplate({
      teamName: team.name,
      campaignName: campaign?.name || "",
      story: campaign?.story || "",
      inviteToken: team.inviteToken,
      leaderName: locale === "en" ? "Team leader" : "Lagansvarig",
      locale,
    });

    return c.json(template);
  } catch (err) {
    log.error({ err }, "Failed to fetch invite template");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});

sharing.get("/shop-share-template", async (c) => {
  const session = await requireSession(c);
  const locale = resolveUiLocale(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);

  try {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.userId, session.userId))
      .limit(1);

    if (!seller) return c.json({ error: uiError(locale, "noSellerProfile") }, 404);

    const [team] = await db.select().from(teams).where(eq(teams.id, seller.teamId)).limit(1);
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, seller.campaignId)).limit(1);

    const template = getShopShareTemplate({
      sellerName: seller.displayName,
      shopSlug: seller.shopSlug,
      teamName: team?.name || "",
      story: campaign?.story || "",
      locale,
    });

    return c.json(template);
  } catch (err) {
    log.error({ err }, "Failed to fetch shop share template");
    return c.json({ error: uiError(locale, "couldNotFetchData") }, 500);
  }
});
