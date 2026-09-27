// The live player's rules (01-product/player.md §3.2, §3.3): zapping moves within the current
// category, clamps at the ends (no wrap), and starts playback after a 400 ms debounce, so fast
// swipes skip channels without starting each one. The info bar hides after 7.5 s; the VOD controls
// after 10 s (parity timeouts).

export const ZAP_DEBOUNCE_MS = 400;
export const LIVE_BAR_HIDE_MS = 7_500;
export const VOD_CONTROLS_HIDE_MS = 10_000;

export type ZapDirection = "next" | "previous";

/** The channel index after a zap, or undefined at the ends. */
export function zapIndex(
  count: number,
  index: number,
  direction: ZapDirection,
): number | undefined {
  const next = direction === "next" ? index + 1 : index - 1;
  return next >= 0 && next < count ? next : undefined;
}

/** Calls `fn` with the last value once `ms` passed without a new call. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
  timers: {
    setTimeout(f: () => void, ms: number): unknown;
    clearTimeout(h: unknown): void;
  } = {
    setTimeout: (f, t) => setTimeout(f, t),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): { call: (...args: A) => void; cancel: () => void } {
  let handle: unknown;
  return {
    call: (...args: A) => {
      if (handle !== undefined) timers.clearTimeout(handle);
      handle = timers.setTimeout(() => {
        handle = undefined;
        fn(...args);
      }, ms);
    },
    cancel: () => {
      if (handle !== undefined) timers.clearTimeout(handle);
      handle = undefined;
    },
  };
}
