import { NextResponse } from "next/server";
import { BrandError, readClubBrand } from "@/lib/club-brand/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  if (hits.size > 5000) hits.clear();
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Namn, färg och logga från en förenings webbplats — förhandsvisningen på /prova och föreningens profil när en klubb skapas. */
export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("webb") ?? "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "okänd";
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "limited" }, { status: 429 });
  }
  try {
    const brand = await readClubBrand(site);
    return NextResponse.json(
      { ok: true, brand },
      { headers: { "Cache-Control": "private, max-age=600" } }
    );
  } catch (err) {
    const code = err instanceof BrandError ? err.code : "unreachable";
    return NextResponse.json({ ok: false, error: code }, { status: code === "invalid" ? 400 : 422 });
  }
}
