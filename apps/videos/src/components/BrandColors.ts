export const BRAND = {
  900: "#1C1410",
  800: "#2A1F18",
  700: "#3B2D22",
  600: "#4A372C",
  500: "#6B5344",
  400: "#8C7466",
  300: "#B5A89E",
  200: "#D4CCC4",
  100: "#E8E4E0",
  50: "#F5F3F1",
} as const;

export const COLORS = {
  white: "#FFFFFF",
  background: "#FFFFFF",
  foreground: BRAND[900],
  muted: BRAND[500],
  accent: BRAND[600],
  success: "#2F4A3C",
  error: "#8C2F2F",
} as const;

export const VIDEO = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
} as const;
