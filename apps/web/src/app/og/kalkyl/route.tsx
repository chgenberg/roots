import { ImageResponse } from "next/og";
import { demo } from "@/i18n/dictionaries/demo";
import { tFill } from "@/i18n/format";
import { OG_SIZE, OgFrame, ogParam } from "../og-frame";

export const runtime = "edge";

export function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "sv";
  const t = demo[locale];
  const club = ogParam(url, "forening", 60);
  const amount = Math.max(0, Math.min(99_999_999, Math.round(Number(ogParam(url, "belopp", 9)) || 0)));
  const n = amount.toLocaleString(locale === "en" ? "en-GB" : "sv-SE").replace(/\u00a0/g, " ");
  const formatted = locale === "en" ? `SEK ${n}` : `${n} kr`;
  const download = url.searchParams.get("ladda") === "1";

  const response = new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, color: "#6D614D" }}>
            {club ? tFill(t.ogCalcLead, { club }) : t.ogCalcLeadNoClub}
          </div>
          <div style={{ display: "flex", fontSize: 168, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 12 }}>
            {formatted}
          </div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "#6D614D" }}>{t.ogCalcBody}</div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE }
  );

  if (download) {
    response.headers.set("Content-Disposition", 'attachment; filename="roots-kalkyl.png"');
  }
  return response;
}
