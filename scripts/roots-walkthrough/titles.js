import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { CHAPTERS, VIEWPORT, BRAND, FONT_HEAD, chapterDir } from "./config.js";

const locale = process.argv[2] || "sv";

const html = (title, kicker) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600&display=swap" />
  <style>
    html, body { margin: 0; width: ${VIEWPORT.w}px; height: ${VIEWPORT.h}px; background: ${BRAND.sandLight}; }
    .wrap {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 18px;
    }
    .rule { width: 48px; height: 2px; background: ${BRAND.forest}; }
    .kicker {
      font-family: ${FONT_HEAD}, sans-serif;
      font-size: 13px; letter-spacing: 0.18em;
      text-transform: uppercase; color: ${BRAND.forest};
    }
    h1 {
      font-family: ${FONT_HEAD}, sans-serif;
      font-weight: 500; font-size: 56px; line-height: 1.12;
      letter-spacing: -0.03em; color: ${BRAND.ink};
      text-align: center; max-width: 14ch; margin: 0;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="kicker">${kicker}</div>
    <div class="rule"></div>
    <h1>${title}</h1>
  </div>
</body>
</html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
    deviceScaleFactor: 1,
  });

  for (const chapter of CHAPTERS) {
    const dir = chapterDir(chapter.id, locale);
    fs.mkdirSync(dir, { recursive: true });
    await page.setContent(html(chapter.title, "Roots FBK"), {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const dest = path.join(dir, "title.png");
    await page.screenshot({ path: dest, type: "png" });
    console.log(`  title.png → ${dest}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
