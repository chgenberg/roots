#!/usr/bin/env node
/**
 * Roots persona army — one-shot walk of every role dashboard + public flow.
 *
 *   WEB_URL=http://localhost:3004 node scripts/persona-army.mjs
 *
 * Writes JSON + screenshots to /tmp/roots-persona-army/<stamp>/
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WEB = process.env.WEB_URL || "http://localhost:3004";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT = process.env.ARMY_OUT || `/tmp/roots-persona-army/${STAMP}`;
mkdirSync(OUT, { recursive: true });

const IGNORE_NET = [
  "/_next/",
  "/favicon",
  "/__nextjs",
  "/v1/auth/me",
  "sentry.io",
];
const IGNORE_CONSOLE = [
  "Download the React DevTools",
  "Fast Refresh",
  "[HMR]",
  "Image with src",
];

const PERSONAS = [
  {
    id: "public",
    name: "Publik besökare",
    role: "PUBLIC",
    email: null,
    pages: [
      "/",
      "/produkter",
      "/produkter/shampoo",
      "/produkter/conditioner",
      "/produkter/body-wash",
      "/produkter/paket",
      "/foreningsliv",
      "/om-oss",
      "/guider",
      "/sa-fungerar-det",
      "/kontakt",
      "/hjalp",
      "/integritet",
      "/villkor",
      "/login",
      "/registrera",
      "/registrera/saljare/demo-assoc-team-invite",
      "/shop/demo-assoc-leo",
      "/en-sida-som-inte-finns",
    ],
  },
  {
    id: "anna-klubb",
    name: "Anna — klubbadmin",
    role: "CLUB_ADMIN",
    email: "klubb@demo.se",
    pages: [
      "/portal",
      "/portal/bestallningar",
      "/portal/fakturor",
      "/portal/medlemmar",
      "/portal/intakter",
      "/portal/produkter",
      "/portal/ai",
      "/portal/installningar",
    ],
  },
  {
    id: "erik-salj",
    name: "Erik — säljare",
    role: "SALES_REP",
    email: "salj@roots.se",
    pages: [
      "/portal",
      "/portal/pipeline",
      "/portal/klubbar",
      "/portal/offerter",
      "/portal/raknesnurra",
      "/portal/statistik",
      "/portal/ai",
      "/portal/installningar",
    ],
  },
  {
    id: "maria-admin",
    name: "Maria — intern admin",
    role: "INTERNAL_ADMIN",
    email: "admin@roots.se",
    pages: [
      "/portal",
      "/portal/granskning",
      "/portal/feedback",
      "/portal/utbetalningar",
      "/portal/klubbar",
      "/portal/saljare",
      "/portal/bestallningar",
      "/portal/statistik",
      "/portal/system",
      "/portal/audit-log",
      "/portal/ai",
      "/portal/installningar",
    ],
  },
  {
    id: "karin-forening",
    name: "Karin — föreningsadmin",
    role: "ASSOCIATION_ADMIN",
    email: "forening@demo-if.se",
    pages: [
      "/forening",
      "/forening/statistik",
      "/forening/kom-igang",
      "/forening/lag",
      "/forening/mal",
      "/forening/kalender",
      "/forening/avrakning",
      "/installningar",
    ],
  },
  {
    id: "mikael-lag",
    name: "Mikael — lagledare",
    role: "TEAM_LEADER",
    email: "lag@demo-if.se",
    pages: [
      "/lag",
      "/lag/statistik",
      "/lag/saljare",
      "/lag/bestallningar",
      "/lag/chatt",
      "/lag/avrakning",
      "/installningar",
    ],
  },
  {
    id: "leo-saljare",
    name: "Leo — säljare i förening",
    role: "SELLER",
    email: "leo.assoc@demo-if.se",
    pages: [
      "/min-shop",
      "/min-shop/statistik",
      "/min-shop/bestallningar",
      "/min-shop/chatt",
      "/installningar",
    ],
  },
];

const findings = [];

function addFinding(persona, page, severity, title, detail = "") {
  findings.push({ persona, page, severity, title, detail });
  const mark = severity === "P0" ? "P0" : severity === "P1" ? "P1" : severity;
  console.log(`  ${mark}  ${persona} ${page} — ${title}${detail ? `: ${detail}` : ""}`);
}

async function login(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const csrfRes = await page.request.get(`${WEB}/api/v1/csrf-token`);
  const csrf = await csrfRes.json().catch(() => ({}));
  const loginRes = await page.request.post(`${WEB}/api/v1/auth/login`, {
    data: { email, password: PASSWORD, locale: "sv" },
    headers: {
      "Content-Type": "application/json",
      ...(csrf.token ? { "x-csrf-token": csrf.token } : {}),
    },
  });
  if (!loginRes.ok()) {
    const body = await loginRes.json().catch(() => ({}));
    console.log(`  login API ${loginRes.status()} ${body.error || ""}`);
    return false;
  }
  await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
  return true;
}

async function logout(page) {
  try {
    await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const logoutBtn = page.getByRole("button", { name: /logga ut|logout/i });
    if (await logoutBtn.count()) {
      await logoutBtn.first().click({ timeout: 3000 }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
  await page.context().clearCookies();
}

function classifyPage(html, status, finalUrl, path) {
  const text = html.replace(/\s+/g, " ").slice(0, 8000);
  const lower = text.toLowerCase();
  const issues = [];

  if (status >= 500) issues.push({ severity: "P0", title: `HTTP ${status}` });
  if (path !== "/en-sida-som-inte-finns" && status === 404)
    issues.push({ severity: "P0", title: "HTTP 404" });
  if (path === "/en-sida-som-inte-finns" && status !== 404 && !lower.includes("404"))
    issues.push({ severity: "P1", title: "Saknad 404-sida" });

  if (finalUrl.includes("/login") && !path.startsWith("/login"))
    issues.push({ severity: "P0", title: "Redirectades till login" });

  if (
    lower.includes("application error") ||
    lower.includes("uncaught") ||
    lower.includes("something went wrong") ||
    (lower.includes("något gick fel") && lower.includes("stack"))
  ) {
    issues.push({ severity: "P0", title: "Crash / application error" });
  }

  if (
    text.includes("/registrera/saljare/undefined") ||
    text.includes("/registrera/lagansvarig/undefined")
  ) {
    issues.push({ severity: "P0", title: "Inbjudningslänk är undefined" });
  }

  const looksEmpty =
    text.length < 400 ||
    (lower.includes("kunde inte") && lower.includes("hämta") && !lower.includes("försök igen") === false);
  if (looksEmpty && status === 200 && !path.includes("inte-finns"))
    issues.push({ severity: "P1", title: "Sidan ser tom eller trasig ut" });

  return issues;
}

async function walkPersona(browser, persona) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const netErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORE_CONSOLE.some((p) => msg.text().includes(p))) {
      consoleErrors.push(msg.text().slice(0, 240));
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`PAGE_ERROR: ${err.message.slice(0, 240)}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && !IGNORE_NET.some((p) => url.includes(p))) {
      netErrors.push({ status: res.status(), url: url.slice(0, 180) });
    }
  });

  console.log(`\n=== ${persona.name} (${persona.role}) ===`);

  if (persona.email) {
    const ok = await login(page, persona.email);
    if (!ok) {
      addFinding(persona.id, "/login", "P0", "Inloggning misslyckades", persona.email);
      await page.close();
      return { persona: persona.id, login: false, pages: [] };
    }
    console.log("  login ok");
  }

  const pageResults = [];

  for (const path of persona.pages) {
    consoleErrors.length = 0;
    netErrors.length = 0;
    let status = 0;
    let finalUrl = "";
    try {
      const res = await page.goto(`${WEB}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      status = res?.status() ?? 0;
      const settleMs = path.includes("/lag") || path.includes("/forening") ? 2200 : 1400;
      await page.waitForTimeout(settleMs);
      finalUrl = page.url();
    } catch (err) {
      addFinding(persona.id, path, "P0", "Navigation fail", err.message.slice(0, 160));
      pageResults.push({ path, status: 0, ok: false });
      continue;
    }

    const html = await page.content();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const issues = classifyPage(html, status, finalUrl, path);

    for (const issue of issues) {
      addFinding(persona.id, path, issue.severity, issue.title);
    }

    const uniqueNet = [...new Map(netErrors.map((n) => [n.status + n.url, n])).values()];
    for (const n of uniqueNet.filter((x) => x.status >= 500)) {
      addFinding(persona.id, path, "P0", `API ${n.status}`, n.url);
    }
    for (const n of uniqueNet.filter((x) => x.status >= 400 && x.status < 500 && x.status !== 401 && x.status !== 404)) {
      addFinding(persona.id, path, "P1", `API ${n.status}`, n.url);
    }

    const pageErrs = consoleErrors.filter((t) => t.startsWith("PAGE_ERROR:"));
    for (const e of pageErrs.slice(0, 3)) {
      addFinding(persona.id, path, "P1", "JS pageerror", e);
    }

    const shot = join(OUT, `${persona.id}${path.replaceAll("/", "_") || "_home"}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

    const heading = await page.locator("h1, h2").first().innerText().catch(() => "");
    pageResults.push({
      path,
      status,
      finalUrl,
      heading: heading.slice(0, 80),
      bodyChars: bodyText.length,
      net: uniqueNet,
      ok: issues.length === 0 && uniqueNet.every((n) => n.status < 500),
    });
    process.stdout.write(`  ${status} ${path}${heading ? ` — ${heading.slice(0, 40)}` : ""}\n`);
  }

  if (persona.email) await logout(page);
  await page.close();
  return { persona: persona.id, login: true, pages: pageResults };
}

async function extraFlows(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log("\n=== Extraflöden ===");

  await page.goto(`${WEB}/kontakt`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(600);
    const invalid = await page.locator(":invalid, [aria-invalid=true]").count();
    if (invalid === 0) {
      addFinding("public", "/kontakt", "P1", "Kontaktformulär accepterar tom submit");
    } else {
      console.log("  kontakt: validering stoppar tom submit");
    }
  }

  await page.goto(`${WEB}/shop/demo-assoc-leo`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const addBtns = page.getByRole("button", { name: /lägg|köp|beställ|\+/i });
  const shopOk = (await page.locator("h1, h2").count()) > 0;
  if (!shopOk) addFinding("public", "/shop/demo-assoc-leo", "P0", "Shop renderar utan rubrik");
  console.log(`  shop demo-assoc-leo: ${shopOk ? "ok" : "trasig"}, add-knappar=${await addBtns.count()}`);
  await page.screenshot({ path: join(OUT, "shop-demo-assoc-leo.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const burger = page.locator("button[aria-expanded], button[aria-label*='meny' i], button[aria-label*='menu' i]");
  if ((await burger.count()) === 0) {
    addFinding("public-mobile", "/", "P1", "Ingen hamburgermeny på 390px");
  } else {
    await burger.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, "mobile-menu.png") });
    console.log("  mobilmeny: öppnas");
  }

  await page.close();

  const write = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log("\n=== Skrivvägar ===");

  const erikOk = await login(write, "salj@roots.se");
  if (erikOk) {
    await write.goto(`${WEB}/portal/pipeline`, { waitUntil: "domcontentloaded" });
    await write.waitForTimeout(1600);
    const newLead = write.getByRole("button", { name: /nytt lead/i });
    if ((await newLead.count()) === 0) {
      addFinding("erik-salj", "/portal/pipeline", "P1", "Knappen Nytt lead saknas");
    } else {
      await newLead.first().click();
      await write.waitForTimeout(500);
      const dialog = write.getByRole("dialog");
      if ((await dialog.count()) === 0) {
        addFinding("erik-salj", "/portal/pipeline", "P1", "Nytt lead-dialog öppnas inte");
      } else {
        console.log("  erik: Nytt lead-dialog öppnas");
      }
      await write.screenshot({ path: join(OUT, "write-erik-new-lead.png") });
    }
    await logout(write);
  }

  const karinOk = await login(write, "forening@demo-if.se");
  if (karinOk) {
    await write.goto(`${WEB}/forening/lag`, { waitUntil: "domcontentloaded" });
    await write.waitForTimeout(2500);
    const inviteVals = await write.locator("input[readonly]").evaluateAll((els) =>
      els.map((el) => el.value || "")
    );
    const broken = inviteVals.filter((v) => v.includes("/undefined"));
    const good = inviteVals.filter((v) => /\/registrera\/saljare\/[A-Za-z0-9_-]+/.test(v));
    if (broken.length) {
      addFinding("karin-forening", "/forening/lag", "P0", "Inbjudningslänk är undefined", broken[0]);
    } else if (good.length === 0) {
      addFinding("karin-forening", "/forening/lag", "P1", "Ingen giltig säljarinbjudan i fältet");
    } else {
      console.log(`  karin: invite ${good[0]}`);
    }

    const createTeam = write.getByRole("button", { name: /skapa nytt lag|skapa ert första/i });
    if (await createTeam.count()) {
      await createTeam.first().click();
      await write.waitForTimeout(400);
      const dlg = write.getByRole("dialog");
      if ((await dlg.count()) === 0) {
        addFinding("karin-forening", "/forening/lag", "P1", "Skapa lag-dialog öppnas inte");
      } else {
        console.log("  karin: skapa-lag-dialog öppnas");
      }
    }
    await write.screenshot({ path: join(OUT, "write-karin-lag.png") });
    await logout(write);
  }

  const mikaelOk = await login(write, "lag@demo-if.se");
  if (mikaelOk) {
    await write.goto(`${WEB}/lag`, { waitUntil: "domcontentloaded" });
    await write.waitForTimeout(2000);
    const body = await write.locator("body").innerText();
    if (body.includes("/undefined")) {
      addFinding("mikael-lag", "/lag", "P0", "Inbjudningslänk är undefined");
    } else if (!/registrera\/saljare\/[A-Za-z0-9_-]+/.test(await write.content())) {
      addFinding("mikael-lag", "/lag", "P1", "Ingen säljarinbjudan på lagöversikten");
    } else {
      console.log("  mikael: säljarinbjudan syns");
    }
    await write.screenshot({ path: join(OUT, "write-mikael-lag.png") });
    await logout(write);
  }

  const annaOk = await login(write, "klubb@demo.se");
  if (annaOk) {
    await write.goto(`${WEB}/portal/bestallningar`, { waitUntil: "domcontentloaded" });
    await write.waitForTimeout(1600);
    const heading = await write.locator("h1, h2").first().innerText().catch(() => "");
    if (!heading) addFinding("anna-klubb", "/portal/bestallningar", "P1", "Beställningar utan rubrik");
    else console.log(`  anna: ${heading}`);
    await write.screenshot({ path: join(OUT, "write-anna-orders.png") });
    await logout(write);
  }

  await write.close();
}

const browser = await chromium.launch({ headless: true });
const personaReports = [];
try {
  for (const persona of PERSONAS) {
    personaReports.push(await walkPersona(browser, persona));
  }
  await extraFlows(browser);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.severity === "P0");
const p1 = findings.filter((f) => f.severity === "P1");
const p2 = findings.filter((f) => f.severity === "P2");

const report = {
  stamp: STAMP,
  web: WEB,
  out: OUT,
  counts: { p0: p0.length, p1: p1.length, p2: p2.length, pages: personaReports.reduce((n, r) => n + r.pages.length, 0) },
  findings,
  personas: personaReports,
};

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nKLAR — ${p0.length} P0, ${p1.length} P1, ${p2.length} P2`);
console.log(`Rapport: ${join(OUT, "report.json")}`);
if (p0.length) process.exitCode = 1;
