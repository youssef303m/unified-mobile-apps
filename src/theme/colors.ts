// Colour tokens: 03-design/design-system.md §1. The app is dark only in v1.
// This is the only place in the app where colour values are written.

export const colors = {
  brand: {
    primary: "#BF242E",
    primaryPressed: "#950606",
    deep: "#690101",
    accent: "#C0392B",
    light: "#FF8484",
    logoGrey: "#323232",
  },
  bg: {
    base: "#000000",
    elevated: "#141414",
  },
  surface: {
    1: "#1F1F1F",
    2: "#2B2B2B",
    3: "#3A3A3A",
  },
  border: {
    subtle: "rgba(255,255,255,0.08)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#B3B3B3",
    tertiary: "#808080",
    onPrimary: "#FFFFFF",
    inverse: "#000000",
  },
  status: {
    success: "#46D369",
    warning: "#F5B50A",
    danger: "#E5484D",
    info: "#3E8EF7",
  },
  progress: {
    track: "rgba(255,255,255,0.3)",
  },
  shadow: "rgba(0,0,0,0.5)",
} as const;

// Scrim gradients (angle in degrees, CSS convention).
export const scrims = {
  top: { angle: 180, colors: ["rgba(0,0,0,0.7)", "transparent"] },
  bottom: { angle: 0, colors: [colors.bg.base, "transparent"], heightRatio: 0.6 },
} as const;

// The scrims as CSS gradients for React Native's built-in `experimental_backgroundImage`
// (New Architecture; docs/decisions.md D-057).
export const gradients = {
  scrimTop: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
  scrimBottom: "linear-gradient(0deg, #000000 0%, rgba(0,0,0,0) 100%)",
  /** The Live Now card and the details backdrop fade. */
  fadeBottom: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
} as const;

// The TV's subtitle palettes (01-product/player.md §5.2). These exact strings are also the saved
// values of `subtitle_text_color` and `subtitle_bg_color`, so they must not change.
export const subtitlePalettes = {
  text: ["#ffffff", "#000000", "#ffe000", "#26d367", "#39d5e0", "#e02323"],
  background: ["transparent", "#000000", "rgba(0,0,0,0.6)", "#ffffff", "#950606", "#1d528f"],
} as const;
