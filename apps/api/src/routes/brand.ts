/**
 * Föreningens profil: logga och färger.
 *
 *   GET /v1/brand/logo/:orgId  — loggan som PNG (publik, syns i shoppen)
 *   GET /v1/brand/org/:orgId   — profilen för redigering
 *   PUT /v1/brand/org/:orgId   — spara { website, color, colors, logo, logoOnDark }
 *
 * Får redigera: intern admin och säljchef för alla föreningar, säljare för
 * föreningar de själva äger, föreningsadmin för sin egen förening.
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations } from "@roots/db/schema";
import type { SessionData } from "../lib/session";
import { isDemoSession } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { auditLog, requestContext } from "../lib/audit";
import { childLogger } from "../lib/logger";
import { resolveUiLocale, uiError } from "../lib/ui-locale";
import { brandErrorKey, loadOrgBrand, parseBrandInput, readOrgLogo, saveOrgBrand } from "../lib/club-brand";

const log = childLogger("brand");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const brand = new Hono();

brand.get("/logo/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  if (!UUID.test(orgId)) return c.body(null, 404);
  const logo = await readOrgLogo(orgId).catch(() => null);
  if (!logo) return c.body(null, 404);
  return new Response(new Uint8Array(logo), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
});

async function canEdit(session: SessionData, orgId: string): Promise<"ok" | "forbidden" | "missing"> {
  const [org] = await db
    .select({ id: organizations.id, assignedAsmUserId: organizations.assignedAsmUserId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return "missing";
  switch (session.role) {
    case "INTERNAL_ADMIN":
    case "SALES_ADMIN":
      return "ok";
    case "SALES_REP":
      return org.assignedAsmUserId === session.userId ? "ok" : "forbidden";
    case "ASSOCIATION_ADMIN":
      return session.orgId === orgId ? "ok" : "forbidden";
    default:
      return "forbidden";
  }
}

brand.get("/org/:orgId", async (c) => {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  const orgId = c.req.param("orgId");
  if (!UUID.test(orgId)) return c.json({ error: uiError(locale, "orgNotFound") }, 404);
  const access = await canEdit(session, orgId);
  if (access === "missing") return c.json({ error: uiError(locale, "orgNotFound") }, 404);
  if (access === "forbidden") return c.json({ error: uiError(locale, "permissionDenied") }, 403);

  const [org] = await db
    .select({ website: organizations.website })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return c.json({ website: org?.website ?? null, brand: await loadOrgBrand(orgId) });
});

brand.put("/org/:orgId", async (c) => {
  const locale = resolveUiLocale(c);
  const session = await requireSession(c);
  if (!session) return c.json({ error: uiError(locale, "notLoggedIn") }, 401);
  if (isDemoSession(session)) return c.json({ error: uiError(locale, "permissionDenied") }, 403);
  const orgId = c.req.param("orgId");
  if (!UUID.test(orgId)) return c.json({ error: uiError(locale, "orgNotFound") }, 404);
  const access = await canEdit(session, orgId);
  if (access === "missing") return c.json({ error: uiError(locale, "orgNotFound") }, 404);
  if (access === "forbidden") return c.json({ error: uiError(locale, "permissionDenied") }, 403);

  const parsed = parseBrandInput(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: uiError(locale, brandErrorKey(parsed.error)) }, 400);

  try {
    await saveOrgBrand(orgId, parsed.value, session.userId);
  } catch (err) {
    log.error({ err, orgId }, "brand save failed");
    return c.json({ error: uiError(locale, "couldNotSaveBrand") }, 500);
  }

  void auditLog({
    userId: session.userId,
    action: "organization.brand.updated",
    entityType: "organization",
    entityId: orgId,
    meta: {
      ...requestContext((n) => c.req.header(n)),
      color: parsed.value.color,
      logo: parsed.value.logo === undefined ? "kept" : parsed.value.logo ? "set" : "removed",
    },
  });

  return c.json({ brand: await loadOrgBrand(orgId) });
});
