import { createHash } from "node:crypto";
import { BASE_URL } from "./config.js";

export async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ⚠ beat "${label}" hoppades över: ${err.message}`);
  }
}

export function makeHelpers(page, mark) {
  const pause = (ms) => page.waitForTimeout(ms);

  const hideChrome = async () => {
    await page
      .addStyleTag({
        content:
          "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],[data-next-badge],[data-nextjs-dev-tools-button],#__next-dev-tools-indicator{display:none!important}" +
          "button.fixed.bottom-6.right-6{display:none!important}" +
          "*::-webkit-scrollbar{width:0!important;height:0!important}",
      })
      .catch(() => {});
  };

  const dismissModals = async () => {
    for (let i = 0; i < 3; i++) {
      const overlay = page.locator(
        '[data-state="open"].fixed.inset-0, [role="dialog"][data-state="open"]'
      );
      if ((await overlay.count()) === 0) break;
      await page.keyboard.press("Escape").catch(() => {});
      await pause(350);
    }
  };

  const click = async (locator) => {
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await pause(200);
    await el.click({ timeout: 8000 });
    await pause(180);
  };

  const typeSlow = async (locator, text) => {
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.click({ timeout: 5000 }).catch(() => {});
    await el.fill("");
    await el.pressSequentially(text, { delay: 36 });
  };

  const fillQuiet = async (locator, text) => {
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.fill(text);
  };

  const softScrollTo = async (locator) => {
    const el = locator.first();
    try {
      await el.waitFor({ state: "visible", timeout: 4000 });
    } catch {
      return;
    }
    const box = await el.boundingBox().catch(() => null);
    if (!box) return;
    const target = await page.evaluate(
      ([y, h]) => Math.max(0, window.scrollY + y - (window.innerHeight - h) / 2),
      [box.y, box.height]
    );
    const from = await page.evaluate(() => window.scrollY);
    const steps = 60;
    for (let i = 1; i <= steps; i++) {
      const y = from + ((target - from) * i) / steps;
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(22);
    }
  };

  const softScrollTop = async () => {
    const from = await page.evaluate(() => window.scrollY);
    if (from < 20) return;
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((v) => window.scrollTo(0, v), from * (1 - i / steps));
      await page.waitForTimeout(18);
    }
  };

  const showTitle = async (text) => {
    mark(`title:${text}`);
    await page.evaluate((label) => {
      document.getElementById("__wt_title")?.remove();
      const el = document.createElement("div");
      el.id = "__wt_title";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483646",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:#F7F4EE",
        "opacity:0",
        "transition:opacity .55s ease",
      ].join(";");
      const p = document.createElement("p");
      p.textContent = label;
      p.style.cssText = [
        "font-family:Sora,Inter,system-ui,sans-serif",
        "font-size:42px",
        "font-weight:500",
        "letter-spacing:-0.03em",
        "color:#1D1D1B",
        "text-align:center",
        "max-width:16ch",
        "line-height:1.15",
        "margin:0",
        "padding:0 48px",
      ].join(";");
      el.appendChild(p);
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
    }, text);
    await pause(1300);
    await page.evaluate(() => {
      const el = document.getElementById("__wt_title");
      if (el) el.style.opacity = "0";
    });
    await pause(320);
    await page.evaluate(() => document.getElementById("__wt_title")?.remove());
  };

  const injectPreviewCookie = async () => {
    const password = process.env.SITE_PREVIEW_PASSWORD?.trim();
    if (!password) {
      throw new Error("SITE_PREVIEW_PASSWORD saknas");
    }
    const value = createHash("sha256")
      .update(`roots-preview-v1:${password}`)
      .digest("hex")
      .slice(0, 40);
    await page.context().addCookies([
      {
        name: "roots_preview",
        value,
        domain: new URL(BASE_URL).hostname,
        path: "/",
        httpOnly: true,
        secure: BASE_URL.startsWith("https"),
        sameSite: "Lax",
      },
    ]);
  };

  const unlockPreview = async ({ film = false } = {}) => {
    await injectPreviewCookie();
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await pause(600);
    const havePw = page.getByRole("button", { name: "Jag har ett lösenord" });
    if ((await havePw.count()) > 0) {
      if (film) {
        throw new Error(
          "Preview-grinden syns fortfarande — lås upp utanför kameran först."
        );
      }
      throw new Error("Preview-cookie avvisades — kontrollera lösenordet.");
    }
    await hideChrome();
  };

  const loginQuiet = async (email, password, landing) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await injectPreviewCookie();
      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
      await hideChrome();
      const field = page.locator("#email");
      try {
        await field.waitFor({ state: "visible", timeout: 16000 });
      } catch (err) {
        if (attempt === 0) {
          await pause(1500);
          continue;
        }
        throw err;
      }
      await field.click();
      await field.fill("");
      await field.pressSequentially(email, { delay: 8 });
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Logga in" }).first().click();
      await page
        .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 })
        .catch(() => {});
      if (landing) {
        await page.waitForURL(`**${landing}`, { timeout: 15000 }).catch(() => {});
      }
      if (page.url().includes("/login")) {
        throw new Error("Inloggning misslyckades — sessionen sparades inte.");
      }
      await hideChrome();
      return;
    }
  };

  const login = loginQuiet;

  const navTo = async (label, hrefHint) => {
    await dismissModals();
    const link = hrefHint
      ? page.locator(`a[href="${hrefHint}"], a[href^="${hrefHint}?"]`).first()
      : page.getByRole("link", { name: label }).first();
    try {
      if ((await link.count()) === 0) {
        await click(page.getByRole("link", { name: label }));
      } else {
        await click(link);
      }
    } catch (err) {
      if (hrefHint) {
        await page.goto(`${BASE_URL}${hrefHint}`, {
          waitUntil: "domcontentloaded",
        });
      } else {
        throw err;
      }
    }
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await hideChrome();
    await pause(900);
  };

  const gotoPath = async (pathname) => {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: "domcontentloaded" });
    await hideChrome();
    await pause(700);
  };

  const waitReady = async () => {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await hideChrome();
    await page
      .locator("main .animate-spin")
      .first()
      .waitFor({ state: "hidden", timeout: 12000 })
      .catch(() => {});
    await pause(350);
  };

  return {
    page,
    mark,
    pause,
    click,
    typeSlow,
    fillQuiet,
    softScrollTo,
    softScrollTop,
    showTitle,
    unlockPreview,
    login,
    loginQuiet,
    navTo,
    gotoPath,
    waitReady,
    hideChrome,
    dismissModals,
  };
}
