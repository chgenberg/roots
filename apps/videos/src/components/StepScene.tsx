import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, COLORS } from "./BrandColors";
import { FONT_FAMILY } from "./useFont";

type StepSceneProps = {
  stepNumber: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

export const StepScene: React.FC<StepSceneProps> = ({
  stepNumber,
  title,
  description,
  icon,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numberScale = spring({ frame, fps, config: { damping: 200 } });
  const titleSlide = spring({
    frame,
    fps,
    delay: 6,
    config: { damping: 200 },
  });
  const descSlide = spring({
    frame,
    fps,
    delay: 12,
    config: { damping: 200 },
  });
  const iconScale = spring({
    frame,
    fps,
    delay: 3,
    config: { damping: 15, stiffness: 80 },
  });

  const titleX = interpolate(titleSlide, [0, 1], [60, 0]);
  const descX = interpolate(descSlide, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        fontFamily: FONT_FAMILY,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        padding: 120,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          transform: `scale(${iconScale})`,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            backgroundColor: BRAND[50],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: BRAND[400],
            opacity: numberScale,
            transform: `scale(${numberScale})`,
          }}
        >
          STEG {stepNumber}
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.foreground,
            opacity: titleSlide,
            transform: `translateX(${titleX}px)`,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 26,
            color: BRAND[500],
            marginTop: 16,
            opacity: descSlide,
            transform: `translateX(${descX}px)`,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </AbsoluteFill>
  );
};
