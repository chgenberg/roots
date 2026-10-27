// Medlemsantal utan betald sökning: vanlig Bing/Brave/DuckDuckGo-sökning (samma kö som
// Newwave/scripts/scrape-clubs.mjs), läser de bästa träffarna inklusive PDF och låter den
// billigaste modellen välja siffran bland meningar som nämner medlemmar.
//
//   node docs/leads/members_free.mjs targets.json out.jsonl [--workers=6] [--limit=N]
//
// targets.json: [{ row, name, kommun, sport, site }]. Körningen kan avbrytas och startas om.
// Utdata har samma form som enrich_members.py så att build_utskick.py --berikning läser den.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const NEWWAVE = process.env.PLAYWRIGHT_FROM ?? path.join(os.homedir(), "Desktop/Newwave/content-machine");
const MODEL = process.env.ENRICH_MODEL ?? "gpt-6-luna";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const flag = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const [targetsFile, outFile] = args.filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(new Date().toLocaleTimeString("sv-SE"), ...m);

for (const line of existsSync(path.join(ROOT, ".env")) ? readFileSync(path.join(ROOT, ".env"), "utf8").split("\n") : []) {
  const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]] && m[2].trim()) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

/* ---------- Namn ---------- */

const fold = (s) => String(s ?? "").toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const GENERIC = new Set(
  "if ik sk fk bk ff fc ibk ibf ibs hk hf gif aik bois bik gik sif iff ok bf bwk tk sok rk ssk kk ck ak cf fbk hc idrottsforening idrottsklubb idrottssallskap forening foreningen klubb klubben sportklubb bollklubb fotbollsklubb fotbollsforening innebandyklubb handbollsklubb hockeyklubb ishockeyklubb skidklubb ridklubb tennisklubb golfklubb simklubb orienteringsklubb bowlingklubb gymnastikforening friidrottsklubb och av i for".split(" "),
);
const coreTokens = (name) => fold(name).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !GENERIC.has(t));
function textMatch(text, name) {
  const t = ` ${fold(text).replace(/[^a-z0-9]+/g, " ")} `;
  const full = fold(name).replace(/[^a-z0-9]+/g, " ").trim();
  if (full && t.includes(` ${full} `)) return 1;
  const core = coreTokens(name);
  if (!core.length) return 0;
  return core.filter((w) => t.includes(` ${w} `) || (w.length > 5 && w.endsWith("s") && t.includes(` ${w.slice(0, -1)} `))).length / core.length;
}

/* ---------- Sökmotorer (samma kö och vilotider som Newwave) ---------- */

const require = createRequire(path.join(NEWWAVE, "package.json"));
let bingPage = null;
async function bingSearch(q) {
  if (!bingPage || bingPage.isClosed() || !bingPage.context().browser()?.isConnected()) {
    await bingPage?.context().browser()?.close().catch(() => {});
    const { chromium } = require("playwright-core");
    const b = await chromium.launch({ channel: "chrome", args: ["--disable-blink-features=AutomationControlled"] });
    const ctx = await b.newContext({ locale: "sv-SE", viewport: { width: 1280, height: 900 }, userAgent: UA });
    bingPage = await ctx.newPage();
  }
  const res = await bingPage.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=sv&cc=SE`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await bingPage.waitForSelector("li.b_algo h2 a, #b_results .b_no", { timeout: 8000 }).catch(() => {});
  const results = await bingPage.$$eval("li.b_algo h2 a", (as) => as.map((a) => ({ url: a.href, title: a.textContent ?? "" }))).catch(() => []);
  const blocked = !results.length && /captcha|challenge|verify|verifiera/i.test(`${await bingPage.title().catch(() => "")}`);
  return {
    status: res?.status() ?? 0,
    blocked,
    results: results.map((r) => {
      try {
        const u = new URL(r.url).searchParams.get("u");
        return u?.startsWith("a1") ? { ...r, url: Buffer.from(u.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString() } : r;
      } catch {
        return r;
      }
    }),
  };
}
const decodeHtml = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const stripTags = (s) => decodeHtml(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const ENGINES = {
  bing: { gap: 8000, run: bingSearch },
  brave: {
    gap: 9000,
    url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`,
    parse: (html) =>
      [...html.matchAll(/data-type="web"[\s\S]*?<a href="(https?:\/\/[^"]+)"[\s\S]*?<div class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => ({ url: decodeHtml(m[1]), title: stripTags(m[2]) })),
  },
  ddg: {
    gap: 7000,
    url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=se-sv`,
    parse: (html) =>
      [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
        .map((m) => {
          const href = decodeHtml(m[1]);
          const u = href.match(/[?&]uddg=([^&]+)/)?.[1];
          return { url: u ? decodeURIComponent(u) : href.startsWith("//") ? `https:${href}` : href, title: stripTags(m[2]) };
        })
        .filter((r) => /^https?:\/\//.test(r.url) && !/duckduckgo\.com\/y\.js/.test(r.url)),
  },
};
const engineState = Object.fromEntries(Object.keys(ENGINES).map((k) => [k, { next: 0, blockedUntil: 0, strikes: 0 }]));
async function fetchEngine(q, e) {
  const res = await fetch(e.url(q), { headers: { "User-Agent": UA, "Accept-Language": "sv-SE,sv;q=0.9", Accept: "text/html" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const html = res ? await res.text().catch(() => "") : "";
  const results = res?.ok ? e.parse(html) : [];
  return { status: res?.status ?? 0, results, blocked: !res || res.status === 429 || res.status === 403 || (!results.length && /captcha|anomaly|unusual traffic|too many requests|are you a robot|challenge/i.test(html)) };
}
let searchChain = Promise.resolve();
function search(q) {
  const run = searchChain.then(async () => {
    for (let lap = 0; lap < 40; lap++) {
      const now = Date.now();
      const ready = Object.entries(engineState).filter(([, s]) => s.blockedUntil <= now).sort((a, b) => a[1].next - b[1].next);
      if (!ready.length) {
        const wake = Math.min(...Object.values(engineState).map((s) => s.blockedUntil));
        log(`alla sökmotorer vilar, väntar ${Math.round((wake - now) / 60000)} min`);
        await sleep(Math.max(5000, wake - now));
        continue;
      }
      const [name, s] = ready[0];
      if (s.next > now) await sleep(s.next - now);
      const e = ENGINES[name];
      s.next = Date.now() + e.gap + Math.random() * 3000;
      const { status, blocked, results } = await (e.run ?? fetchEngine)(q, e).catch((err) => ({ status: String(err.message ?? err).slice(0, 60), blocked: true, results: [] }));
      if (blocked) {
        s.strikes++;
        s.blockedUntil = Date.now() + Math.min(60, 5 * 2 ** (s.strikes - 1)) * 60_000;
        log(`${name} blockerar (${status || "inget svar"}), vilar ${Math.round((s.blockedUntil - Date.now()) / 60000)} min`);
        if (name === "bing") await bingPage?.context().browser()?.close().catch(() => {});
        continue;
      }
      s.strikes = 0;
      return { engine: name, results: results.slice(0, 8) };
    }
    return { engine: "", results: [] };
  });
  searchChain = run.catch(() => {});
  return run;
}

/* ---------- Sidor ---------- */

const SKIP_HOST = /(^|\.)(facebook|instagram|linkedin|youtube|tiktok|x|twitter|allabolag|ratsit|merinfo|hitta|eniro|proff|bolagsfakta|wikipedia)\./i;
async function pdfText(buf) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "medl-"));
  const file = path.join(dir, "a.pdf");
  await writeFile(file, buf);
  const text = await new Promise((resolve) =>
    execFile("pdftotext", ["-l", "20", "-layout", file, "-"], { timeout: 30_000, maxBuffer: 20e6 }, (err, out) => resolve(err ? "" : out)),
  );
  await rm(dir, { recursive: true, force: true });
  return text;
}
async function pageText(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "sv-SE,sv;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12e6) return "";
    if (/pdf/i.test(res.headers.get("content-type") ?? "") || url.toLowerCase().endsWith(".pdf")) return pdfText(buf);
    const html = buf.toString("utf8");
    return decodeHtml(html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td)>/gi, "\n").replace(/<[^>]+>/g, " "))
      .replace(/&nbsp;|\u00a0/g, " ")
      .replace(/[ \t]+/g, " ");
  } catch {
    return "";
  }
}
const MEMBER = /[^.!?\n]{0,140}\b\d{1,3}(?:[ .]?\d{3})?\s*(?:st\.?\s*)?(?:aktiva\s+|betalande\s+|registrerade\s+)?(?:medlemmar|aktiva|utövare|spelare|licenser|licensierade)[^.!?\n]{0,140}|[^.!?\n]{0,100}(?:medlemsantal|antal medlemmar)[^.!?\n]{0,100}/gi;

/* ---------- Modellen ---------- */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    members_total: { type: ["integer", "null"] },
    members_active: { type: ["integer", "null"] },
    members_year: { type: ["integer", "null"] },
    members_quote: { type: ["string", "null"] },
    members_source: { type: ["string", "null"] },
    note: { type: ["string", "null"] },
  },
  required: ["members_total", "members_active", "members_year", "members_quote", "members_source", "note"],
};
async function pick(t, lines) {
  const body = {
    model: MODEL,
    input:
      `Förening: ${t.name} (${t.kommun}), idrott: ${t.sport}.\n` +
      "Nedan är meningar från webbsidor som nämner medlemmar. Välj den siffra som gäller just den här föreningen " +
      "(inte förbundet, kommunen eller en annan klubb). Ta den senaste. Ange totalt och aktiva/utövare om det särskiljs, " +
      "år, citatet ordagrant och URL. Hittar du ingen säker siffra: null. note: kort på svenska om något är osäkert.\n\n" +
      lines.map((l) => `[${l.url}] ${l.text}`).join("\n"),
    text: { format: { type: "json_schema", name: "m", schema: SCHEMA, strict: true } },
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`modell ${res.status} ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "output_text")?.text ?? "{}";
  return { found: JSON.parse(text), usage: { in: data.usage?.input_tokens ?? 0, out: data.usage?.output_tokens ?? 0, searches: 0 } };
}

const numberIn = (n, text) => {
  if (!n || !text) return false;
  const s = String(n);
  const variants = [s, ...(s.length > 3 ? [`${s.slice(0, -3)} ${s.slice(-3)}`, `${s.slice(0, -3)}.${s.slice(-3)}`] : [])];
  return variants.some((v) => new RegExp(`(?<!\\d)${v.replace(".", "\\.")}(?!\\d)`).test(text.replace(/\u202f/g, " ")));
};

/* ---------- En förening ---------- */

async function processOne(t) {
  const q = `"${t.name}" ${t.kommun} medlemmar`;
  const { engine, results } = await search(q);
  const urls = [...new Set([t.site, ...results.map((r) => r.url)].filter(Boolean))]
    .filter((u) => {
      try {
        return !SKIP_HOST.test(new URL(u).hostname);
      } catch {
        return false;
      }
    })
    .slice(0, 6);
  const pages = await Promise.all(urls.map(async (url) => ({ url, text: await pageText(url) })));
  const lines = [];
  for (const p of pages) {
    if (!p.text || textMatch(p.text.slice(0, 200_000), t.name) < 0.6) continue;
    for (const m of p.text.matchAll(MEMBER)) {
      const text = m[0].replace(/\s+/g, " ").trim();
      if (/\d/.test(text) && !lines.some((l) => l.text === text)) lines.push({ url: p.url, text });
      if (lines.length >= 40) break;
    }
  }
  let found = null;
  let usage = { in: 0, out: 0, searches: 0 };
  if (lines.length) ({ found, usage } = await pick(t, lines.slice(0, 40)));
  const n = found && (found.members_active || found.members_total);
  const src = found && pages.find((p) => p.url === found.members_source);
  return {
    row: t.row,
    name: t.name,
    engine,
    found: {
      website: null,
      email: null,
      email_source: null,
      ...(found ?? { members_total: null, members_active: null, members_year: null, members_quote: null, members_source: null, note: null }),
    },
    check: { members_on_page: Boolean(n && src && numberIn(n, src.text)), members_page_ok: Boolean(src?.text), email_on_page: false, email_mx: false },
    usage,
    lines: lines.length,
  };
}

/* ---------- Körning ---------- */

const targets = JSON.parse(readFileSync(targetsFile, "utf8"));
const done = new Set(existsSync(outFile) ? readFileSync(outFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).row) : []);
const todo = targets.filter((t) => !done.has(t.row)).slice(0, Number(flag("limit", 1e9)));
log(`${todo.length} föreningar kvar, ${done.size} klara`);
let next = 0;
let finished = 0;
let hits = 0;
let usd = 0;
async function worker() {
  while (next < todo.length) {
    const t = todo[next++];
    try {
      const rec = await processOne(t);
      appendFileSync(outFile, `${JSON.stringify(rec)}\n`);
      finished++;
      if (rec.found.members_total || rec.found.members_active) hits++;
      usd += rec.usage.in / 1e6 * 0.1 + rec.usage.out / 1e6 * 0.5;
      if (finished % 25 === 0 || finished === todo.length) log(`${finished}/${todo.length} klara, ${hits} med medlemsantal, $${usd.toFixed(3)}`);
    } catch (e) {
      log(`FEL ${t.name}: ${String(e.message ?? e).slice(0, 160)}`);
    }
  }
}
await Promise.all(Array.from({ length: Number(flag("workers", 6)) }, worker));
await bingPage?.context().browser()?.close().catch(() => {});
log("KLAR");
