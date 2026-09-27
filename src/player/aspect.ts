// Aspect ratio (01-product/player.md §3.1, §3.3): Fit (the default), Fill (crop), Stretch, and the
// TV's fixed ratios 16:9, 4:3, 21:9 and 1:1, which need a wrapper of that shape around a
// stretched video. The choice is not saved. Live resets it on every channel change (parity:
// the TV resets to Stretch; the phone resets to Fit, see docs/decisions.md).
export type AspectMode = "fit" | "fill" | "stretch" | "16:9" | "4:3" | "21:9" | "1:1";

export const ASPECT_MODES: readonly AspectMode[] = [
  "fit",
  "fill",
  "stretch",
  "16:9",
  "4:3",
  "21:9",
  "1:1",
];

const RATIOS: Partial<Record<AspectMode, number>> = {
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "21:9": 21 / 9,
  "1:1": 1,
};

export interface AspectLayout {
  resizeMode: "contain" | "cover" | "stretch";
  /** Width and height of the video box inside the screen. */
  width: number;
  height: number;
}

/** The video box for a mode inside a screen of `width` × `height`. */
export function aspectLayout(mode: AspectMode, width: number, height: number): AspectLayout {
  const ratio = RATIOS[mode];
  if (ratio === undefined) {
    const resizeMode = mode === "fill" ? "cover" : mode === "stretch" ? "stretch" : "contain";
    return { resizeMode, width, height };
  }
  const byWidth = { width, height: width / ratio };
  const box = byWidth.height <= height ? byWidth : { width: height * ratio, height };
  return { resizeMode: "stretch", ...box };
}

/** Pinch toggles Fit ↔ Fill (N-04): out fills, in fits (from any mode). */
export function pinchAspect(pinchOut: boolean): AspectMode {
  return pinchOut ? "fill" : "fit";
}
