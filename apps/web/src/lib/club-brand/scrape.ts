/**
 * Läser en förenings namn, färg och logga från dess webbplats, för demo-shopen
 * på /prova. Bara på servern (Node). Inget sparas utöver en kort cache i minnet.
 *
 * laget.se har ett öppet klubbdata-svar med klubbens egna färger och märke —
 * det används både för laget.se/<Klubb> och för egna domäner som körs på
 * laget.se. Övriga sajter tolkas ur HTML: sidhuvudets logga, strukturerad
 * data, ikoner och theme-color.
 *
 * Adressen kommer från besökaren och sidan från en främmande server, så två
 * saker gäller genomgående: vi ansluter aldrig till en adress som inte är
 * publik, och ingen del av tolkningen får ta mer än linjär tid i sidans längd.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import { createGunzip, createInflate, type Gunzip, type Inflate } from "node:zlib";

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
  constructor(public code: "invalid" | "unreachable" | "blocked" | "limited") {
    super(code);
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const MAX_HTML = 1_500_000;
const MAX_IMAGE = 800_000;
const TIMEOUT_MS = 6000;
/** Hela uppslaget, med alla omdirigeringar och loggförsök. */
const TOTAL_BUDGET_MS = 15_000;
const CACHE_MS = 60 * 60 * 1000;
/** Längre taggar än så är inte sidhuvudets logga. */
const MAX_TAG = 4000;
const MAX_TAGS = 800;
const MAX_JSON_LD = 200_000;
/**
 * Tak för hur mycket hämtning besökare kan beställa av servern, oavsett vilken
 * sida som frågar. Bara riktiga uppslag räknas, inte svar ur cachen.
 */
const MAX_ACTIVE_LOOKUPS = 8;
const MAX_LOOKUPS_PER_WINDOW = 300;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const MAX_CACHED = 200;

// ── Bara publika adresser ───────────────────────────────────────────────

/**
 * Allt som inte är en publik unicast-adress. BlockList jämför IPv4-mappade
 * IPv6-adresser (::ffff:7f00:1) mot IPv4-reglerna, vilket en egen
 * strängjämförelse missade.
 */
const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96], // ospecificerad, loopback och IPv4-kompatibla
  ["64:ff9b::", 96], // NAT64 — bär en IPv4-adress
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23], // Teredo och övriga protokolltilldelningar
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4 — bär en IPv4-adress
  ["fc00::", 7],
  ["fe80::", 10],
  ["3fff::", 20], // dokumentation
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}
/** Det enda IPv6-utrymme som delas ut för publik trafik. */
const GLOBAL_UNICAST_V6 = new BlockList();
GLOBAL_UNICAST_V6.addSubnet("2000::", 3, "ipv6");

export function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true;
  if (family === 4) return NON_PUBLIC.check(ip, "ipv4");
  // IPv6 släpps bara igenom om adressen ligger i det publika utrymmet och inte
  // i något undantag. Allt annat, även IPv4 inbäddad i IPv6, räknas som internt.
  return NON_PUBLIC.check(ip, "ipv6") || !GLOBAL_UNICAST_V6.check(ip, "ipv6");
}

const BLOCKED = "EROOTSBLOCKED";

/**
 * Namnuppslaget som socketen själv gör när den ansluter. Att slå upp namnet
 * i förväg och sedan låta hämtningen slå upp det igen räcker inte: svaret kan
 * ändras däremellan. Här är adressen som kontrolleras den som används.
 */
const guardedLookup = ((hostname: string, options: unknown, callback: unknown) => {
  const cb = (typeof options === "function" ? options : callback) as (
    err: NodeJS.ErrnoException | null,
    address?: string | LookupAddress[],
    family?: number
  ) => void;
  const opts = (typeof options === "object" && options ? options : {}) as { all?: boolean };
  dnsLookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      return cb(Object.assign(new Error("address is not public"), { code: BLOCKED }));
    }
    if (opts.all) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
}) as LookupFunction;

function assertPublic(url: URL): void {
  if (!["http:", "https:"].includes(url.protocol)) throw new BrandError("blocked");
  if (url.username || url.password || (url.port && !["80", "443"].includes(url.port))) {
    throw new BrandError("blocked");
  }
  // En adress skriven som siffror slås aldrig upp, så den kontrolleras här.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateIp(host)) throw new BrandError("blocked");
}

type Fetched = { body: Buffer; type: string };

/** En förfrågan utan att följa omdirigeringar. null = går inte att använda. */
function requestOnce(
  url: URL,
  accept: string,
  maxBytes: number,
  timeoutMs: number
): Promise<Fetched | { redirect: string } | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let decoder: Gunzip | Inflate | null = null;
    const finish = (value: Fetched | { redirect: string } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Uppackningen och anslutningen stängs alltid här. Annars fortsätter ett
      // litet komprimerat svar att packas upp till gigabyte efter att vi gett
      // upp, och en anslutning som servern håller öppen blir aldrig stängd.
      decoder?.destroy();
      req.destroy();
      resolve(value);
    };
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: guardedLookup,
        headers: {
          "User-Agent": UA,
          Accept: accept,
          "Accept-Language": "sv-SE,sv;q=0.9",
          "Accept-Encoding": "gzip, deflate",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) return finish({ redirect: location });
        if (status < 200 || status >= 300 || Number(res.headers["content-length"] ?? 0) > maxBytes) {
          return finish(null);
        }
        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        if (encoding === "gzip" || encoding === "x-gzip") decoder = createGunzip();
        else if (encoding === "deflate") decoder = createInflate();
        // Vi bad bara om gzip och deflate. Något annat läser vi inte.
        else if (encoding && encoding !== "identity") return finish(null);
        const stream: Readable = decoder ? res.pipe(decoder) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > maxBytes) return finish(null);
          chunks.push(chunk);
        });
        stream.on("end", () =>
          finish({ body: Buffer.concat(chunks), type: String(res.headers["content-type"] ?? "") })
        );
        stream.on("error", () => finish(null));
        res.on("error", () => finish(null));
      }
    );
    const timer = setTimeout(() => finish(null), timeoutMs);
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== BLOCKED) return finish(null);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      decoder?.destroy();
      reject(new BrandError("blocked"));
    });
    req.end();
  });
}

/** Hämtar med adresskontroll på varje omdirigering, storlekstak och tidsgräns. */
async function safeFetch(
  start: URL,
  accept: string,
  maxBytes: number,
  deadline: number
): Promise<(Fetched & { url: URL }) | null> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    assertPublic(url);
    const budget = Math.min(TIMEOUT_MS, deadline - Date.now());
    if (budget <= 0) return null;
    const res = await requestOnce(url, accept, maxBytes, budget);
    if (!res) return null;
    if ("redirect" in res) {
      try {
        url = new URL(res.redirect, url);
      } catch {
        return null;
      }
      continue;
    }
    return { ...res, url };
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

async function fromLaget(clubUrlName: string, host: string, deadline: number): Promise<ClubBrand | null> {
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(clubUrlName)) return null;
  const res = await safeFetch(
    new URL(`https://www.laget.se/api2/frontpage/${clubUrlName}/clubdata`),
    "application/json",
    200_000,
    deadline
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
    logo = await imageDataUrl(new URL(`${cdn}emblem_${badge}.png`), deadline);
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

/** Gemener för A–Z utan att ändra längden, så positioner gäller i båda strängarna. */
const asciiLower = (s: string) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

const isSpace = (code: number) => code === 32 || code === 9 || code === 10 || code === 13 || code === 12;

/** Attributen i en öppningstagg, lästa tecken för tecken. Första förekomsten vinner. */
function parseAttrs(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const n = src.length;
  let i = 0;
  while (i < n) {
    while (i < n && (isSpace(src.charCodeAt(i)) || src[i] === "/")) i++;
    const nameStart = i;
    while (i < n && !isSpace(src.charCodeAt(i)) && src[i] !== "=" && src[i] !== "/") i++;
    const name = src.slice(nameStart, i).toLowerCase();
    while (i < n && isSpace(src.charCodeAt(i))) i++;
    let value = "";
    if (src[i] === "=") {
      i++;
      while (i < n && isSpace(src.charCodeAt(i))) i++;
      const quote = src[i];
      if (quote === '"' || quote === "'") {
        const close = src.indexOf(quote, i + 1);
        const stop = close === -1 ? n : close;
        value = src.slice(i + 1, stop);
        i = stop + 1;
      } else {
        const valueStart = i;
        while (i < n && !isSpace(src.charCodeAt(i))) i++;
        value = src.slice(valueStart, i);
      }
    }
    if (name && !out.has(name)) out.set(name, decode(value));
    if (i === nameStart) i++;
  }
  return out;
}

type Tag = { index: number; end: number; attrs: Map<string, string> };

/**
 * Öppningstaggarna för ett element, i den ordning de står. Sökningen går med
 * indexOf och varje tecken läses högst en gång. Mönster som `<img\b[^>]*>`
 * över hela dokumentet går i kvadrat på en sida som är byggd för det, och
 * låser då servern för alla andra.
 */
function openTags(html: string, lower: string, name: string, limit = MAX_TAGS): Tag[] {
  const out: Tag[] = [];
  const needle = `<${name}`;
  let from = 0;
  while (out.length < limit) {
    const start = lower.indexOf(needle, from);
    if (start === -1) break;
    from = start + needle.length;
    const next = lower.charCodeAt(from);
    // "<link" ska inte matcha "<linkfoo".
    if (!(next === 62 || next === 47 || isSpace(next))) continue;
    const end = lower.indexOf(">", from);
    if (end === -1) break;
    from = end + 1;
    if (end - start > MAX_TAG) continue;
    out.push({ index: start, end: end + 1, attrs: parseAttrs(html.slice(start + needle.length, end)) });
  }
  return out;
}

const NOT_A_LOGO =
  /sponsor|partner|samarbet|footer|payment|klarna|swish|visa|mastercard|flag|flagga|lang|cookie|facebook|instagram|twitter|youtube|tiktok|linkedin|app-?store|google-?play|avatar|search|sok|menu|meny|cart/i;

/** Sajtbyggarnas egna standardikoner — tomma eller plattformens märke, aldrig föreningens. */
const PLATFORM_DEFAULT_ICON = /static\.parastorage\.com\/client\/pfavico\.ico|wix\.com\/favicon\.ico/i;

/** Organization / SportsOrganization / SportsTeam med logo, var den än ligger i trädet. */
function jsonLdLogo(text: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Trasig JSON: titta bara precis efter första "logo".
    const at = text.indexOf('"logo"');
    if (at === -1) return null;
    const m = text
      .slice(at, at + 400)
      .match(/^"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/);
    return m ? (m[1] ?? m[2]) : null;
  }
  // Barnen läggs på stacken baklänges, så det som står först i dokumentet
  // läses först. Föreningen står före sponsorer och utgivare.
  const stack: unknown[] = [data];
  for (let visited = 0; stack.length > 0 && visited < 2000; visited++) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (let i = Math.min(node.length, 200) - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    const logo = (node as { logo?: unknown }).logo;
    if (typeof logo === "string" && logo) return logo;
    const url = (logo as { url?: unknown } | null | undefined)?.url;
    if (typeof url === "string" && url) return url;
    const children = Object.values(node).filter((value) => value && typeof value === "object");
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return null;
}

type Candidate = { src: string; score: number };

function candidates(html: string, lower: string, metas: Tag[], base: URL): Candidate[] {
  const out: Candidate[] = [];
  const add = (src: string, score: number) => {
    if (!src || src.startsWith("data:") || PLATFORM_DEFAULT_ICON.test(src)) return;
    try {
      out.push({ src: new URL(src, base).toString(), score });
    } catch {
      // ogiltig adress — hoppa över
    }
  };

  // Strukturerad data. Taggar som ligger inuti ett redan läst skript hoppas
  // över, så sökningen efter sluttaggen aldrig går över samma text två gånger.
  let consumed = 0;
  for (const tag of openTags(html, lower, "script")) {
    if (tag.index < consumed) continue;
    if (!(tag.attrs.get("type") ?? "").toLowerCase().includes("application/ld+json")) continue;
    const close = lower.indexOf("</script", tag.end);
    if (close === -1) break;
    consumed = close;
    if (close - tag.end > MAX_JSON_LD) continue;
    const logo = jsonLdLogo(html.slice(tag.end, close));
    if (logo) add(logo, 90);
  }

  // <img> med "logo" i klass, id, alt eller filnamn. Tidigt i sidan = sidhuvudet.
  openTags(html, lower, "img").forEach((tag, i) => {
    const a = tag.attrs;
    const src =
      a.get("src") || a.get("data-src") || a.get("data-lazy-src") || (a.get("srcset") ?? "").split(/\s+/)[0];
    const hay = `${a.get("class") ?? ""} ${a.get("id") ?? ""} ${a.get("alt") ?? ""} ${src}`.toLowerCase();
    if (!/logo|logga|emblem|klubbm[aä]rke|crest|badge/.test(hay) || NOT_A_LOGO.test(hay)) return;
    const position = tag.index / Math.max(1, html.length);
    add(src, 80 - Math.min(30, i * 3) - (position > 0.5 ? 25 : 0));
  });

  // Ikoner: apple-touch-icon och stora favicons är ofta föreningens märke.
  for (const tag of openTags(html, lower, "link")) {
    const rel = (tag.attrs.get("rel") ?? "").toLowerCase();
    const href = tag.attrs.get("href") ?? "";
    if (!href || !rel.includes("icon")) continue;
    const size = Number((tag.attrs.get("sizes") ?? "").split("x")[0]) || 0;
    if (rel.includes("apple-touch-icon")) add(href, 55);
    else if (size >= 96) add(href, 50);
  }

  const og = metaContent(metas, "property", "og:image");
  if (og) add(og, 20);

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seen.has(c.src) ? false : (seen.add(c.src), true)))
    .slice(0, 4);
}

function metaContent(metas: Tag[], key: "property" | "name", value: string): string {
  const tag = metas.find((m) => (m.attrs.get(key) ?? "").toLowerCase() === value);
  return tag?.attrs.get("content") ?? "";
}

function titleText(html: string, lower: string): string {
  const [tag] = openTags(html, lower, "title", 1);
  if (!tag) return "";
  const close = lower.indexOf("</title", tag.end);
  if (close === -1) return "";
  return decode(html.slice(tag.end, Math.min(close, tag.end + 300)));
}

function siteName(html: string, lower: string, metas: Tag[]): string | null {
  const fromOg = metaContent(metas, "property", "og:site_name").slice(0, 300);
  const title = titleText(html, lower);
  // Wix kapar og:site_name till 20 tecken; titeln har oftast hela namnet.
  const fullFromTitle = fromOg
    ? title.split(/\s+[|–—-]\s+|\s*\|\s*/).find((p) => p.length > fromOg.length && p.startsWith(fromOg))
    : undefined;
  const raw = fullFromTitle || fromOg || title;
  if (!raw) return null;
  const first = raw
    .split(/\s+[|–—-]\s+|\s*\|\s*/)[0]
    .replace(/^(välkommen till|welcome to|startsida|hem|start)\s*[-–:]?\s*/i, "")
    .trim();
  return first && first.length <= 60 && !/^(laget\.se|home|start|hem)$/i.test(first) ? first : null;
}

function themeColor(metas: Tag[]): string | null {
  for (const name of ["theme-color", "msapplication-tilecolor"]) {
    const color = hex(metaContent(metas, "name", name));
    if (color && !isNeutral(color)) return color;
  }
  return null;
}

async function imageDataUrl(url: URL, deadline: number): Promise<string | null> {
  // Ingen avif i Accept: CDN:er som Wix svarar då med avif, som alla webbläsare inte kan rita på canvas.
  const res = await safeFetch(url, "image/webp,image/png,image/svg+xml,image/*;q=0.8", MAX_IMAGE, deadline).catch(
    () => null
  );
  if (!res) return null;
  const type = res.type.split(";")[0].trim().toLowerCase();
  if (!/^image\/(png|jpeg|jpg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(type)) return null;
  if (res.body.byteLength < 200) return null;
  return `data:${type};base64,${res.body.toString("base64")}`;
}

async function fromHtml(url: URL, deadline: number): Promise<ClubBrand> {
  const page = await safeFetch(url, "text/html,application/xhtml+xml", MAX_HTML, deadline);
  if (!page || !page.type.includes("html")) throw new BrandError("unreachable");
  const html = page.body.toString("utf8");
  const lower = asciiLower(html);
  const host = page.url.hostname.replace(/^www\./, "");

  const laget = html.match(/"clubUrlName"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
  if (laget) {
    const brand = await fromLaget(laget, host, deadline).catch(() => null);
    if (brand) return brand;
  }

  const metas = openTags(html, lower, "meta");
  let logo: string | null = null;
  for (const c of candidates(html, lower, metas, page.url)) {
    logo = await imageDataUrl(new URL(c.src), deadline).catch(() => null);
    if (logo) break;
  }
  const color = themeColor(metas);
  return { host, name: siteName(html, lower, metas), color, colorSource: color ? "theme" : null, logo };
}

// ── Ingång med cache ────────────────────────────────────────────────────

const cache = new Map<string, { at: number; value: Promise<ClubBrand> }>();
let activeLookups = 0;
let recentLookups: number[] = [];

function lookup(raw: string): Promise<ClubBrand> {
  const url = normalizeSite(raw);
  const key = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;

  recentLookups = recentLookups.filter((t) => now - t < LOOKUP_WINDOW_MS);
  if (activeLookups >= MAX_ACTIVE_LOOKUPS || recentLookups.length >= MAX_LOOKUPS_PER_WINDOW) {
    throw new BrandError("limited");
  }
  recentLookups.push(now);
  activeLookups++;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const lagetPath = host === "laget.se" ? url.pathname.split("/").filter(Boolean)[0] : undefined;
  const deadline = now + TOTAL_BUDGET_MS;
  const value = (async () => {
    try {
      if (lagetPath) {
        const brand = await fromLaget(lagetPath, `laget.se/${lagetPath}`, deadline);
        if (brand) return brand;
      }
      return await fromHtml(url, deadline);
    } finally {
      activeLookups--;
    }
  })();

  if (cache.size >= MAX_CACHED) {
    for (const [k, entry] of cache) if (now - entry.at >= CACHE_MS) cache.delete(k);
    if (cache.size >= MAX_CACHED) cache.clear();
  }
  cache.set(key, { at: now, value });
  value.catch(() => cache.delete(key));
  return value;
}

/** Föreningens namn, färg och logga. Avvisar alltid med BrandError, kastar aldrig direkt. */
export function readClubBrand(raw: string): Promise<ClubBrand> {
  try {
    return lookup(raw);
  } catch (err) {
    return Promise.reject(err);
  }
}
