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

type IntroSceneProps = {
  tagline: string;
  bgColor?: string;
  textColor?: string;
};

export const IntroScene: React.FC<IntroSceneProps> = ({
  tagline,
  bgColor = COLORS.white,
  textColor = COLORS.foreground,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineEntry = spring({
    frame,
    fps,
    delay: 15,
    config: { damping: 200 },
  });

  const taglineY = interpolate(taglineEntry, [0, 1], [30, 0]);

  const lineWidth = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <RootsLogo color={textColor} size={80} />
      <div
        style={{
          width: interpolate(lineWidth, [0, 1], [0, 120]),
          height: 2,
          backgroundColor: BRAND[300],
        }}
      />
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 28,
          color: BRAND[400],
          opacity: taglineEntry,
          transform: `translateY(${taglineY}px)`,
          textAlign: "center",
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        {tagline}
      </div>
    </AbsoluteFill>
  );
};
