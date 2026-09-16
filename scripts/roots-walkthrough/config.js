import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

export const BASE_URL = (
  process.env.BASE_URL || "https://roots.nu"
).replace(/\/$/, "");

export const VIEWPORT = { w: 1920, h: 1080 };

export const BRAND = {
  forest: "#6B794F",
  ink: "#1D1D1B",
  sand: "#F1EBE2",
  sandLight: "#F7F4EE",
};

export const FONT_HEAD = "Sora";

export const CHAPTERS = [
  {
    id: "01",
    key: "overview",
    title: "Föreningens hem",
    file: "kapitel-01",
    session: "assoc",
  },
  {
    id: "02",
    key: "goals",
    title: "Sätt målet",
    file: "kapitel-02",
    session: "assoc",
  },
  {
    id: "03",
    key: "association",
    title: "Statistik och avräkning",
    file: "kapitel-03",
    session: "assoc",
  },
  {
    id: "04",
    key: "leader",
    title: "Lagkaptenens vy",
    file: "kapitel-04",
    session: "leader",
  },
  {
    id: "05",
    key: "seller",
    title: "Säljarens shop",
    file: "kapitel-05",
    session: "seller",
  },
  {
    id: "06",
    key: "shop",
    title: "Kunden handlar",
    file: "kapitel-06",
    session: null,
  },
];

export function outDir(locale = "sv") {
  return path.join(ROOT, "out", locale);
}

export function chapterDir(id, locale = "sv") {
  return path.join(outDir(locale), `kapitel-${id}`);
}

export function statePath(locale = "sv") {
  return path.join(outDir(locale), "state.json");
}

export function sessionPath(role, locale = "sv") {
  return path.join(outDir(locale), `session-${role}.json`);
}

export function requiredEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `Saknar ${name}. Sätt den i miljön (1Password / Railway) — klistra inte in den i chatten.`
    );
  }
  return v;
}
