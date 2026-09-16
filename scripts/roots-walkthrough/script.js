/**
 * Tutorial-skript för föreningsfilmen.
 *
 * Upplägg (Tell → Show → Linger):
 *  1. Titelkort säger vad tittaren ska lära sig (max 5–7 ord).
 *  2. Produkten visas — klick, siffror, grafer.
 *  3. Kameran vilar 1–2 s efter varje handling.
 *
 * Inloggning och preview-grind sker utanför kameran.
 * Roots FBK, Anna / Erik / Maja — samma konton som i state.json.
 */
export const SCRIPT = {
  overview: {
    session: "assoc",
    start: "/forening",
    chapterTitle: "Föreningens hem",
    beats: [{ title: "Föreningens hem" }],
  },
  goals: {
    session: "assoc",
    start: "/forening/mal",
    chapterTitle: "Sätt målet",
    beats: [{ title: "Sätt lagets mål" }],
  },
  association: {
    session: "assoc",
    start: "/forening/statistik",
    chapterTitle: "Statistik och avräkning",
    beats: [{ title: "Så följer ni statistiken" }],
  },
  leader: {
    session: "leader",
    start: "/lag",
    chapterTitle: "Lagkaptenens vy",
    beats: [{ title: "Lagkaptenens översikt" }],
  },
  seller: {
    session: "seller",
    start: "/min-shop",
    chapterTitle: "Säljarens shop",
    beats: [{ title: "Säljarens dashboard" }],
  },
  shop: {
    session: null,
    start: null,
    chapterTitle: "Kunden handlar",
    beats: [{ title: "Kunden handlar" }],
  },
};
