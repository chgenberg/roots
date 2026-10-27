/**
 * Gör om loggan från föreningens webbplats till en ren PNG och läser ut dess
 * färger. Körs i webbläsaren: bilden ritas om på en canvas, så det som sparas
 * är alltid en PNG — aldrig en SVG eller ett okänt format från en annan sajt.
 */

type Rgb = [number, number, number];

export type LogoColour = { hex: string; share: number };

export type PreparedLogo = {
  /** PNG som data-URL, beskuren och med genomskinlig bakgrund. */
  png: string;
  colours: LogoColour[];
  /** Kanten är mest vit — loggan syns bara på mörk botten. */
  onDark: boolean;
};

const MAX_SIDE = 512;
const MAX_DATA_URL = 380_000;

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const rgbOf = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const lum = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]: Rgb) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d", { willReadFrequently: true });
  return ctx ? { el, ctx } : null;
}

/** Enfärgad bakgrund (vit ruta runt märket) blir genomskinlig. Foton lämnas orörda. */
function clearFlatBackground(data: Uint8ClampedArray, w: number, h: number): void {
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 250) opaque++;
  if (opaque / (w * h) <= 0.97) return;
  const px = (x: number, y: number): Rgb => [0, 1, 2].map((c) => data[(y * w + x) * 4 + c]) as Rgb;
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4) as Rgb;
  if (corners.some((p) => dist(p, bg) > 40)) return;
  const near = (k: number) => dist([data[k], data[k + 1], data[k + 2]], bg);
  let edge = 0, edgeBg = 0;
  for (let x = 0; x < w; x += 3)
    for (const y of [0, h - 1]) {
      edge++;
      if (near((y * w + x) * 4) < 40) edgeBg++;
    }
  for (let y = 0; y < h; y += 3)
    for (const x of [0, w - 1]) {
      edge++;
      if (near((y * w + x) * 4) < 40) edgeBg++;
    }
  if (edgeBg / edge < 0.85) return;
  for (let k = 0; k < data.length; k += 4) {
    const t = Math.min(1, Math.max(0, (near(k) - 22) / 48));
    data[k + 3] = Math.round(data[k + 3] * t * t * (3 - 2 * t));
  }
}

function palette(data: Uint8ClampedArray, w: number, h: number): { colours: LogoColour[]; onDark: boolean } {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let n = 0, edge = 0, edgeLight = 0;
  const clear = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] < 100;
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] < 160) continue;
    const c: Rgb = [data[k], data[k + 1], data[k + 2]];
    n++;
    const x = (k / 4) % w, y = Math.floor(k / 4 / w);
    if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) {
      edge++;
      if (lum(c) > 0.85 && sat(c) < 0.18) edgeLight++;
    }
    const key = c.map((v) => v >> 5).join(",");
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++;
    b.r += c[0];
    b.g += c[1];
    b.b += c[2];
    buckets.set(key, b);
  }
  if (n === 0) return { colours: [], onDark: false };
  const sorted = [...buckets.values()]
    .filter((b) => b.n > n * 0.03)
    .sort((a, b) => b.n - a.n)
    .map((b) => ({ hex: toHex(b.r / b.n, b.g / b.n, b.b / b.n), share: b.n / n }));
  const merged: LogoColour[] = [];
  for (const c of sorted) {
    const near = merged.find((m) => dist(rgbOf(m.hex), rgbOf(c.hex)) < 48);
    if (near) near.share += c.share;
    else merged.push({ ...c });
  }
  return {
    colours: merged.slice(0, 6).map((c) => ({ hex: c.hex, share: Math.round(c.share * 100) / 100 })),
    onDark: edge > 0 && edgeLight / edge > 0.35,
  };
}

/** Ritar om loggan: genomskinlig bakgrund, beskuren, högst 512 px, alltid PNG. */
export async function prepareLogo(dataUrl: string): Promise<PreparedLogo | null> {
  const img = await loadImage(dataUrl);
  if (!img) return null;
  const isSvg = dataUrl.startsWith("data:image/svg+xml");
  const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512;
  const scale = isSvg ? 640 / Math.max(w0, h0) : Math.min(1, 640 / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const src = canvas(w, h);
  if (!src) return null;
  try {
    src.ctx.drawImage(img, 0, 0, w, h);
    const frame = src.ctx.getImageData(0, 0, w, h);
    clearFlatBackground(frame.data, w, h);
    src.ctx.putImageData(frame, 0, 0);

    let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (frame.data[(y * w + x) * 4 + 3] > 24) {
          count++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (Math.max(bw, bh) < 24 || bh < 12 || bw / bh > 9 || bh / bw > 4 || count / (bw * bh) < 0.03) {
      return null;
    }
    const pad = Math.round(Math.max(bw, bh) * 0.03);
    const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
    const cw = Math.min(w - left, bw + 2 * pad), ch = Math.min(h - top, bh + 2 * pad);

    for (const side of [MAX_SIDE, 384, 256]) {
      const k = Math.min(1, side / Math.max(cw, ch));
      const out = canvas(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
      if (!out) return null;
      out.ctx.imageSmoothingQuality = "high";
      out.ctx.drawImage(src.el, left, top, cw, ch, 0, 0, out.el.width, out.el.height);
      const png = out.el.toDataURL("image/png");
      if (png.length > MAX_DATA_URL) continue;
      const pixels = out.ctx.getImageData(0, 0, out.el.width, out.el.height).data;
      return { png, ...palette(pixels, out.el.width, out.el.height) };
    }
    return null;
  } catch {
    // Canvasen blev "smutsig" eller bilden gick inte att läsa.
    return null;
  }
}

/**
 * Föreningens signaturfärger i ordning. Färgen föreningen själv valt (laget.se)
 * först, sedan loggans tydliga färger, sajtens theme-color bara om loggan inte
 * räcker till två. Nästan vitt räknas inte.
 */
export function signatureColours(
  logo: LogoColour[],
  site: { club?: string | null; theme?: string | null }
): string[] {
  const out: string[] = [];
  const push = (h: string | null | undefined) => {
    if (!h || !/^#[0-9A-F]{6}$/i.test(h)) return;
    const c = rgbOf(h);
    if (lum(c) > 0.94 && sat(c) < 0.1) return;
    if (out.some((o) => dist(rgbOf(o), c) < 52)) return;
    out.push(h.toUpperCase());
  };
  push(site.club);
  // Bland de färgstarka först de som bär text på ljus botten (mörkare, mer mättade).
  const strong = logo
    .filter((c) => sat(rgbOf(c.hex)) > 0.25)
    .sort((a, b) => {
      const score = (c: LogoColour) => c.share * sat(rgbOf(c.hex)) * (1 - lum(rgbOf(c.hex)));
      return score(b) - score(a);
    });
  for (const c of strong) push(c.hex);
  for (const c of logo) if (lum(rgbOf(c.hex)) < 0.2 && c.share > 0.15) push(c.hex);
  if (out.length < 2) push(site.theme);
  for (const c of logo) push(c.hex);
  return out.slice(0, 4);
}
