import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Roots — Föreningsnära hårvård";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#6B794F",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 120,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          roots
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: 36,
            marginTop: 28,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          Föreningsnära hårvård
        </div>
      </div>
    ),
    { ...size }
  );
}
