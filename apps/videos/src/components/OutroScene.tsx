import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RootsLogo } from "./RootsLogo";
import { BRAND, COLORS } from "./BrandColors";
import { FONT_FAMILY } from "./useFont";

type OutroSceneProps = {
  cta: string;
  url?: string;
  bgColor?: string;
};

export const OutroScene: React.FC<OutroSceneProps> = ({
  cta,
  url = "roots.se",
  bgColor = BRAND[900],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaEntry = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 200 },
  });
  const urlEntry = spring({
    frame,
    fps,
    delay: 20,
    config: { damping: 200 },
  });

  const ctaY = interpolate(ctaEntry, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <RootsLogo color={COLORS.white} size={72} />
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 600,
          color: COLORS.white,
          opacity: ctaEntry,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        {cta}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 22,
          color: BRAND[300],
          opacity: urlEntry,
          letterSpacing: "0.05em",
        }}
      >
        {url}
      </div>
    </AbsoluteFill>
  );
};
