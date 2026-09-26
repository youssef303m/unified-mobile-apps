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
  topBarLogoHeight: 28,
  topBarSolidAfter: 40,
  splashLogoWidth: 200,
} as const;

export const radius = {
  poster: 6,
  card: 8,
  button: 6,
  chip: 16,
  sheet: 16,
  input: 8,
} as const;

// Only the bottom sheet and the mini player get a shadow (0 -4 16 rgba(0,0,0,0.5)).
export const elevation = {
  sheet: {
    boxShadow: `0px -4px 16px ${colors.shadow}`,
  },
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
  shimmerLoopMs: 1200,
  toastMs: 4000,
} as const;

export const theme = { colors, scrims, spacing, layout, radius, elevation, artwork, motion };
export type Theme = typeof theme;
