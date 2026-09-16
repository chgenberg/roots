import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import {
  BASE_URL,
  CHAPTERS,
  VIEWPORT,
  chapterDir,
  sessionPath,
} from "./config.js";
import { makeHelpers } from "./helpers.js";
import { CHAPTER_FNS } from "./chapters.js";
import { loadState } from "./state.js";

const arg = (process.argv[2] || "1").replace(/^0/, "") || "1";
const locale = process.argv[3] || "sv";
const chapter = CHAPTERS.find(
  (c) => c.id === arg.padStart(2, "0") || c.id === arg || c.key === arg
);

if (!chapter) {
  console.error(
    `Okänt kapitel "${process.argv[2]}". Välj 1–6 eller: ${CHAPTERS.map((c) => c.key).join(", ")}`
  );
  process.exit(1);
}

const OUT = chapterDir(chapter.id, locale);
fs.mkdirSync(OUT, { recursive: true });

const INIT = `
(() => {
  try { localStorage.setItem("roots_cookie_consent", "all"); } catch (e) {}
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Sora:wght@500;600&display=swap";
  document.documentElement.appendChild(font);
  const style = document.createElement("style");
  style.textContent = \`
    *::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    button.fixed.bottom-6.right-6 { display: none !important; }
  \`;
  document.documentElement.appendChild(style);
})();
`;

function loadRailwaySecrets() {
  if (process.env.SITE_PREVIEW_PASSWORD?.trim()) return;
  for (const service of ["web", "roots"]) {
    try {
      const raw = execFileSync(
        "railway",
        ["variables", "-s", service, "--json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      const parsed = JSON.parse(raw);
      const vars = parsed?.data || parsed?.variables || parsed;
      const pw =
        vars?.SITE_PREVIEW_PASSWORD ||
        vars?.find?.((v) => v.name === "SITE_PREVIEW_PASSWORD")?.value;
      if (pw) {
        process.env.SITE_PREVIEW_PASSWORD = pw;
        return;
      }
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  loadRailwaySecrets();
  if (!process.env.SITE_PREVIEW_PASSWORD?.trim()) {
    throw new Error("SITE_PREVIEW_PASSWORD måste vara satt.");
  }

  console.log(`\nSpelar in kapitel ${chapter.id} — ${chapter.title}`);
  console.log(`  ${BASE_URL}  ${VIEWPORT.w}×${VIEWPORT.h}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });

  const warm = await browser.newContext({
    viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
    deviceScaleFactor: 1,
    locale,
  });
  await warm.addInitScript(INIT);
  const warmPage = await warm.newPage();
  warmPage.setDefaultTimeout(16000);
  const warmHelp = makeHelpers(warmPage, () => {});
  await warmHelp.unlockPreview();
  const roleFile = chapter.session ? sessionPath(chapter.session, locale) : null;
  if (chapter.session) {
    const id = loadState(locale);
    const landing = {
      assoc: "/forening",
      leader: "/lag",
      seller: "/min-shop",
    }[chapter.session];
    const email = {
      assoc: id?.assocEmail,
      leader: id?.leaderEmail,
      seller: id?.sellerEmail,
    }[chapter.session];
    const password = process.env.FILM_PASSWORD?.trim();
    if (!email || !password) {
      throw new Error(
        `Saknar ${chapter.session}-konto i state.json eller FILM_PASSWORD.`
      );
    }
    await warmHelp.loginQuiet(email, password, landing);
    fs.writeFileSync(
      roleFile,
      JSON.stringify(await warm.storageState(), null, 2)
    );
  }
  const storageState =
    roleFile && fs.existsSync(roleFile)
      ? roleFile
      : await warm.storageState();
  await warm.close();

  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
    deviceScaleFactor: 1,
    locale,
    storageState,
    recordVideo: {
      dir: OUT,
      size: { width: VIEWPORT.w, height: VIEWPORT.h },
    },
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);

  const marks = [];
  const t0 = Date.now();
  const mark = (name) => {
    const at = (Date.now() - t0) / 1000;
    marks.push({ name, t: at });
    console.log(`  • ${name} @ ${at.toFixed(1)}s`);
  };

  const helpers = makeHelpers(page, mark);
  await page.waitForTimeout(400);
  await CHAPTER_FNS[chapter.key](helpers);
  await page.waitForTimeout(900);
  if (chapter.session) {
    fs.writeFileSync(
      sessionPath(chapter.session, locale),
      JSON.stringify(await ctx.storageState(), null, 2)
    );
  }

  const video = page.video();
  await ctx.close();
  await browser.close();

  if (video) {
    const tmp = await video.path();
    const dst = path.join(OUT, "raw.webm");
    fs.copyFileSync(tmp, dst);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    console.log(`  raw.webm → ${dst}`);
  }

  fs.writeFileSync(
    path.join(OUT, "marks.json"),
    JSON.stringify({ chapter: chapter.id, locale, marks }, null, 2)
  );
  console.log(`  marks.json (${marks.length} markörer)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
