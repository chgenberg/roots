/**
 * Lead-mejlagenten: import, mall, godkännande, utskick och export.
 *
 * Behörighet: intern admin och säljadmin ser alla avsändare; en säljare ser
 * bara avsändare som är kopplade till hens konto. Utskicket är en grind
 * (email): mejl går bara ut för rader som en människa godkänt, först när
 * någon uttryckligen trycker Skicka, och aldrig medan mejl är pausade.
 */

import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { outreachLeads, outreachSenders, users } from "@roots/db/schema";
import { resolveCanonicalSiteUrl } from "@roots/contracts";
import { isDemoSession, type SessionData } from "../lib/session";
import { requireSession } from "../lib/http-session";
import { getEmailSender, isRealEmailSend, type SendEmailResult } from "../lib/email";
import { childLogger } from "../lib/logger";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
  calculateLead,
  renderLeadMail,
} from "../lib/outreach/template";
import {
  LEAD_FIELDS,
  buildExport,
  loadWorkbook,
  parseLeads,
  parseWebsite,
  previewWorkbook,
  type ColumnMapping,
} from "../lib/outreach/excel";

const log = childLogger("outreach");

export const outreach = new Hono();

type Sender = typeof outreachSenders.$inferSelect;
type Lead = typeof outreachLeads.$inferSelect;

const ROLES = new Set(["INTERNAL_ADMIN", "SALES_ADMIN", "SALES_REP"]);
const MANAGER_ROLES = new Set(["INTERNAL_ADMIN", "SALES_ADMIN"]);
const MANUAL_STATUSES = ["draft", "replied", "meeting", "declined"] as const;
const SEND_BATCH = 12;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  approved: "Godkänd",
  sending: "Skickas",
  sent: "Skickad",
  replied: "Har svarat",
  meeting: "Möte bokat",
  declined: "Inte intresserad",
  failed: "Misslyckades",
};

type Guard =
  | { ok: true; session: SessionData }
  | { ok: false; res: Response };

async function guard(c: Context): Promise<Guard> {
  const session = await requireSession(c);
  if (!session) return { ok: false, res: c.json({ error: "Ej inloggad" }, 401) };
  if (!ROLES.has(session.role)) {
    return { ok: false, res: c.json({ error: "Behörighet saknas" }, 403) };
  }
  return { ok: true, session };
}

function canSee(session: SessionData, sender: Sender): boolean {
  return MANAGER_ROLES.has(session.role) || sender.userId === session.userId;
}

async function loadSender(c: Context, session: SessionData, id: string): Promise<Sender | Response> {
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "Okänd avsändare" }, 404);
  const [sender] = await db.select().from(outreachSenders).where(eq(outreachSenders.id, id)).limit(1);
  if (!sender || !canSee(session, sender)) return c.json({ error: "Okänd avsändare" }, 404);
  return sender;
}

async function loadLeads(c: Context, session: SessionData, ids: string[]) {
  const valid = ids.filter((id) => z.string().uuid().safeParse(id).success);
  if (valid.length === 0) return [];
  const rows = await db
    .select({ lead: outreachLeads, sender: outreachSenders })
    .from(outreachLeads)
    .innerJoin(outreachSenders, eq(outreachLeads.senderId, outreachSenders.id))
    .where(inArray(outreachLeads.id, valid));
  return rows.filter((r) => canSee(session, r.sender));
}

function emailEnabled(): boolean {
  const paused = process.env.FEATURE_EMAIL_DISABLED?.trim().toLowerCase() === "true";
  return !paused && Boolean(process.env.RESEND_API_KEY);
}

function proposalUrl(token: string): string {
  return `${resolveCanonicalSiteUrl()}/f/${token}`;
}

function newToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 12);
}

function render(sender: Sender, lead: Lead) {
  return renderLeadMail({
    subjectTemplate: lead.subjectOverride ?? sender.subjectTemplate,
    bodyTemplate: lead.bodyOverride ?? sender.bodyTemplate,
    sender,
    lead,
    proposalUrl: proposalUrl(lead.token),
  });
}

function serializeLead(sender: Sender, lead: Lead) {
  const calc = calculateLead(lead);
  return {
    id: lead.id,
    orgName: lead.orgName,
    contactName: lead.contactName,
    email: lead.email,
    website: lead.website,
    memberCount: lead.memberCount,
    packagesPerMember: lead.packagesPerMember,
    packagePriceKr: lead.packagePriceKr,
    totalKr: calc?.totalKr ?? null,
    associationKr: calc?.associationKr ?? null,
    status: lead.status,
    hasOverride: Boolean(lead.subjectOverride || lead.bodyOverride),
    note: lead.note,
    missing: render(sender, lead).missing,
    proposalUrl: proposalUrl(lead.token),
    sentAt: lead.sentAt?.toISOString() ?? null,
    approvedAt: lead.approvedAt?.toISOString() ?? null,
    lastError: lead.lastError,
    proposalOpenCount: lead.proposalOpenCount,
    proposalOpenedAt: lead.proposalOpenedAt?.toISOString() ?? null,
  };
}

function serializeSender(s: Sender) {
  return {
    id: s.id,
    name: s.name,
    title: s.title,
    phone: s.phone,
    email: s.email,
    subjectTemplate: s.subjectTemplate,
    bodyTemplate: s.bodyTemplate,
    dailyCap: s.dailyCap,
    userId: s.userId,
  };
}

const startOfStockholmDay = sql`((date_trunc('day', now() AT TIME ZONE 'Europe/Stockholm') AT TIME ZONE 'Europe/Stockholm') AT TIME ZONE 'UTC')`;

async function sentToday(senderId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(outreachLeads)
    .where(and(eq(outreachLeads.senderId, senderId), gte(outreachLeads.sentAt, startOfStockholmDay)));
  return row?.n ?? 0;
}

// ── Avsändare ────────────────────────────────────────────────────

outreach.get("/senders", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  const all = await db.select().from(outreachSenders).orderBy(asc(outreachSenders.createdAt));
  const senders = all.filter((s) => canSee(g.session, s));
  const counts = senders.length
    ? await db
        .select({ senderId: outreachLeads.senderId, status: outreachLeads.status, n: count() })
        .from(outreachLeads)
        .where(inArray(outreachLeads.senderId, senders.map((s) => s.id)))
        .groupBy(outreachLeads.senderId, outreachLeads.status)
    : [];
  const today = await Promise.all(senders.map((s) => sentToday(s.id)));
  return c.json({
    emailEnabled: emailEnabled(),
    canManage: MANAGER_ROLES.has(g.session.role),
    statusLabels: STATUS_LABELS,
    senders: senders.map((s, i) => ({
      ...serializeSender(s),
      sentToday: today[i],
      counts: Object.fromEntries(counts.filter((r) => r.senderId === s.id).map((r) => [r.status, r.n])),
    })),
  });
});

const SenderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120).default("Föreningsrepresentant"),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(255),
  subjectTemplate: z.string().trim().min(3).max(300).optional(),
  bodyTemplate: z.string().trim().min(20).max(20_000).optional(),
  dailyCap: z.number().int().min(1).max(200).optional(),
  userEmail: z.string().trim().toLowerCase().email().optional().nullable(),
});

async function userIdFor(email: string | null | undefined): Promise<string | null | "missing"> {
  if (!email) return null;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? "missing";
}

outreach.post("/senders", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (!MANAGER_ROLES.has(g.session.role) || isDemoSession(g.session)) {
    return c.json({ error: "Behörighet saknas" }, 403);
  }
  const parsed = SenderSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Fyll i namn och en giltig e-postadress" }, 400);
  const userId = await userIdFor(parsed.data.userEmail);
  if (userId === "missing") return c.json({ error: "Det finns inget konto med den e-postadressen" }, 400);
  const [row] = await db
    .insert(outreachSenders)
    .values({
      name: parsed.data.name,
      title: parsed.data.title,
      phone: parsed.data.phone || null,
      email: parsed.data.email,
      subjectTemplate: parsed.data.subjectTemplate ?? DEFAULT_SUBJECT_TEMPLATE,
      bodyTemplate: parsed.data.bodyTemplate ?? DEFAULT_BODY_TEMPLATE,
      dailyCap: parsed.data.dailyCap ?? 40,
      userId,
    })
    .returning();
  return c.json({ sender: serializeSender(row!) }, 201);
});

outreach.patch("/senders/:id", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const sender = await loadSender(c, g.session, c.req.param("id"));
  if (sender instanceof Response) return sender;
  const parsed = SenderSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Ogiltiga uppgifter" }, 400);
  const { userEmail, ...rest } = parsed.data;
  let userId: string | null | undefined;
  if (userEmail !== undefined) {
    if (!MANAGER_ROLES.has(g.session.role)) return c.json({ error: "Behörighet saknas" }, 403);
    const found = await userIdFor(userEmail);
    if (found === "missing") return c.json({ error: "Det finns inget konto med den e-postadressen" }, 400);
    userId = found;
  }
  const [row] = await db
    .update(outreachSenders)
    .set({
      ...rest,
      ...(rest.phone !== undefined ? { phone: rest.phone || null } : {}),
      ...(userId !== undefined ? { userId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(outreachSenders.id, sender.id))
    .returning();

  // Godkännandet gällde den gamla texten.
  const textChanged =
    (rest.subjectTemplate !== undefined && rest.subjectTemplate !== sender.subjectTemplate) ||
    (rest.bodyTemplate !== undefined && rest.bodyTemplate !== sender.bodyTemplate) ||
    (rest.name !== undefined && rest.name !== sender.name) ||
    (rest.title !== undefined && rest.title !== sender.title) ||
    (rest.email !== undefined && rest.email !== sender.email) ||
    (rest.phone !== undefined && (rest.phone || null) !== sender.phone);
  if (textChanged) {
    await db
      .update(outreachLeads)
      .set({ status: "draft", approvedAt: null, approvedBy: null, updatedAt: new Date() })
      .where(and(eq(outreachLeads.senderId, sender.id), eq(outreachLeads.status, "approved")));
  }
  return c.json({ sender: serializeSender(row!) });
});

// ── Leads ────────────────────────────────────────────────────────

outreach.get("/senders/:id/leads", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  const sender = await loadSender(c, g.session, c.req.param("id"));
  if (sender instanceof Response) return sender;

  const status = c.req.query("status");
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const conds = [eq(outreachLeads.senderId, sender.id)];
  if (status && STATUS_LABELS[status]) conds.push(eq(outreachLeads.status, status));
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(outreachLeads.orgName, pattern),
        ilike(outreachLeads.email, pattern),
        ilike(outreachLeads.contactName, pattern)
      )!
    );
  }
  const rows = await db
    .select()
    .from(outreachLeads)
    .where(and(...conds))
    .orderBy(sql`${outreachLeads.memberCount} is null`, desc(outreachLeads.updatedAt), asc(outreachLeads.orgName))
    .limit(500);
  const [total] = await db.select({ n: count() }).from(outreachLeads).where(and(...conds));
  return c.json({ leads: rows.map((l) => serializeLead(sender, l)), total: total?.n ?? 0 });
});

const ImportSchema = z.object({
  fileBase64: z.string().min(10).max(14_000_000),
  sheet: z.string().max(100).optional(),
  mapping: z.record(z.enum(LEAD_FIELDS), z.number().int().min(0).max(200).nullable()).optional(),
});

outreach.post("/senders/:id/import", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const sender = await loadSender(c, g.session, c.req.param("id"));
  if (sender instanceof Response) return sender;
  const parsed = ImportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Filen kunde inte läsas" }, 400);

  let wb;
  try {
    wb = await loadWorkbook(Buffer.from(parsed.data.fileBase64, "base64"));
  } catch {
    return c.json({ error: "Filen är inte en Excel-fil (.xlsx)" }, 400);
  }

  const dryRun = c.req.query("preview") === "1";
  if (dryRun || !parsed.data.sheet || !parsed.data.mapping) {
    return c.json({ sheets: previewWorkbook(wb) });
  }

  const mapping = parsed.data.mapping as ColumnMapping;
  if (mapping.orgName == null || mapping.email == null) {
    return c.json({ error: "Välj vilken kolumn som är förening och vilken som är e-post" }, 400);
  }
  let result;
  try {
    result = parseLeads(wb, parsed.data.sheet, mapping);
  } catch {
    return c.json({ error: "Bladet finns inte i filen" }, 400);
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < result.leads.length; i += 500) {
    const chunk = result.leads.slice(i, i + 500);
    const rows = await db
      .insert(outreachLeads)
      .values(chunk.map((l) => ({ ...l, senderId: sender.id, token: newToken() })))
      .onConflictDoUpdate({
        target: [outreachLeads.senderId, outreachLeads.email],
        set: {
          orgName: sql`excluded.org_name`,
          contactName: sql`coalesce(excluded.contact_name, ${outreachLeads.contactName})`,
          website: sql`coalesce(excluded.website, ${outreachLeads.website})`,
          memberCount: sql`coalesce(excluded.member_count, ${outreachLeads.memberCount})`,
          updatedAt: new Date(),
        },
        setWhere: sql`${outreachLeads.status} in ('draft', 'approved')`,
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const r of rows) (r.inserted ? created++ : updated++);
  }

  return c.json({
    created,
    updated,
    unchanged: result.leads.length - created - updated,
    skippedNoEmail: result.skippedNoEmail,
    skippedNoName: result.skippedNoName,
    duplicatesInFile: result.duplicatesInFile,
  });
});

const LeadPatchSchema = z.object({
  orgName: z.string().trim().min(1).max(200).optional(),
  contactName: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  website: z.string().trim().max(300).nullable().optional(),
  memberCount: z.number().int().min(1).max(999_999).nullable().optional(),
  packagesPerMember: z.number().int().min(1).max(100).optional(),
  packagePriceKr: z.number().int().min(1).max(100_000).optional(),
  subjectOverride: z.string().trim().max(300).nullable().optional(),
  bodyOverride: z.string().trim().max(20_000).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(MANUAL_STATUSES).optional(),
});

outreach.patch("/leads/:id", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const [found] = await loadLeads(c, g.session, [c.req.param("id")]);
  if (!found) return c.json({ error: "Okänd förening" }, 404);
  const parsed = LeadPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Ogiltiga uppgifter" }, 400);
  const patch = parsed.data;

  const contentChanged = Object.keys(patch).some((k) => k !== "note" && k !== "status");
  const locked = ["sent", "sending", "replied", "meeting", "declined"].includes(found.lead.status);
  if (contentChanged && locked) {
    return c.json({ error: "Mejlet är redan skickat och kan inte ändras" }, 409);
  }
  if (patch.status === "draft" && found.lead.status !== "approved" && found.lead.status !== "failed") {
    return c.json({ error: "Bara godkända eller misslyckade mejl kan göras om till utkast" }, 409);
  }
  if (patch.status && patch.status !== "draft" && !found.lead.sentAt) {
    return c.json({ error: "Markera svar och möten först när mejlet är skickat" }, 409);
  }

  if (patch.website) {
    const website = parseWebsite(patch.website);
    if (!website) return c.json({ error: "Webbplatsen ser inte ut som en adress" }, 400);
    patch.website = website;
  }

  const [row] = await db
    .update(outreachLeads)
    .set({
      ...patch,
      ...(patch.website === "" ? { website: null } : {}),
      ...(patch.subjectOverride === "" ? { subjectOverride: null } : {}),
      ...(patch.bodyOverride === "" ? { bodyOverride: null } : {}),
      // Ändrat innehåll måste godkännas igen.
      ...(contentChanged && found.lead.status === "approved"
        ? { status: "draft", approvedAt: null, approvedBy: null }
        : {}),
      ...(patch.status === "draft" ? { approvedAt: null, approvedBy: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(outreachLeads.id, found.lead.id))
    .returning();
  return c.json({ lead: serializeLead(found.sender, row!) });
});

outreach.delete("/leads/:id", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const [found] = await loadLeads(c, g.session, [c.req.param("id")]);
  if (!found) return c.json({ error: "Okänd förening" }, 404);
  if (found.lead.sentAt) return c.json({ error: "Skickade mejl tas inte bort" }, 409);
  await db.delete(outreachLeads).where(eq(outreachLeads.id, found.lead.id));
  return c.json({ ok: true });
});

outreach.get("/leads/:id/preview", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  const [found] = await loadLeads(c, g.session, [c.req.param("id")]);
  if (!found) return c.json({ error: "Okänd förening" }, 404);
  const mail = render(found.sender, found.lead);
  return c.json({
    from: `${found.sender.name} <${found.sender.email}>`,
    to: found.lead.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    missing: mail.missing,
    subjectTemplate: found.lead.subjectOverride ?? found.sender.subjectTemplate,
    bodyTemplate: found.lead.bodyOverride ?? found.sender.bodyTemplate,
    hasOverride: Boolean(found.lead.subjectOverride || found.lead.bodyOverride),
  });
});

const IdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) });

outreach.post("/leads/approve", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const parsed = IdsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Inga föreningar valda" }, 400);
  const found = await loadLeads(c, g.session, parsed.data.ids);
  const ready = found
    .filter((r) => (r.lead.status === "draft" || r.lead.status === "failed") && render(r.sender, r.lead).missing.length === 0)
    .map((r) => r.lead.id);
  if (ready.length) {
    await db
      .update(outreachLeads)
      .set({ status: "approved", approvedAt: new Date(), approvedBy: g.session.userId, lastError: null, updatedAt: new Date() })
      .where(inArray(outreachLeads.id, ready));
  }
  return c.json({ approved: ready.length, skipped: parsed.data.ids.length - ready.length });
});

// ── Utskick ──────────────────────────────────────────────────────

outreach.post("/senders/:id/send", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  if (isDemoSession(g.session)) return c.json({ error: "Behörighet saknas" }, 403);
  const sender = await loadSender(c, g.session, c.req.param("id"));
  if (sender instanceof Response) return sender;
  if (!emailEnabled()) {
    return c.json({ error: "Mejl är pausade. Inget skickades.", code: "EMAIL_PAUSED" }, 409);
  }

  const remaining = Math.max(0, sender.dailyCap - (await sentToday(sender.id)));
  if (remaining === 0) {
    return c.json({ sent: 0, failed: 0, remainingToday: 0, more: false, capReached: true });
  }

  const take = Math.min(SEND_BATCH, remaining);
  const claimed = await db
    .update(outreachLeads)
    .set({ status: "sending", updatedAt: new Date() })
    .where(
      inArray(
        outreachLeads.id,
        db
          .select({ id: outreachLeads.id })
          .from(outreachLeads)
          .where(and(eq(outreachLeads.senderId, sender.id), eq(outreachLeads.status, "approved")))
          .orderBy(asc(outreachLeads.approvedAt))
          .limit(take)
      )
    )
    .returning();

  const emailSender = getEmailSender();
  let sent = 0;
  let failed = 0;
  for (const lead of claimed) {
    const mail = render(sender, lead);
    if (mail.missing.length) {
      await db
        .update(outreachLeads)
        .set({ status: "failed", lastError: mail.missing.join(", "), updatedAt: new Date() })
        .where(eq(outreachLeads.id, lead.id));
      failed++;
      continue;
    }
    const result: SendEmailResult = await emailSender
      .sendEmail({
        to: lead.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        from: `${sender.name} <${sender.email}>`,
        replyTo: sender.email,
      })
      .catch((err: unknown) => ({ success: false, error: (err as Error)?.message }));

    if (isRealEmailSend(result)) {
      await db
        .update(outreachLeads)
        .set({ status: "sent", sentAt: new Date(), providerId: result.id ?? null, lastError: null, updatedAt: new Date() })
        .where(eq(outreachLeads.id, lead.id));
      sent++;
    } else {
      const reason =
        result.mocked ? "Mejl är pausade" : (result.error ?? "Okänt fel").slice(0, 500);
      await db
        .update(outreachLeads)
        .set({ status: "failed", lastError: reason, updatedAt: new Date() })
        .where(eq(outreachLeads.id, lead.id));
      failed++;
      log.warn({ leadId: lead.id, reason }, "Outreach mail not sent");
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  const [left] = await db
    .select({ n: count() })
    .from(outreachLeads)
    .where(and(eq(outreachLeads.senderId, sender.id), eq(outreachLeads.status, "approved")));
  const remainingToday = Math.max(0, remaining - sent);
  return c.json({
    sent,
    failed,
    remainingToday,
    more: (left?.n ?? 0) > 0 && remainingToday > 0 && claimed.length > 0,
    capReached: remainingToday === 0,
  });
});

// ── Export ───────────────────────────────────────────────────────

outreach.get("/senders/:id/export", async (c) => {
  const g = await guard(c);
  if (!g.ok) return g.res;
  const sender = await loadSender(c, g.session, c.req.param("id"));
  if (sender instanceof Response) return sender;
  const rows = await db
    .select()
    .from(outreachLeads)
    .where(eq(outreachLeads.senderId, sender.id))
    .orderBy(asc(outreachLeads.orgName));
  const buf = await buildExport(
    sender.name,
    rows.map((l) => {
      const calc = calculateLead(l);
      return {
        orgName: l.orgName,
        contactName: l.contactName,
        email: l.email,
        website: l.website,
        memberCount: l.memberCount,
        totalKr: calc?.totalKr ?? null,
        associationKr: calc?.associationKr ?? null,
        proposalUrl: proposalUrl(l.token),
        status: STATUS_LABELS[l.status] ?? l.status,
        sentAt: l.sentAt,
        proposalOpenCount: l.proposalOpenCount,
        proposalOpenedAt: l.proposalOpenedAt,
        note: l.note,
      };
    })
  );
  const file = `leads-${sender.name.toLowerCase().replace(/[^a-z0-9åäö]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file)}"`,
      "Cache-Control": "no-store",
    },
  });
});

// ── Förslagslänken (publik) ──────────────────────────────────────

const BOT_UA =
  /bot|crawl|spider|slurp|headless|preview|scanner|safelinks|proofpoint|mimecast|barracuda|curl|wget|python|node-fetch|axios|go-http|java\//i;

outreach.get("/p/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(token)) return c.json({ error: "NOT_FOUND" }, 404);
  const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.token, token)).limit(1);
  if (!lead) return c.json({ error: "NOT_FOUND" }, 404);

  const ua = c.req.header("user-agent") ?? "";
  if (ua && !BOT_UA.test(ua)) {
    await db
      .update(outreachLeads)
      .set({ proposalOpenCount: sql`${outreachLeads.proposalOpenCount} + 1`, proposalOpenedAt: new Date() })
      .where(eq(outreachLeads.id, lead.id))
      .catch((err) => log.warn({ err }, "Failed to record proposal open"));
  }

  const calc = calculateLead(lead);
  let host: string | null = null;
  try {
    host = lead.website ? new URL(lead.website).host.replace(/^www\./, "") : null;
  } catch {
    host = null;
  }
  return c.json({ orgName: lead.orgName, website: host, goalKr: calc?.associationKr ?? null });
});
