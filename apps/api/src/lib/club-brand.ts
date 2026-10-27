/**
 * Föreningens logga och färger: validering av det webben skickar, lagring och
 * utläsning för shop, dashboards och inbjudningar.
 *
 * Själva läsningen av föreningens webbplats sker i webben (förhandsvisning i
 * formuläret). Hit kommer bara det som användaren godkänt: färger och en
 * PNG som webbläsaren redan ritat om, så att ingen SVG eller okänt format
 * från en främmande sajt sparas och serveras från vår domän.
 */
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@roots/db";
import { organizationBrands, sellers, teams, organizations } from "@roots/db/schema";

export type OrgBrand = {
  color: string | null;
  colors: string[];
  /** Sökväg under API:t, t.ex. `/v1/brand/logo/<id>?v=…`. */
  logoPath: string | null;
  logoOnDark: boolean;
  sourceUrl: string | null;
};

export type BrandInput = {
  website: string | null | undefined;
  color: string | null;
  colors: string[];
  /** undefined = behåll befintlig logga, null = ta bort. */
  logo: Buffer | null | undefined;
  logoOnDark: boolean;
};

const MAX_LOGO_BYTES = 300_000;
const MAX_LOGO_SIDE = 1024;
const MAX_COLORS = 6;
const HEX = /^#[0-9A-F]{6}$/i;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
  url.hash = "";
  const out = url.toString().replace(/\/$/, "");
  return out.length <= 255 ? out : null;
}

export type BrandParse =
  | { ok: true; value: BrandInput }
  | { ok: false; error: "invalidColor" | "invalidLogo" | "invalidWebsite" };

/** Tolkar `{ website, color, colors, logo, logoOnDark }` från en request-body. */
export function parseBrandInput(raw: unknown): BrandParse {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let website: string | null | undefined;
  if (body.website === null || body.website === "") website = null;
  else if (typeof body.website === "string") {
    website = normalizeWebsite(body.website);
    if (!website) return { ok: false, error: "invalidWebsite" };
  }

  const color = typeof body.color === "string" && body.color ? body.color.toUpperCase() : null;
  if (color && !HEX.test(color)) return { ok: false, error: "invalidColor" };

  const colorsRaw = Array.isArray(body.colors) ? body.colors : [];
  if (colorsRaw.length > MAX_COLORS * 2) return { ok: false, error: "invalidColor" };
  const colors: string[] = [];
  for (const c of colorsRaw) {
    if (typeof c !== "string" || !HEX.test(c)) return { ok: false, error: "invalidColor" };
    const up = c.toUpperCase();
    if (!colors.includes(up)) colors.push(up);
  }
  if (color && !colors.includes(color)) colors.unshift(color);

  let logo: Buffer | null | undefined;
  if (body.logo === null) logo = null;
  else if (typeof body.logo === "string") {
    const m = body.logo.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!m || m[1].length > Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 4) {
      return { ok: false, error: "invalidLogo" };
    }
    const buf = Buffer.from(m[1], "base64");
    const size = pngSize(buf);
    if (
      !size ||
      buf.length > MAX_LOGO_BYTES ||
      size.width < 1 ||
      size.height < 1 ||
      size.width > MAX_LOGO_SIDE ||
      size.height > MAX_LOGO_SIDE
    ) {
      return { ok: false, error: "invalidLogo" };
    }
    logo = buf;
  }

  return {
    ok: true,
    value: {
      website,
      color,
      colors: colors.slice(0, MAX_COLORS),
      logo,
      logoOnDark: body.logoOnDark === true,
    },
  };
}

export function brandErrorKey(
  error: "invalidColor" | "invalidLogo" | "invalidWebsite"
): "invalidBrandColor" | "invalidBrandLogo" | "invalidWebsite" {
  if (error === "invalidLogo") return "invalidBrandLogo";
  if (error === "invalidWebsite") return "invalidWebsite";
  return "invalidBrandColor";
}

export function hasBrand(input: BrandInput): boolean {
  return Boolean(input.color || input.colors.length || input.logo);
}

type Tx = Pick<typeof db, "insert" | "update">;

/** Sparar föreningens profil. Webbadressen hamnar även på organisationen. */
export async function saveOrgBrand(
  orgId: string,
  input: BrandInput,
  userId: string | null,
  tx: Tx = db
): Promise<void> {
  const values = {
    color: input.color,
    colors: input.colors,
    logoOnDark: input.logoOnDark,
    sourceUrl: input.website ?? null,
    updatedAt: new Date(),
    updatedByUserId: userId,
    ...(input.logo !== undefined ? { logo: input.logo } : {}),
  };
  await tx
    .insert(organizationBrands)
    .values({ orgId, ...values })
    .onConflictDoUpdate({ target: organizationBrands.orgId, set: values });
  if (input.website !== undefined) {
    await tx
      .update(organizations)
      .set({ website: input.website, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));
  }
}

const brandColumns = {
  orgId: organizationBrands.orgId,
  color: organizationBrands.color,
  colors: organizationBrands.colors,
  hasLogo: sql<boolean>`${organizationBrands.logo} IS NOT NULL`,
  logoOnDark: organizationBrands.logoOnDark,
  sourceUrl: organizationBrands.sourceUrl,
  updatedAt: organizationBrands.updatedAt,
};

function toBrand(row: {
  orgId: string;
  color: string | null;
  colors: string[];
  hasLogo: boolean;
  logoOnDark: boolean;
  sourceUrl: string | null;
  updatedAt: Date;
}): OrgBrand {
  return {
    color: row.color,
    colors: row.colors ?? [],
    logoPath: row.hasLogo ? `/v1/brand/logo/${row.orgId}?v=${row.updatedAt.getTime()}` : null,
    logoOnDark: row.logoOnDark,
    sourceUrl: row.sourceUrl,
  };
}

export async function loadOrgBrand(orgId: string | null | undefined): Promise<OrgBrand | null> {
  if (!orgId) return null;
  const [row] = await db
    .select(brandColumns)
    .from(organizationBrands)
    .where(eq(organizationBrands.orgId, orgId))
    .limit(1);
  return row && (row.color || row.hasLogo) ? toBrand(row) : null;
}

export async function loadOrgBrands(orgIds: string[]): Promise<Map<string, OrgBrand>> {
  const ids = [...new Set(orgIds.filter(Boolean))];
  const out = new Map<string, OrgBrand>();
  if (ids.length === 0) return out;
  const rows = await db
    .select(brandColumns)
    .from(organizationBrands)
    .where(inArray(organizationBrands.orgId, ids));
  for (const row of rows) if (row.color || row.hasLogo) out.set(row.orgId, toBrand(row));
  return out;
}

export async function readOrgLogo(orgId: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ logo: organizationBrands.logo })
    .from(organizationBrands)
    .where(eq(organizationBrands.orgId, orgId))
    .limit(1);
  return row?.logo ?? null;
}

/** Föreningen en inloggad användare hör till. Säljare saknar ofta orgId och går via laget. */
export async function brandOrgIdForUser(
  userId: string | null | undefined,
  orgId: string | null | undefined
): Promise<string | null> {
  if (orgId) return orgId;
  if (!userId) return null;
  const [row] = await db
    .select({ orgId: teams.orgId })
    .from(sellers)
    .innerJoin(teams, eq(teams.id, sellers.teamId))
    .where(eq(sellers.userId, userId))
    .orderBy(desc(sellers.createdAt))
    .limit(1);
  return row?.orgId ?? null;
}
