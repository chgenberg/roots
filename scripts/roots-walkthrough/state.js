import fs from "node:fs";
import path from "node:path";
import { outDir, statePath } from "./config.js";

export function loadState(locale = "sv") {
  const p = statePath(locale);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveState(partial, locale = "sv") {
  const dir = outDir(locale);
  fs.mkdirSync(dir, { recursive: true });
  const prev = loadState(locale) || {};
  const next = { ...prev, ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(statePath(locale), JSON.stringify(next, null, 2));
  return next;
}

export function ensureFilmIdentity(locale = "sv") {
  const existing = loadState(locale);
  if (existing?.stamp) return existing;
  const stamp = Date.now().toString(36);
  const assocEmail =
    process.env.FILM_ASSOC_EMAIL?.trim() ||
    `walk.forening.${stamp}@roots.nu`;
  return saveState(
    {
      stamp,
      orgName: "Roots FBK",
      orgNumber: `8024${stamp.slice(-2).replace(/\D/g, "0").padStart(2, "0")}-${String(Date.now()).slice(-4)}`,
      assocEmail,
      assocName: "Anna Andersson",
      leaderEmail: `walk.lag.${stamp}@roots.nu`,
      leaderName: "Erik Lindgren",
      sellerEmail: `walk.salj.${stamp}@roots.nu`,
      sellerName: "Maja Svensson",
      teamName: "P14 Blå",
      campaignName: "Vårkampanj 2026",
      leaderInviteUrl: null,
      sellerInviteUrl: null,
      shopSlug: null,
    },
    locale
  );
}
