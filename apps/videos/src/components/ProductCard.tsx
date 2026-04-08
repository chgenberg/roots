import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BRAND, COLORS } from "./BrandColors";
import { FONT_FAMILY } from "./useFont";

type ProductCardProps = {
  name: string;
  type: string;
  price: string;
  delay?: number;
  color?: string;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  type,
  price,
  delay = 0,
  color = BRAND[50],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
  });

  const y = interpolate(entrance, [0, 1], [80, 0]);

  return (
    <div
      style={{
        width: 320,
        backgroundColor: color,
        borderRadius: 24,
        padding: 40,
        fontFamily: FONT_FAMILY,
        opacity: entrance,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          backgroundColor: BRAND[200],
        }}
      />
      <div style={{ fontSize: 14, fontWeight: 600, color: BRAND[400], textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {type}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.foreground }}>
        {name}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: BRAND[500] }}>
        {price}
      </div>
    </div>
  );
};
