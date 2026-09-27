// Next and previous items, and what happens at the end (01-product/player.md §3.1): the list is
// where the player was opened from (the category, the season's episodes, the catch-up day);
// manual Next/Previous stop at the ends; at the end of a video, autoplay off stops and shows the
// controls, autoplay on plays the next item at once (or closes the player when the list ran out).
// N-07: in the last 30 s of an episode with a next one, a "Next episode" card; with autoplay on it
// counts down 10 s (the TV jumps with no countdown; the phone restyles it).

export const NEXT_EPISODE_WINDOW_S = 30;
export const NEXT_EPISODE_COUNTDOWN_S = 10;
/** Two "ended" events within 1 s count once. */
export const END_DEBOUNCE_MS = 1_000;

export interface PlayQueue<T> {
  items: readonly T[];
  index: number;
}

export function queueAt<T>(queue: PlayQueue<T>, index: number): PlayQueue<T> | undefined {
  return index >= 0 && index < queue.items.length ? { items: queue.items, index } : undefined;
}

export const nextInQueue = <T>(q: PlayQueue<T>) => queueAt(q, q.index + 1);
export const previousInQueue = <T>(q: PlayQueue<T>) => queueAt(q, q.index - 1);

export type EndAction = "next" | "close" | "stop";

export function endAction(autoPlay: boolean, hasNext: boolean): EndAction {
  if (!autoPlay) return "stop";
  return hasNext ? "next" : "close";
}

export type NextEpisodeCard =
  | { kind: "hidden" }
  /** Autoplay off: a plain "Next episode" button. */
  | { kind: "button" }
  /** Autoplay on: seconds left before the next episode starts. */
  | { kind: "countdown"; seconds: number };

/**
 * `shownAt` is the position (seconds) where the card first appeared, so the countdown runs on
 * playback time (it pauses with the video).
 */
export function nextEpisodeCard(input: {
  isEpisode: boolean;
  hasNext: boolean;
  autoPlay: boolean;
  dismissed: boolean;
  position: number;
  duration: number;
  shownAt: number | undefined;
}): NextEpisodeCard {
  const { isEpisode, hasNext, autoPlay, dismissed, position, duration, shownAt } = input;
  if (!isEpisode || !hasNext || dismissed || !(duration > NEXT_EPISODE_WINDOW_S)) {
    return { kind: "hidden" };
  }
  if (duration - position > NEXT_EPISODE_WINDOW_S) return { kind: "hidden" };
  if (!autoPlay) return { kind: "button" };
  const elapsed = Math.max(0, position - (shownAt ?? position));
  return { kind: "countdown", seconds: Math.max(0, Math.ceil(NEXT_EPISODE_COUNTDOWN_S - elapsed)) };
}

export class EndDebouncer {
  private last = -Infinity;

  constructor(private readonly now: () => number = Date.now) {}

  /** True for the first "ended" in a 1 s window. */
  accept(): boolean {
    const at = this.now();
    if (at - this.last < END_DEBOUNCE_MS) return false;
    this.last = at;
    return true;
  }
}
