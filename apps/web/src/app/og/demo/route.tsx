import { ImageResponse } from "next/og";
import { clubGenitive, demo } from "@/i18n/dictionaries/demo";
import { tFill } from "@/i18n/format";
import { accentTokens } from "@/lib/club-brand/colour";
import { readClubBrand } from "@/lib/club-brand/scrape";
import { OG_SIZE, OgFrame, ogParam } from "../og-frame";

export const runtime = "nodejs";

/** Loggan från föreningens sajt, om den hinner hämtas. PNG/JPEG ritas säkert i delningsbilden. */
async function clubLogo(site: string): Promise<{ logo: string | null; color: string | null }> {
  if (!site) return { logo: null, color: null };
  const brand = await Promise.race([
    readClubBrand(site).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
  const logo = brand?.logo && /^data:image\/(png|jpeg|jpg);/.test(brand.logo) ? brand.logo : null;
  return { logo, color: brand?.color ?? null };
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "sv";
  const t = demo[locale];
  const club = ogParam(url, "forening", 60) || t.previewFallbackClub;
  const team = ogParam(url, "lag", 40);
  const { logo, color } = await clubLogo(ogParam(url, "webb", 120));
  const farg = ogParam(url, "farg", 6);
  const accent = /^[0-9a-f]{6}$/i.test(farg) ? accentTokens(`#${farg}`) : color ? accentTokens(color) : null;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                columnGap: 18,
                fontSize: 72,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {tFill(t.ogDemoTitle, { clubGen: "\u0000" })
                .split(" ")
                .map((word, i) =>
                  word === "\u0000" ? (
                    <span key={i}>{clubGenitive(club, locale)}</span>
                  ) : (
                    <span key={i} style={{ whiteSpace: "nowrap" }}>
                      {word}
                    </span>
                  )
                )}
            </div>
            <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "#6D614D" }}>
              {team ? `${team} · ${t.ogDemoBody}` : t.ogDemoBody}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 360,
              padding: 32,
              borderRadius: 36,
              background: "rgba(255,255,255,0.85)",
              boxShadow: "0 30px 60px -30px rgba(63,55,43,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 104,
                height: 104,
                borderRadius: 26,
                background: logo ? "#FFFFFF" : accent?.solid ?? "#6D614D",
                color: accent?.onSolid ?? "#FFFFFF",
                fontSize: 36,
                fontWeight: 600,
                padding: logo ? 8 : 0,
              }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" width={88} height={88} style={{ objectFit: "contain" }} />
              ) : (
                initials(club)
              )}
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, marginTop: 24 }}>
              {tFill(t.shopSupport, { club })}
            </div>
            <div style={{ display: "flex", height: 16, marginTop: 24, borderRadius: 999, background: "#EFE8DD" }}>
              <div style={{ display: "flex", width: "64%", borderRadius: 999, background: accent?.meter ?? "#6D614D" }} />
            </div>
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE }
  );
}
