import { Hono } from "hono";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { calculatorLinks, calculatorLeads } from "@roots/db/schema";
import {
  CreateCalculatorSchema,
  UpdateCalculatorSchema,
  computeCalculator,
  CalculatorInputsSchema,
  type CalculatorInputs,
} from "@roots/contracts";
import { isDemoSession } from "../lib/session";
import type { SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { childLogger } from "../lib/logger";

const log = childLogger("calculator-admin");

export const calculatorAdmin = new Hono();

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://roots.se"
).replace(/\/$/, "");

const SALES_ROLES = new Set(["SALES_REP", "SALES_ADMIN", "INTERNAL_ADMIN"]);

/** SALES_REP ser bara egna länkar; SALES_ADMIN/INTERNAL_ADMIN ser alla. */
function seesAllLinks(role: string): boolean {
  return role === "SALES_ADMIN" || role === "INTERNAL_ADMIN";
}

function shareUrl(token: string): string {
  return `${SITE_URL}/kalkylator/${token}`;
}

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

// ── Skapa delbar länk ──────────────────────────────────────────────
calculatorAdmin.post("/", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!SALES_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (isDemoSession(session)) {
    return c.json(
      { error: "Demo-konton kan inte skapa delbara länkar." },
      403
    );
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON" }, 400);
  }

  const parsed = CreateCalculatorSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "Ogiltiga fält", issues: parsed.error.flatten() },
      400
    );
  }

  try {
    const token = newToken();
    const [row] = await db
      .insert(calculatorLinks)
      .values({
        token,
        createdByUserId: session.userId,
        associationName: parsed.data.associationName,
        presets: parsed.data.presets,
      })
      .returning();

    return c.json(
      {
        id: row.id,
        token: row.token,
        shareUrl: shareUrl(row.token),
        associationName: row.associationName,
        presets: row.presets,
        viewCount: row.viewCount,
        leadCount: 0,
        createdAt: row.createdAt.toISOString(),
      },
      201
    );
  } catch (err) {
    log.error({ err }, "create calculator link failed");
    return c.json({ error: "Kunde inte skapa länken" }, 500);
  }
});

// ── Lista länkar (med visningar + antal leads) ─────────────────────
calculatorAdmin.get("/", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!SALES_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  try {
    const links = await db
      .select()
      .from(calculatorLinks)
      .where(
        seesAllLinks(session.role)
          ? sql`1=1`
          : eq(calculatorLinks.createdByUserId, session.userId)
      )
      .orderBy(desc(calculatorLinks.createdAt));

    const ids = links.map((l) => l.id);
    const leadCounts = new Map<string, number>();
    if (ids.length > 0) {
      const counts = await db
        .select({
          linkId: calculatorLeads.calculatorLinkId,
          count: sql<number>`count(*)`,
        })
        .from(calculatorLeads)
        .where(inArray(calculatorLeads.calculatorLinkId, ids))
        .groupBy(calculatorLeads.calculatorLinkId);
      for (const row of counts) {
        leadCounts.set(row.linkId, Number(row.count));
      }
    }

    return c.json({
      links: links.map((l) => ({
        id: l.id,
        token: l.token,
        shareUrl: shareUrl(l.token),
        associationName: l.associationName,
        presets: l.presets,
        viewCount: l.viewCount,
        leadCount: leadCounts.get(l.id) ?? 0,
        lastViewedAt: l.lastViewedAt ? l.lastViewedAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error({ err }, "list calculator links failed");
    return c.json({ error: "Kunde inte hämta länkar" }, 500);
  }
});

/** Hämta en länk som tillhör (eller är synlig för) den inloggade. */
async function loadOwnedLink(session: SessionData, id: string) {
  const [link] = await db
    .select()
    .from(calculatorLinks)
    .where(eq(calculatorLinks.id, id))
    .limit(1);
  if (!link) return { link: null as null, forbidden: false };
  if (!seesAllLinks(session.role) && link.createdByUserId !== session.userId) {
    return { link: null as null, forbidden: true };
  }
  return { link, forbidden: false };
}

// ── Uppdatera antaganden/namn ──────────────────────────────────────
calculatorAdmin.patch("/:id", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!SALES_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte ändra länkar." }, 403);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltig JSON" }, 400);
  }
  const parsed = UpdateCalculatorSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "Ogiltiga fält", issues: parsed.error.flatten() },
      400
    );
  }

  const { link, forbidden } = await loadOwnedLink(session, c.req.param("id"));
  if (forbidden) return c.json({ error: "Behörighet saknas" }, 403);
  if (!link) return c.json({ error: "Länken hittades inte" }, 404);

  try {
    const [updated] = await db
      .update(calculatorLinks)
      .set({
        ...(parsed.data.associationName
          ? { associationName: parsed.data.associationName }
          : {}),
        ...(parsed.data.presets ? { presets: parsed.data.presets } : {}),
        updatedAt: new Date(),
      })
      .where(eq(calculatorLinks.id, link.id))
      .returning();

    return c.json({
      id: updated.id,
      token: updated.token,
      shareUrl: shareUrl(updated.token),
      associationName: updated.associationName,
      presets: updated.presets,
      viewCount: updated.viewCount,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    log.error({ err }, "update calculator link failed");
    return c.json({ error: "Kunde inte uppdatera länken" }, 500);
  }
});

// ── Ta bort länk ───────────────────────────────────────────────────
calculatorAdmin.delete("/:id", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!SALES_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  if (isDemoSession(session)) {
    return c.json({ error: "Demo-konton kan inte ta bort länkar." }, 403);
  }

  const { link, forbidden } = await loadOwnedLink(session, c.req.param("id"));
  if (forbidden) return c.json({ error: "Behörighet saknas" }, 403);
  if (!link) return c.json({ error: "Länken hittades inte" }, 404);

  try {
    await db
      .delete(calculatorLeads)
      .where(eq(calculatorLeads.calculatorLinkId, link.id));
    await db.delete(calculatorLinks).where(eq(calculatorLinks.id, link.id));
    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "delete calculator link failed");
    return c.json({ error: "Kunde inte ta bort länken" }, 500);
  }
});

// ── Se infångade leads för en länk ─────────────────────────────────
calculatorAdmin.get("/:id/leads", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: "Ej inloggad" }, 401);
  if (!SALES_ROLES.has(session.role)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }

  const { link, forbidden } = await loadOwnedLink(session, c.req.param("id"));
  if (forbidden) return c.json({ error: "Behörighet saknas" }, 403);
  if (!link) return c.json({ error: "Länken hittades inte" }, 404);

  try {
    const leads = await db
      .select()
      .from(calculatorLeads)
      .where(eq(calculatorLeads.calculatorLinkId, link.id))
      .orderBy(desc(calculatorLeads.createdAt))
      .limit(100);

    return c.json({
      associationName: link.associationName,
      leads: leads.map((l) => {
        const inputs = CalculatorInputsSchema.safeParse(l.inputsSnapshot);
        const result = inputs.success
          ? computeCalculator(inputs.data as CalculatorInputs)
          : null;
        return {
          id: l.id,
          email: l.email,
          contactName: l.contactName,
          message: l.message,
          newsletterConsent: l.newsletterConsent,
          computedEarningsOre: l.computedEarningsOre,
          inputs: inputs.success ? inputs.data : null,
          result,
          createdAt: l.createdAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    log.error({ err }, "list calculator leads failed");
    return c.json({ error: "Kunde inte hämta leads" }, 500);
  }
});
