// Delad konfiguration för Roots demofilmer.
// All geometri MÅSTE vara identisk mellan frames.js och compose.js,
// annars hamnar videon snett under telefonramen.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ── Miljö ────────────────────────────────────────────────────────────
export const BASE_URL = (process.env.BASE_URL || "http://localhost:3004").replace(/\/$/, "");
export const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
export const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/roots";

// ── Telefon-geometri (CSS-pixlar) ────────────────────────────────────
// x,y = telefonens position på 1920x1080-canvasen (desktop-variant).
export const SCREEN = { w: 415, h: 900, x: 752, y: 90 };
export const STATUS = 56; // höjd på fejkad iOS-statusbar
export const PAGE_H = SCREEN.h - STATUS; // 844 — sidan spelas in i denna höjd
export const BEZEL = 16; // svart ram-bredd
export const RADIUS = 64; // hörnradie på telefonen

export const CANVAS = { w: 1920, h: 1080 };
export const MOBILE_CANVAS = { w: 1080, h: 1920 };
export const MOBILE_SCALE = 1.9; // telefonen skalas upp i mobil-variant

// ── Brand (brandbok E13) ─────────────────────────────────────────────
export const BRAND = {
  forest: "#6B794F",
  forestSoft: "#EDF1E9",
  ink: "#1D1D1B",
  offwhite: "#FAF6EF",
  sand: "#7F715B",
  sandLight: "#D5CABF",
  sun: "#ECD488",
  white: "#FFFFFF",
};

export const FONT_HEAD = "Sora"; // nära Alan Sans, finns på Google Fonts
export const FONT_BODY = "Inter";

// ── Demokonton (lösenord delas) ──────────────────────────────────────
export const PASSWORD = "Demo1234!";

/** En film per roll. */
export const ROLES = {
  seller: {
    email: "felicia.assoc@demo-if.se",
    landing: "/min-shop",
    label: "Säljare",
  },
  forening: {
    email: "forening@demo-if.se",
    landing: "/forening",
    label: "Förening",
  },
  lag: {
    email: "lag@demo-if.se",
    landing: "/lag",
    label: "Lagledare",
  },
  // Publik räknesnurra — ingen inloggning. Spelas in på den FRISTÅENDE
  // delbara länksidan (/kalkylator/<token>) som bara innehåller kalkylatorn.
  // OBS: spela ALDRIG in på /sa-fungerar-det — den sidan bäddar in själva
  // kalkylatorfilmen, vilket ger en "telefon-i-telefon"-rekursion i tagningen.
  calculator: {
    email: "",
    landing: "/kalkylator/demo-kalkyl", // måste matcha REC_CALC_TOKEN nedan
    label: "Räknesnurra",
    public: true,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);
export const LOCALES = ["sv"];
export const DEFAULT_LOCALE = "sv";

// Markörer (för städning) på data som flödena skapar.
// Realistiska namn (syns i filmen). Städas bort av cleanup.js via
// is_manual-flaggan + exakt match, så de aldrig krockar med seedad data.
export const REC_CAMPAIGN_NAME = "Vårcup 2026 – Cupresa Malmö";
export const REC_CHAT_BODY = "Heja laget! Sista veckan kvar – nu kör vi!";
export const REC_ORDER_CUSTOMER = "Granne Karin";

// Fristående kalkylator-länk som räknesnurrefilmen spelas in mot.
// cleanup.js säkerställer att raden finns (idempotent) före tagning.
export const REC_CALC_TOKEN = "demo-kalkyl"; // ≥8 tecken (API kräver det)
export const REC_CALC_ASSOCIATION = "Demo IF Sundsvall";

// ── Geometri per variant (delas av frames.js OCH compose.js) ─────────
// All geometri på ETT ställe så videon aldrig hamnar snett under ramen.
//
// NYCKELIDÉ: telefonramens HÖJD HÄRLEDS ur den inspelade sidans
// bildförhållande. Då sluter ramen tätt runt videon — ingen vit "haka"
// nedtill, ingen sträckning, inga fyrkantiga hörn som sticker ut.
//
// Skärm-rektangeln (där den inspelade sidan läggs in):
//   • bredd  = w − 2·bezel  (videon möter ramens innerkant i sidled)
//   • höjd   = bredd · REC_RATIO  (exakt inspelningens kvot → ingen sträck)
//   • topp   = y + status   (statusbaren ligger på den vita plattan ovanför)
//   • ramens höjd h = status + skärmhöjd + bezel  → botten möter innerkanten
const REC_RATIO = PAGE_H / SCREEN.w; // inspelad sida: höjd/bredd (≈2.034)

export function geom(variant = "desktop") {
  if (variant === "mobile") {
    const s = MOBILE_SCALE;
    const bezel = Math.round(BEZEL * s);
    const status = Math.round(STATUS * s);
    const radius = Math.round(RADIUS * s);
    const w = Math.round(SCREEN.w * s);
    const screenW = w - 2 * bezel;
    const screenH = Math.round(screenW * REC_RATIO);
    const h = status + screenH + bezel; // ramen sluter tätt runt videon
    const x = Math.round((MOBILE_CANVAS.w - w) / 2);
    const y = Math.round((MOBILE_CANVAS.h - h) / 2);
    return {
      canvas: MOBILE_CANVAS,
      x, y, w, h, status, bezel, radius,
      screenX: x + bezel,
      screenY: y + status,
      screenW,
      screenH,
      side: false,
    };
  }
  const bezel = BEZEL;
  const status = STATUS;
  const w = SCREEN.w;
  const screenW = w - 2 * bezel;
  const screenH = Math.round(screenW * REC_RATIO);
  const h = status + screenH + bezel;
  const x = SCREEN.x;
  const y = Math.round((CANVAS.h - h) / 2);
  return {
    canvas: CANVAS,
    x, y, w, h, status, bezel,
    radius: RADIUS,
    screenX: x + bezel,
    screenY: y + status,
    screenW,
    screenH,
    side: true,
  };
}

// ── Utdata-sökvägar ──────────────────────────────────────────────────
export function recordDir(role, locale) {
  return path.join(ROOT, "out", role, locale);
}
export function variantDir(role, locale, variant = "desktop") {
  return path.join(recordDir(role, locale), variant);
}
