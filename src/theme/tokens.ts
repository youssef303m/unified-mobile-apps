// Spacing, radius, elevation and artwork tokens: 03-design/design-system.md §3-4, §7.
import { colors, gradients, scrims } from "./colors";

export { colors, gradients, scrims };

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const layout = {
  gutter: spacing.lg,
  rowGap: spacing.xxl,
  posterGap: spacing.sm,
  touchTarget: 48,
  iconSize: 24,
  iconStroke: 2,
  buttonHeight: 44,
  progressBarHeight: 3,
  /** Style A: the wide logo on Home (D-085). */
  topBarLogoHeight: 52,
  /** Round icon buttons (top bar, hero, details actions). */
  circleButton: 42,
  topBarSolidAfter: 40,
  splashLogoWidth: 200,
} as const;

// Style A (D-085): pill buttons and chips, softer cards.
export const radius = {
  poster: 10,
  card: 14,
  button: 999,
  chip: 999,
  sheet: 20,
  input: 12,
  badge: 4,
  tabBar: 22,
} as const;

// Style A adds a red glow, kept to a few elements on screen at a time: Play, the selected chip
// and the active tab (D-085).
export const elevation = {
  sheet: {
    boxShadow: `0px -4px 16px ${colors.shadow}`,
  },
  glow: { boxShadow: `0px 0px 20px ${colors.brand.glow}` },
  glowSoft: { boxShadow: `0px 0px 12px ${colors.brand.glow}` },
} as const;

// Reference sizes on a 360dp-wide phone.
export const artwork = {
  poster: { width: 110, height: 165, aspect: 2 / 3 },
  continueCard: { width: 150, height: 84, aspect: 16 / 9 },
  hero: { width: 360, height: 480 },
  channelLogo: { width: 56, height: 56 },
  liveNowCard: { width: 200, height: 112, aspect: 16 / 9 },
  episodeStill: { width: 128, height: 72, aspect: 16 / 9 },
  backdrop: { aspect: 16 / 9 },
  imageFadeMs: 200,
} as const;

export const motion = {
  screenTransitionMs: 250,
  heroCrossfadeMs: 400,
  pressScale: 0.96,
  pressMs: 120,
  controlsFadeMs: 200,
  controlsAutoHideMs: 4000,
  /** The players keep the TV's timeouts (player.md §3.3; docs/decisions.md D-067). */
  vodControlsHideMs: 10_000,
  liveBarHideMs: 7_500,
  shimmerLoopMs: 1200,
  toastMs: 4000,
} as const;

export const theme = { colors, scrims, spacing, layout, radius, elevation, artwork, motion };
export type Theme = typeof theme;
