import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./BrandColors";
import { FONT_FAMILY } from "./useFont";

type RootsLogoProps = {
  color?: string;
  size?: number;
  delay?: number;
};

export const RootsLogo: React.FC<RootsLogoProps> = ({
  color = COLORS.foreground,
  size = 64,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, delay, config: { damping: 200 } });
  const opacity = spring({ frame, fps, delay, config: { damping: 200 } });

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        fontSize: size,
        fontWeight: 700,
        color,
        letterSpacing: "-0.02em",
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      Roots
    </div>
  );
};
