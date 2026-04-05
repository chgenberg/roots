"use client";

interface FloatingShapeProps {
  className?: string;
  shape?: "circle" | "ring" | "dot";
  size?: number;
}

export function FloatingShape({
  className = "",
  shape = "circle",
  size = 120,
}: FloatingShapeProps) {
  const shapes = {
    circle: (
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 2}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.12"
      />
    ),
    ring: (
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 3}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.08"
      />
    ),
    dot: (
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 8}
        fill="currentColor"
        opacity="0.06"
      />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`pointer-events-none text-brand-900 animate-float motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    >
      {shapes[shape]}
    </svg>
  );
}
