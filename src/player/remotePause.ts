// Earbuds, the media notification, the PiP window and an audio-focus loss pause and resume the
// player natively, through the media session (D-088). The screen's `paused` state follows them:
// "playing" at once, "paused" only when the player is still stopped a moment later for no other
// reason. ExoPlayer reports that playback stopped before it reports buffering or an error, and a
// seek stops it briefly too.

import type { Timers } from "./supervisor";

export const REMOTE_PAUSE_SETTLE_MS = 500;

export interface RemotePauseListener {
  /** The player stopped for another reason: buffering, a reload, a failure, or the app left. */
  notAPause(): boolean;
  /** The player now plays (false) or is paused (true). */
  paused(paused: boolean): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class RemotePause {
  private pending: unknown;

  constructor(
    private readonly listener: RemotePauseListener,
    private readonly timers: Timers = realTimers,
  ) {}

  /** react-native-video's onPlaybackStateChanged. */
  playing(isPlaying: boolean): void {
    this.cancel();
    if (isPlaying) {
      this.listener.paused(false);
      return;
    }
    this.pending = this.timers.setTimeout(() => {
      this.pending = undefined;
      if (!this.listener.notAPause()) this.listener.paused(true);
    }, REMOTE_PAUSE_SETTLE_MS);
  }

  /** The video ended or the item changed: a stop that is not a pause. */
  cancel(): void {
    if (this.pending === undefined) return;
    this.timers.clearTimeout(this.pending);
    this.pending = undefined;
  }
}
