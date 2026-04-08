import React from "react";
import {
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { COLORS } from "./BrandColors";
import { FONT_FAMILY } from "./useFont";

type CounterAnimationProps = {
  from?: number;
  to: number;
  suffix?: string;
  prefix?: string;
  fontSize?: number;
  color?: string;
};

export const CounterAnimation: React.FC<CounterAnimationProps> = ({
  from = 0,
  to,
  suffix = "",
  prefix = "",
  fontSize = 72,
  color = COLORS.foreground,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [0, 2 * fps], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const value = Math.round(interpolate(progress, [0, 1], [from, to]));

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        fontSize,
        fontWeight: 700,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {value.toLocaleString("sv-SE")}
      {suffix}
    </div>
  );
};
