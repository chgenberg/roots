#!/usr/bin/env node

/**
 * Roots — Persona-based QA Test Suite
 *
 * Simulates 10 fictional users navigating the site in Chromium.
 * Run:  node tests/persona-test.mjs
 * Stop: Ctrl+C
 *
 * Dependencies: playwright, @axe-core/playwright
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || "http://localhost:3003";
const API_URL = process.env.API_URL || "http://localhost:4000";
const ROUND_DELAY_MS = 60_000;
const PAGE_TIMEOUT = 30_000;
const NAV_WAIT = "domcontentloaded";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// ─── Demo credentials ────────────────────────────────────────────────────────

const CREDS = {
  club: { email: "klubb@demo.se", password: "Demo1234!" },
  sales: { email: "salj@roots.se", password: "Demo1234!" },
  admin: { email: "admin@roots.se", password: "Demo1234!" },
};

// ─── Known patterns to filter from reports ───────────────────────────────────

const IGNORED_CONSOLE = [
  "Download the React DevTools",
  "Fast Refresh",
  "Image with src",
  "[HMR]",
  "next-dev.js",
  "webpack",
];

const IGNORED_NETWORK_PATHS = [
  "/_next/",
  "/favicon.ico",
  "/__nextjs",
  "/v1/auth/me", // expected 401 when not logged in
];

// ─── 10 Personas ─────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    id: "anna-klubbadmin",
    name: "Anna, 42 — Föreningsordförande",
    description: "Klubbadmin som hanterar medlemmar, beställer produkter och kollar intäkter",
    login: CREDS.club,
    journeys: [
      // Public pages first
      "/", "/produkter", "/foreningsliv", "/haranalys", "/kontakt",
      // Log in and use portal
      "LOGIN",
      "/portal", "/portal/bestallningar", "/portal/medlemmar",
      "/portal/intakter", "/portal/produkter", "/portal/ai",
      "/portal/installningar",
      "LOGOUT",
    ],
  },
  {
    id: "erik-saljare",
    name: "Erik, 35 — Säljrepresentant",
    description: "Säljarroll som hanterar pipeline, offerter, klubbar och statistik",
    login: CREDS.sales,
    journeys: [
      "/", "/foreningsliv", "/om-oss",
      "LOGIN",
      "/portal", "/portal/pipeline", "/portal/klubbar",
      "/portal/offerter", "/portal/statistik", "/portal/ai",
      "/portal/installningar",
      "LOGOUT",
      // Sales portal
      "/sales/dashboard", "/sales/offerter", "/sales/ordrar",
      "/sales/kunder",
    ],
  },
  {
    id: "maria-admin",
    name: "Maria, 38 — Intern admin",
    description: "Full tillgång — kollar system, säljare, statistik, beställningar",
    login: CREDS.admin,
    journeys: [
      "/",
      "LOGIN",
      "/portal", "/portal/klubbar", "/portal/saljare",
      "/portal/bestallningar", "/portal/statistik", "/portal/system",
      "/portal/ai", "/portal/installningar",
      "LOGOUT",
    ],
  },
  {
    id: "gustav-skeptiker",
    name: "Gustav, 55 — Skeptisk besökare",
    description: "Läser allt noggrant — produktsidor, villkor, integritetspolicy, om oss",
    login: null,
    journeys: [
      "/", "/produkter", "/produkter/shampoo", "/produkter/conditioner",
      "/produkter/body-wash", "/om-oss", "/integritet", "/villkor",
      "/kontakt", "/haranalys",
    ],
  },
  {
    id: "lisa-mobilanvandare",
    name: "Lisa, 28 — Mobilanvändare",
    description: "Surfar bara på mobilen, snabb och otålig, testar mobil-UX",
    login: null,
    mobileOnly: true,
    journeys: [
      "/", "/produkter", "/produkter/shampoo", "/foreningsliv",
      "/haranalys", "/kontakt", "/om-oss", "/login",
    ],
  },
  {
    id: "bertil-senior",
    name: "Bertil, 72 — Senior med tillgänglighetsbehov",
    description: "Testar tangentbordsnavigation, kontrast, skärmläsarvänlighet",
    login: null,
    a11yFocus: true,
    journeys: [
      "/", "/produkter", "/produkter/shampoo", "/om-oss",
      "/kontakt", "/foreningsliv", "/login", "/integritet",
    ],
  },
  {
    id: "fatima-impulskopar",
    name: "Fatima, 31 — Impulsköpare",
    description: "Klickar snabbt, vill hitta köpflöde direkt, testar shop/kassa",
    login: null,
    journeys: [
      "/", "/produkter", "/produkter/shampoo",
      "/shop/demo-seller",
      "/foreningsliv", "/haranalys",
    ],
  },
  {
    id: "oscar-random",
    name: "Oscar, 22 — Random-klickare",
    description: "Testar alla länkar, hittar 404-sidor, klickar på allt",
    login: null,
    linkSampler: true,
    journeys: [
      "/", "/produkter", "/foreningsliv", "/om-oss",
      "/kontakt", "/haranalys", "/login", "/registrera",
      "/en-sida-som-inte-finns", "/produkter/non-existent-product",
    ],
  },
  {
    id: "klara-klubbmedlem",
    name: "Klara, 45 — Klubbmedlem",
    description: "Loggar in som klubbadmin, kollar club-portalen",
    login: CREDS.club,
    journeys: [
      "/",
      "LOGIN",
      "/club/dashboard", "/club/bestall", "/club/historik", "/club/konto",
      "LOGOUT",
    ],
  },
  {
    id: "niklas-formtest",
    name: "Niklas, 33 — Formulärtestare",
    description: "Testar alla formulär med tom/felaktig input",
    login: null,
    formTester: true,
    journeys: [
      "/kontakt", "/login", "/registrera",
    ],
  },
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function log(persona, msg) {
  const now = new Date().toLocaleTimeString("sv-SE");
  console.log(`  [${now}] ${persona.id} → ${msg}`);
}

function shouldIgnoreConsole(text) {
  return IGNORED_CONSOLE.some((p) => text.includes(p));
}

function shouldIgnoreNetworkPath(url) {
  return IGNORED_NETWORK_PATHS.some((p) => url.includes(p));
}

// ─── Core test functions ─────────────────────────────────────────────────────

async function login(page, creds, persona) {
  log(persona, "Logging in...");

  // Set session cookie via direct API call (bypasses slow UI hydration)
  try {
    const apiRes = await page.request.post(`${API_URL}/v1/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { "Content-Type": "application/json" },
    });
    if (apiRes.ok()) {
      log(persona, "✓ Logged in (API)");
      return true;
    }
  } catch { /* fall through to UI login */ }

  // Fallback: UI-based login
  await page.goto(`${BASE_URL}/login`, { waitUntil: "load", timeout: PAGE_TIMEOUT });
  await page.waitForTimeout(3000);

  try {
    await page.waitForSelector("input#email", { timeout: 10000 });
  } catch {
    log(persona, "⚠ No email input found on /login");
    return false;
  }

  await page.locator("input#email").fill(creds.email);
  await page.locator("input#password").fill(creds.password);
  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
  } catch { /* may stay on login if creds fail */ }

  const url = page.url();
  const success = !url.includes("/login");
  log(persona, success ? "✓ Logged in (UI)" : "✗ Login failed");
  return success;
}

async function logout(page, persona) {
  log(persona, "Logging out...");
  try {
    await page.request.post(`${API_URL}/v1/auth/logout`);
  } catch { /* ignore */ }
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: PAGE_TIMEOUT });
  } catch { /* server may be briefly unavailable */ }
}

async function collectPageData(page, persona, url, screenshotDir) {
  const issues = {
    url,
    consoleErrors: [],
    networkErrors: [],
    brokenImages: [],
    a11yViolations: [],
    loadTimeMs: 0,
    deadLinks: [],
    tabFocusIssues: [],
  };

  // Listeners
  const consoleErrors = [];
  const networkErrors = [];

  const onConsole = (msg) => {
    if (msg.type() === "error" && !shouldIgnoreConsole(msg.text())) {
      consoleErrors.push(msg.text().slice(0, 300));
    }
  };
  const onPageError = (err) => {
    consoleErrors.push(`PAGE_ERROR: ${err.message.slice(0, 300)}`);
  };
  const onResponse = (res) => {
    const status = res.status();
    const resUrl = res.url();
    if ((status >= 400) && !shouldIgnoreNetworkPath(resUrl)) {
      networkErrors.push({ status, url: resUrl.slice(0, 200) });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  // Navigate
  const start = Date.now();
  try {
    await page.goto(`${BASE_URL}${url}`, { waitUntil: "load", timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(1500); // React hydration
  } catch (err) {
    issues.consoleErrors.push(`NAVIGATION_ERROR: ${err.message.slice(0, 200)}`);
  }
  issues.loadTimeMs = Date.now() - start;

  // Performance API
  try {
    const perfTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0;
    });
    if (perfTiming > 0) issues.loadTimeMs = perfTiming;
  } catch { /* ignore */ }

  // Console + Network
  issues.consoleErrors = [...consoleErrors];
  issues.networkErrors = [...networkErrors];

  // Broken images
  try {
    issues.brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img"))
        .filter((img) => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith("data:"))
        .map((img) => img.src.slice(0, 200));
    });
  } catch { /* ignore */ }

  // Accessibility (axe-core)
  try {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    issues.a11yViolations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    }));
  } catch { /* axe may fail on non-HTML pages */ }

  // Screenshot
  try {
    const safeName = url.replace(/\//g, "_") || "_root";
    const fileName = `${persona.id}${safeName}.png`;
    await page.screenshot({ path: join(screenshotDir, fileName), fullPage: true });
  } catch { /* ignore */ }

  // Tab focus visibility check
  if (persona.a11yFocus) {
    try {
      const focusIssues = await page.evaluate(() => {
        const problems = [];
        const interactives = document.querySelectorAll("a, button, input, textarea, select, [tabindex]");
        for (const el of Array.from(interactives).slice(0, 30)) {
          el.focus();
          const styles = window.getComputedStyle(el);
          const hasOutline = styles.outlineStyle !== "none" && styles.outlineWidth !== "0px";
          const hasBoxShadow = styles.boxShadow !== "none";
          if (!hasOutline && !hasBoxShadow) {
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || "").trim().slice(0, 40);
            problems.push(`${tag}: "${text}" — no visible focus indicator`);
          }
        }
        return problems;
      });
      issues.tabFocusIssues = focusIssues;
    } catch { /* ignore */ }
  }

  // Cleanup listeners
  page.removeListener("console", onConsole);
  page.removeListener("pageerror", onPageError);
  page.removeListener("response", onResponse);

  return issues;
}

async function sampleLinks(page, persona) {
  const deadLinks = [];
  try {
    const links = await page.evaluate((base) => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.href)
        .filter((h) => h.startsWith(base) || h.startsWith("/"))
        .filter((h) => !h.includes("#") && !h.includes("mailto:") && !h.includes("tel:"))
        .slice(0, 10);
    }, BASE_URL);

    for (const link of links) {
      try {
        const fullUrl = link.startsWith("/") ? `${BASE_URL}${link}` : link;
        const res = await page.request.get(fullUrl, { timeout: 8000 });
        if (res.status() >= 400) {
          deadLinks.push({ url: fullUrl.slice(0, 200), status: res.status() });
        }
      } catch { /* timeout — skip */ }
    }
  } catch { /* ignore */ }
  return deadLinks;
}

async function testForms(page, persona, url) {
  const results = [];
  log(persona, `Testing forms on ${url}...`);

  await page.goto(`${BASE_URL}${url}`, { waitUntil: NAV_WAIT, timeout: PAGE_TIMEOUT });
  await page.waitForTimeout(800);

  if (url === "/kontakt") {
    try {
      const submitBtn = page.locator('button[type="submit"], form button').first();
      if ((await submitBtn.count()) > 0) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        const errorVisible = await page.locator('[class*="destructive"], [class*="error"], [role="alert"]').count();
        results.push({
          form: "contact",
          test: "empty submit",
          result: errorVisible > 0 ? "PASS — validation shown" : "WARN — no visible validation on empty submit",
        });
      }
    } catch { /* ignore */ }
  }

  if (url === "/login") {
    try {
      const emailInput = page.locator('input[type="email"]').first();
      const pwInput = page.locator('input[type="password"]').first();
      if ((await emailInput.count()) > 0) {
        await emailInput.fill("not-an-email");
        await pwInput.fill("x");
        const submitBtn = page.locator('button[type="submit"], form button:has-text("Logga in")').first();
        await submitBtn.click();
        await page.waitForTimeout(1500);
        const errorVisible = await page.locator('[class*="destructive"], [class*="error"], [role="alert"], p:has-text("Fel")').count();
        results.push({
          form: "login",
          test: "invalid credentials",
          result: errorVisible > 0 ? "PASS — error shown" : "WARN — no visible error message",
        });
      }
    } catch { /* ignore */ }
  }

  if (url === "/registrera") {
    try {
      const anyBtn = page.locator("button").first();
      if ((await anyBtn.count()) > 0) {
        results.push({
          form: "register",
          test: "page loads",
          result: "PASS — registration page accessible",
        });
      }
    } catch { /* ignore */ }
  }

  return results;
}

// ─── Run single persona ──────────────────────────────────────────────────────

async function runPersona(browser, persona, viewportName, viewport, screenshotDir) {
  const ctx = await browser.newContext({
    viewport,
    userAgent: viewportName === "mobile"
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Roots-QA-Bot"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Roots-QA-Bot",
    locale: "sv-SE",
  });

  const page = await ctx.newPage();
  const allIssues = [];
  const formResults = [];
  let loggedIn = false;

  for (const step of persona.journeys) {
    if (step === "LOGIN") {
      if (persona.login) {
        loggedIn = await login(page, persona.login, persona);
      }
      continue;
    }
    if (step === "LOGOUT") {
      await logout(page, persona);
      loggedIn = false;
      continue;
    }

    log(persona, `${viewportName} → ${step}`);

    const issues = await collectPageData(page, persona, step, screenshotDir);

    // Link sampling for oscar-random
    if (persona.linkSampler) {
      const dead = await sampleLinks(page, persona);
      issues.deadLinks = dead;
    }

    allIssues.push(issues);
  }

  // Form testing for niklas-formtest
  if (persona.formTester) {
    for (const url of persona.journeys) {
      if (url === "LOGIN" || url === "LOGOUT") continue;
      const fResults = await testForms(page, persona, url);
      formResults.push(...fResults);
    }
  }

  await ctx.close();
  return { persona, viewportName, issues: allIssues, formResults };
}

// ─── Report generation ───────────────────────────────────────────────────────

function generateReport(roundNum, allResults, elapsed) {
  const lines = [];
  const timestamp = ts();

  let totalPages = 0;
  let totalConsoleErrors = 0;
  let totalNetworkErrors = 0;
  let totalBrokenImages = 0;
  let totalA11y = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let totalDeadLinks = 0;
  let slowPages = [];
  let allFormResults = [];

  lines.push(`# Roots QA Report — Round ${roundNum}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Duration:** ${(elapsed / 1000).toFixed(1)}s`);
  lines.push(`**Base URL:** ${BASE_URL}`);
  lines.push("");

  for (const result of allResults) {
    const { persona, viewportName, issues, formResults } = result;
    allFormResults.push(...formResults);

    lines.push(`---`);
    lines.push(`## ${persona.name} (${viewportName})`);
    lines.push(`> ${persona.description}`);
    lines.push("");

    for (const issue of issues) {
      totalPages++;
      totalConsoleErrors += issue.consoleErrors.length;
      totalNetworkErrors += issue.networkErrors.length;
      totalBrokenImages += issue.brokenImages.length;
      totalDeadLinks += issue.deadLinks.length;

      for (const v of issue.a11yViolations) {
        totalA11y[v.impact] = (totalA11y[v.impact] || 0) + v.nodes;
      }

      if (issue.loadTimeMs > 2000) {
        slowPages.push({ url: issue.url, time: issue.loadTimeMs, persona: persona.id, viewport: viewportName });
      }

      const hasIssues =
        issue.consoleErrors.length > 0 ||
        issue.networkErrors.length > 0 ||
        issue.brokenImages.length > 0 ||
        issue.a11yViolations.length > 0 ||
        issue.deadLinks.length > 0 ||
        issue.tabFocusIssues.length > 0;

      if (hasIssues || issue.loadTimeMs > 2000) {
        lines.push(`### ${issue.url} (${issue.loadTimeMs}ms)`);

        if (issue.consoleErrors.length > 0) {
          lines.push("**Console Errors:**");
          for (const e of issue.consoleErrors) lines.push(`- \`${e}\``);
        }
        if (issue.networkErrors.length > 0) {
          lines.push("**Network Errors:**");
          for (const e of issue.networkErrors) lines.push(`- ${e.status}: \`${e.url}\``);
        }
        if (issue.brokenImages.length > 0) {
          lines.push("**Broken Images:**");
          for (const e of issue.brokenImages) lines.push(`- \`${e}\``);
        }
        if (issue.a11yViolations.length > 0) {
          lines.push("**Accessibility:**");
          for (const v of issue.a11yViolations) {
            lines.push(`- [${v.impact}] ${v.id}: ${v.description} (${v.nodes} nodes)`);
          }
        }
        if (issue.deadLinks.length > 0) {
          lines.push("**Dead Links:**");
          for (const d of issue.deadLinks) lines.push(`- ${d.status}: \`${d.url}\``);
        }
        if (issue.tabFocusIssues.length > 0) {
          lines.push("**Tab Focus Issues:**");
          for (const t of issue.tabFocusIssues) lines.push(`- ${t}`);
        }
        lines.push("");
      }
    }
  }

  // Summary at the top (insert after header)
  const summary = [
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Personas run | ${allResults.length} |`,
    `| Pages tested | ${totalPages} |`,
    `| Console errors | ${totalConsoleErrors} |`,
    `| Network errors | ${totalNetworkErrors} |`,
    `| Broken images | ${totalBrokenImages} |`,
    `| Dead links | ${totalDeadLinks} |`,
    `| A11y critical | ${totalA11y.critical} |`,
    `| A11y serious | ${totalA11y.serious} |`,
    `| A11y moderate | ${totalA11y.moderate} |`,
    `| A11y minor | ${totalA11y.minor} |`,
    `| Slow pages (>2s) | ${slowPages.length} |`,
    "",
  ];

  if (slowPages.length > 0) {
    summary.push("### Slow Pages (>2s)");
    summary.push("");
    summary.push("| URL | Time | Persona | Viewport |");
    summary.push("|-----|------|---------|----------|");
    for (const sp of slowPages) {
      summary.push(`| ${sp.url} | ${sp.time}ms | ${sp.persona} | ${sp.viewport} |`);
    }
    summary.push("");
  }

  if (allFormResults.length > 0) {
    summary.push("### Form Test Results");
    summary.push("");
    summary.push("| Form | Test | Result |");
    summary.push("|------|------|--------|");
    for (const fr of allFormResults) {
      summary.push(`| ${fr.form} | ${fr.test} | ${fr.result} |`);
    }
    summary.push("");
  }

  // Insert summary after the header
  lines.splice(5, 0, ...summary);

  return lines.join("\n");
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Roots — Persona-based QA Test Suite            ║");
  console.log("║   Press Ctrl+C to stop                           ║");
  console.log(`║   Target: ${BASE_URL.padEnd(38)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  const browser = await chromium.launch({ headless: true });

  // Warm up the Next.js dev server by visiting key routes
  console.log("  Warming up dev server...");
  const warmupCtx = await browser.newContext();
  const warmupPage = await warmupCtx.newPage();
  for (const path of ["/", "/login", "/portal", "/produkter"]) {
    try {
      await warmupPage.goto(`${BASE_URL}${path}`, { waitUntil: "load", timeout: 30000 });
      await warmupPage.waitForTimeout(1000);
    } catch { /* ignore compile-time slowness */ }
  }
  await warmupCtx.close();
  console.log("  Warmup complete.\n");

  let roundNum = 0;

  const shutdown = async () => {
    console.log("\n\nShutting down...");
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (true) {
    roundNum++;
    const roundTs = ts();
    const screenshotDir = join(__dirname, "screenshots", `round-${roundNum}-${roundTs}`);
    const reportDir = join(__dirname, "reports");
    await mkdir(screenshotDir, { recursive: true });
    await mkdir(reportDir, { recursive: true });

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ROUND ${roundNum} — ${new Date().toLocaleString("sv-SE")}`);
    console.log(`${"═".repeat(60)}\n`);

    const roundStart = Date.now();
    const allResults = [];

    for (const persona of PERSONAS) {
      const viewportsToTest = persona.mobileOnly
        ? [["mobile", VIEWPORTS.mobile]]
        : [["desktop", VIEWPORTS.desktop], ["mobile", VIEWPORTS.mobile]];

      for (const [vpName, vp] of viewportsToTest) {
        console.log(`\n  ── ${persona.name} (${vpName}) ──`);
        try {
          const result = await runPersona(browser, persona, vpName, vp, screenshotDir);
          allResults.push(result);
        } catch (err) {
          console.error(`  ✗ Error running ${persona.id} (${vpName}): ${err.message}`);
        }
      }
    }

    const elapsed = Date.now() - roundStart;
    const report = generateReport(roundNum, allResults, elapsed);
    const reportPath = join(reportDir, `round-${roundNum}-${roundTs}.md`);
    await writeFile(reportPath, report, "utf-8");

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Round ${roundNum} complete in ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`  Report: ${reportPath}`);
    console.log(`  Screenshots: ${screenshotDir}/`);
    console.log(`  Waiting ${ROUND_DELAY_MS / 1000}s before next round...`);
    console.log(`${"─".repeat(60)}\n`);

    await new Promise((r) => setTimeout(r, ROUND_DELAY_MS));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
