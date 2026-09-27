// Saving the watch position during playback (R-073, 01-product/player.md §4.2):
// - while playing, at most one write a minute, and only a "save" (≥ 10 s in, ≥ 10 s left);
// - never while the resume prompt is on screen or a position restore runs;
// - on exit, next/previous or an episode switch, the full rule: save, finish (remove) or nothing;
// - bookmark protection: after a failed restore, nothing is written until playback passes the
//   old bookmark, so early viewing cannot overwrite it;
// - adult items are never saved (R-063, inside the rule functions). Live and catch-up have no
//   tracker.
import type { KeyValueStore } from "@/api/store";
import {
  PROGRESS_SAVE_INTERVAL_MS,
  progressDecision,
  saveEpisodeProgress,
  saveMovieProgress,
  type EpisodeRef,
  type ProgressDecision,
} from "@/content/rules/library";

export type ProgressTarget =
  { kind: "movie"; movieId: string } | { kind: "episode"; seriesId: string; episode: EpisodeRef };

export type SaveBlock = "prompt" | "restore";

export class ProgressTracker {
  private lastWriteAt: number;
  private readonly blocks = new Set<SaveBlock>();
  private bookmark: number | undefined;

  constructor(
    private readonly store: KeyValueStore,
    private readonly pid: string,
    private readonly target: ProgressTarget,
    private readonly isAdult: boolean,
    private readonly now: () => number = Date.now,
  ) {
    this.lastWriteAt = now();
  }

  block(reason: SaveBlock): void {
    this.blocks.add(reason);
  }

  unblock(reason: SaveBlock): void {
    this.blocks.delete(reason);
  }

  /** A restore failed and playback restarted from 0: protect the old bookmark. */
  protect(bookmark: number): void {
    this.bookmark = bookmark;
  }

  /** Every progress update while playing. Returns whether it wrote. */
  tick(position: number, duration: number): boolean {
    if (this.blocks.size > 0 || this.protecting(position)) return false;
    if (this.now() - this.lastWriteAt < PROGRESS_SAVE_INTERVAL_MS) return false;
    if (progressDecision(position, duration) !== "save") return false;
    this.write(position, duration);
    return true;
  }

  /** Leaving this item (exit, next/previous, episode switch). */
  leave(position: number, duration: number): ProgressDecision {
    if (this.protecting(position)) return "ignore";
    return this.write(position, duration);
  }

  private protecting(position: number): boolean {
    if (this.bookmark === undefined) return false;
    if (position > this.bookmark) {
      this.bookmark = undefined;
      return false;
    }
    return true;
  }

  private write(position: number, duration: number): ProgressDecision {
    this.lastWriteAt = this.now();
    const t = this.target;
    return t.kind === "movie"
      ? saveMovieProgress(this.store, this.pid, t.movieId, position, duration, this.isAdult)
      : saveEpisodeProgress(
          this.store,
          this.pid,
          t.seriesId,
          t.episode,
          position,
          duration,
          this.isAdult,
        );
  }
}
