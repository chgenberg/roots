/**
 * Läser en förenings namn, färg och logga från dess webbplats, för demo-shopen
 * på /prova. Bara på servern (Node). Inget sparas utöver en kort cache i minnet.
 *
 * laget.se har ett öppet klubbdata-svar med klubbens egna färger och märke —
 * det används både för laget.se/<Klubb> och för egna domäner som körs på
 * laget.se. Övriga sajter tolkas ur HTML: sidhuvudets logga, strukturerad
 * data, ikoner och theme-color.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ClubBrand = {
  host: string;
  name: string | null;
  /** Färg som föreningen själv valt (laget.se) eller sajtens theme-color. */
  color: string | null;
  colorSource: "club" | "theme" | null;
  /** Loggan som data-URL, så webbläsaren kan rita den utan att hämta från klubbens sajt. */
  logo: string | null;
};

export class BrandError extends Error {
  constructor(public code: "invalid" | "unreachable" | "blocked") {
    super(code);
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const MAX_HTML = 1_500_000;
const MAX_IMAGE = 800_000;
const TIMEOUT_MS = 6000;
const CACHE_MS = 60 * 60 * 1000;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) throw new BrandError("blocked");
  if (url.username || url.password || (url.port && !["80", "443"].includes(url.port))) {
    throw new BrandError("blocked");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new BrandError("blocked");
    return;
  }
  const all = await lookup(host, { all: true }).catch(() => {
    throw new BrandError("unreachable");
  });
  if (all.length === 0 || all.some((a) => isPrivateIp(a.address))) throw new BrandError("blocked");
}

/** Hämtar med adresskontroll på varje omdirigering, storlekstak och tidsgräns. */
async function safeFetch(
  start: URL,
  accept: string,
  maxBytes: number
): Promise<{ body: Buffer; type: string; url: URL } | null> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "sv-SE,sv;q=0.9" },
    }).catch(() => null);
    if (!res) return null;
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok || !res.body) return null;
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), type: res.headers.get("content-type") ?? "", url };
  }
  return null;
}

export function normalizeSite(raw: string): URL {
  const trimmed = raw.trim().slice(0, 300);
  if (!trimmed) throw new BrandError("invalid");
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new BrandError("invalid");
  }
  if (!url.hostname.includes(".") || url.hostname.length > 253) throw new BrandError("invalid");
  url.hash = "";
  return url;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag: string, name: string) =>
  decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "is"))?.[2] ?? "");

function hex(raw: string): string | null {
  const v = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  }
  return null;
}

/** Vitt, svart och grått säger inget om föreningen. */
function isNeutral(color: string): boolean {
  const n = parseInt(color.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max - min < 24;
}

// ── laget.se ────────────────────────────────────────────────────────────

type LagetClub = {
  name?: string;
  primaryColor?: string;
  badge?: { badgeIdForLightBackground?: number | null } | null;
  userGeneratedCdnUrl?: string;
};

async function fromLaget(clubUrlName: string, host: string): Promise<ClubBrand | null> {
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(clubUrlName)) return null;
  const res = await safeFetch(
    new URL(`https://www.laget.se/api2/frontpage/${clubUrlName}/clubdata`),
    "application/json",
    200_000
  );
  if (!res || !res.type.includes("json")) return null;
  let data: LagetClub;
  try {
    data = JSON.parse(res.body.toString("utf8")) as LagetClub;
  } catch {
    return null;
  }
  const color = hex(data.primaryColor ?? "");
  const badge = data.badge?.badgeIdForLightBackground;
  let logo: string | null = null;
  if (badge && Number.isInteger(badge)) {
    const cdn = /^https:\/\/[a-z0-9.-]+\.laget\.se\/$/i.test(data.userGeneratedCdnUrl ?? "")
      ? data.userGeneratedCdnUrl!
      : "https://az729104.cdn.laget.se/";
    logo = await imageDataUrl(new URL(`${cdn}emblem_${badge}.png`));
  }
  return {
    host,
    name: data.name ? decode(data.name).slice(0, 60) : null,
    color: color && !isNeutral(color) ? color : null,
    colorSource: color && !isNeutral(color) ? "club" : null,
    logo,
  };
}

// ── Allmän HTML ─────────────────────────────────────────────────────────

const NOT_A_LOGO =
  /sponsor|partner|samarbet|footer|payment|klarna|swish|visa|mastercard|flag|flagga|lang|cookie|facebook|instagram|twitter|youtube|tiktok|linkedin|app-?store|google-?play|avatar|search|sok|menu|meny|cart/i;

type Candidate = { src: string; score: number };

function candidates(html: string, base: URL): Candidate[] {
  const out: Candidate[] = [];
  const add = (src: string, score: number) => {
    if (!src || src.startsWith("data:")) return;
    try {
      out.push({ src: new URL(src, base).toString(), score });
    } catch {
      // ogiltig adress — hoppa över
    }
  };

  // Strukturerad data: Organization / SportsOrganization / SportsTeam med logo.
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const logo = m[1].match(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/);
    if (logo) add(logo[1] ?? logo[2], 90);
  }

  // <img> med "logo" i klass, id, alt eller filnamn. Tidigt i sidan = sidhuvudet.
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  imgs.forEach((m, i) => {
    const tag = m[0];
    const src =
      attr(tag, "src") || attr(tag, "data-src") || attr(tag, "data-lazy-src") || attr(tag, "srcset").split(/\s+/)[0];
    const hay = `${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "alt")} ${src}`.toLowerCase();
    if (!/logo|logga|emblem|klubbm[aä]rke|crest|badge/.test(hay) || NOT_A_LOGO.test(hay)) return;
    const position = (m.index ?? 0) / Math.max(1, html.length);
    add(src, 80 - Math.min(30, i * 3) - (position > 0.5 ? 25 : 0));
  });

  // Ikoner: apple-touch-icon och stora favicons är ofta föreningens märke.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attr(tag, "rel").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !rel.includes("icon")) continue;
    const size = Number(attr(tag, "sizes").split("x")[0]) || 0;
    if (rel.includes("apple-touch-icon")) add(href, 55);
    else if (size >= 96) add(href, 50);
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  if (og) add(attr(og, "content"), 20);

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seen.has(c.src) ? false : (seen.add(c.src), true)))
    .slice(0, 4);
}

function siteName(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*>/i)?.[0];
  const fromOg = og ? attr(og, "content") : "";
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const raw = fromOg || title;
  if (!raw) return null;
  const first = raw
    .split(/\s+[|–—-]\s+|\s*\|\s*/)[0]
    .replace(/^(välkommen till|welcome to|startsida|hem|start)\s*[-–:]?\s*/i, "")
    .trim();
  return first && first.length <= 60 && !/^(laget\.se|home|start|hem)$/i.test(first) ? first : null;
}

function themeColor(html: string): string | null {
  for (const name of ["theme-color", "msapplication-TileColor"]) {
    const tag = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i"))?.[0];
    const color = tag ? hex(attr(tag, "content")) : null;
    if (color && !isNeutral(color)) return color;
  }
  return null;
}

async function imageDataUrl(url: URL): Promise<string | null> {
  const res = await safeFetch(url, "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8", MAX_IMAGE).catch(
    () => null
  );
  if (!res) return null;
  const type = res.type.split(";")[0].trim().toLowerCase();
  if (!/^image\/(png|jpeg|jpg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(type)) return null;
  if (res.body.byteLength < 200) return null;
  return `data:${type};base64,${res.body.toString("base64")}`;
}

async function fromHtml(url: URL): Promise<ClubBrand> {
  const page = await safeFetch(url, "text/html,application/xhtml+xml", MAX_HTML);
  if (!page || !page.type.includes("html")) throw new BrandError("unreachable");
  const html = page.body.toString("utf8");
  const host = page.url.hostname.replace(/^www\./, "");

  const laget = html.match(/"clubUrlName"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
  if (laget) {
    const brand = await fromLaget(laget, host).catch(() => null);
    if (brand) return brand;
  }

  let logo: string | null = null;
  for (const c of candidates(html, page.url)) {
    logo = await imageDataUrl(new URL(c.src)).catch(() => null);
    if (logo) break;
  }
  const color = themeColor(html);
  return { host, name: siteName(html), color, colorSource: color ? "theme" : null, logo };
}

// ── Ingång med cache ────────────────────────────────────────────────────

const cache = new Map<string, { at: number; value: Promise<ClubBrand> }>();

export function readClubBrand(raw: string): Promise<ClubBrand> {
  const url = normalizeSite(raw);
  const key = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const lagetPath = host === "laget.se" ? url.pathname.split("/").filter(Boolean)[0] : undefined;
  const value = (async () => {
    if (lagetPath) {
      const brand = await fromLaget(lagetPath, `laget.se/${lagetPath}`);
      if (brand) return brand;
    }
    return fromHtml(url);
  })();

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
