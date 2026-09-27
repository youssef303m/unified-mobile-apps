// The player's saved settings (01-product/player.md §5.2, §7; settings.md §2.9): the subtitle
// size, colours and position (global, as the TV stores them), autoplay, and background audio
// (N-06, off by default). The subtitle delay is per video and never saved.
import type { KeyValueStore } from "@/api/store";
import { globalKeys } from "@/storage/keys";
import { subtitlePalettes } from "@/theme/colors";

export const TEXT_COLORS: readonly string[] = subtitlePalettes.text;
export const BG_COLORS: readonly string[] = subtitlePalettes.background;
/** The TV's locale keys for the palettes, in the same order. */
export const TEXT_COLOR_KEYS = ["white", "black", "yellow", "green", "cyan", "red"] as const;
export const BG_COLOR_KEYS = ["none", "black", "semi_black", "white", "red", "blue"] as const;

export const SUBTITLE_SIZE = { min: 20, max: 80, step: 5, default: 50 } as const;
export const SUBTITLE_POSITION = { min: 0, max: 50, step: 5, default: 5 } as const;
export const SUBTITLE_DELAY = { min: -60, max: 60, step: 1, default: 0 } as const;

export interface SubtitleStyle {
  size: number;
  textColor: string;
  bgColor: string;
  /** Percent from the bottom. */
  position: number;
}

const clampStep = (value: number, range: { min: number; max: number; step: number }) => {
  const stepped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return Math.min(range.max, Math.max(range.min, stepped));
};

function numberSetting(
  store: KeyValueStore,
  key: string,
  range: { min: number; max: number; step: number; default: number },
): number {
  const value = Number(store.get(key));
  return Number.isFinite(value) && store.get(key) !== undefined
    ? clampStep(value, range)
    : range.default;
}

export function readSubtitleStyle(store: KeyValueStore): SubtitleStyle {
  const text = store.get(globalKeys.subtitleTextColor);
  const bg = store.get(globalKeys.subtitleBgColor);
  return {
    size: numberSetting(store, globalKeys.subtitleSize, SUBTITLE_SIZE),
    textColor: text && TEXT_COLORS.includes(text) ? text : subtitlePalettes.text[0],
    bgColor: bg && BG_COLORS.includes(bg) ? bg : subtitlePalettes.background[0],
    position: numberSetting(store, globalKeys.subtitlePosition, SUBTITLE_POSITION),
  };
}

export function saveSubtitleStyle(store: KeyValueStore, style: SubtitleStyle): void {
  store.set(globalKeys.subtitleSize, String(clampStep(style.size, SUBTITLE_SIZE)));
  store.set(globalKeys.subtitleTextColor, style.textColor);
  store.set(globalKeys.subtitleBgColor, style.bgColor);
  store.set(globalKeys.subtitlePosition, String(clampStep(style.position, SUBTITLE_POSITION)));
}

/** Arrows cycle through a palette and wrap around. */
export function cycle<T>(palette: readonly T[], current: T, step: 1 | -1): T {
  const i = palette.indexOf(current);
  const next = ((((i < 0 ? 0 : i) + step) % palette.length) + palette.length) % palette.length;
  return palette[next] ?? current;
}

/** Stepped value within a range (size, position, delay). */
export function stepValue(
  range: { min: number; max: number; step: number },
  current: number,
  direction: 1 | -1,
): number {
  return clampStep(current + direction * range.step, range);
}

/**
 * The TV sizes subtitles as `size/16 rem` on a 1080p screen; on a phone the same number gives a
 * font about 1/3 of that in dp (50 → 18 dp), scaled with the screen's shorter side.
 */
export function subtitleFontSize(size: number, shortSide: number): number {
  return Math.round((size / 50) * 18 * Math.min(1.6, Math.max(0.8, shortSide / 360)));
}

export function autoPlayOn(store: KeyValueStore): boolean {
  return store.get(globalKeys.autoPlay) === "on";
}

export function setAutoPlay(store: KeyValueStore, on: boolean): void {
  store.set(globalKeys.autoPlay, on ? "on" : "off");
}

export function backgroundAudioOn(store: KeyValueStore): boolean {
  return store.get(globalKeys.backgroundAudio) === "on";
}

export function setBackgroundAudio(store: KeyValueStore, on: boolean): void {
  store.set(globalKeys.backgroundAudio, on ? "on" : "off");
}
