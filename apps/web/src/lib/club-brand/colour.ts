/**
 * Föreningens färg som accent i demo-shopen: plocka huvudfärgen ur loggan och
 * räkna fram toner som alltid ger läsbar text.
 */

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: Rgb): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function isHexColour(v: string | null | undefined): v is string {
  return Boolean(v && /^#[0-9a-f]{6}$/i.test(v));
}

export type AccentTokens = {
  /** Knappar, märkesruta. */
  solid: string;
  /** Text på `solid`. */
  onSolid: string;
  /** Mätarens fyllning — mörkare om färgen är för ljus mot spåret. */
  meter: string;
  /** Ljus ton för sidhuvudet i shopen. */
  soft: string;
};

const INK: Rgb = [28, 20, 16];
const WHITE: Rgb = [255, 255, 255];
const CREAM: Rgb = [247, 243, 234];

export function accentTokens(hex: string): AccentTokens {
  const base = toRgb(hex);
  const onSolid = contrast(base, WHITE) >= contrast(base, INK) ? "#FFFFFF" : "#1C1410";
  const meter = luminance(base) > 0.55 ? toHex(mix(base, INK, 0.3)) : toHex(base);
  return { solid: toHex(base), onSolid, meter, soft: toHex(mix(base, CREAM, 0.84)) };
}

/** Huvudfärgen i en logga (data-URL). Vitt, svart och grått räknas inte. */
export function dominantColour(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const l = (max + min) / 510;
          const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
          if (l > 0.92 || l < 0.1 || s < 0.28) continue;
          const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
          const bucket = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
          const w = 1 + s;
          bucket.w += w;
          bucket.r += r * w;
          bucket.g += g * w;
          bucket.b += b * w;
          buckets.set(key, bucket);
        }
        const best = [...buckets.values()].sort((p, q) => q.w - p.w)[0];
        // För få färgade pixlar: loggan är i praktiken svartvit.
        if (!best || best.w < size * size * 0.03) return resolve(null);
        resolve(toHex([best.r / best.w, best.g / best.w, best.b / best.w]));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
