// Seeking (01-product/player.md §3.1 "Seek verification"), for portals that ignore HTTP Range:
// targets are clamped to [0, duration − 5 s]; quick presses add up (a pending target stays
// authoritative for 3 s); every seek is verified by polling the real position; a failed seek gets
// one reload plus re-seek (movies and episodes); a seek that kills the stream disables seeking for
// the session.

export const SEEK_END_MARGIN_S = 5;
export const PENDING_TARGET_MS = 3_000;
export const VERIFY_POLL_MS = 250;
export const VERIFY_TIMEOUT_MS = 4_000;
export const VERIFY_TOLERANCE_S = 3;
/** The skip buttons (parity) and the double-tap gesture (N-04). */
export const SKIP_BUTTON_S = 30;
export const DOUBLE_TAP_S = 10;

/** Never land exactly on the end, which would fire "ended". */
export function clampSeek(target: number, duration: number): number {
  const max = Math.max(0, duration - SEEK_END_MARGIN_S);
  return Math.min(Math.max(0, target), max);
}

/** Quick presses add up: three +30 s presses give +90 s. */
export class SeekAccumulator {
  private pending: { target: number; at: number } | undefined;

  constructor(private readonly now: () => number = Date.now) {}

  /** A relative step from the pending target (if still fresh) or the current position. */
  step(delta: number, position: number, duration: number): number {
    const at = this.now();
    const base =
      this.pending && at - this.pending.at < PENDING_TARGET_MS ? this.pending.target : position;
    return this.set(base + delta, duration, at);
  }

  /** An absolute target (the seek bar, Quick Seek). */
  absolute(target: number, duration: number): number {
    return this.set(target, duration, this.now());
  }

  clear(): void {
    this.pending = undefined;
  }

  private set(target: number, duration: number, at: number): number {
    const clamped = clampSeek(target, duration);
    this.pending = { target: clamped, at };
    return clamped;
  }
}

/** The seek worked when the position lands within ±3 s of the target, plus the time elapsed. */
export function seekLanded(target: number, position: number, elapsedS: number): boolean {
  return (
    position >= target - VERIFY_TOLERANCE_S && position <= target + VERIFY_TOLERANCE_S + elapsedS
  );
}

export type SeekOutcome = "ok" | "failed" | "disabled";

export interface SeekPlayer {
  seek(target: number): void;
  position(): Promise<number>;
  /** Reload the same URL at `target` (the one retry for movies and episodes). */
  reload?(target: number): Promise<void>;
}

export interface SeekClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: SeekClock = {
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class SeekController {
  private disabled = false;
  private generation = 0;

  constructor(
    private readonly player: SeekPlayer,
    private readonly clock: SeekClock = realClock,
  ) {}

  get seekingDisabled(): boolean {
    return this.disabled;
  }

  /** The stream died right after a seek: no more seeking in this session. */
  seekKilledStream(): void {
    this.disabled = true;
  }

  /**
   * Seek and verify. A newer seek supersedes an older one (its result is "ok", so the screen
   * does nothing with it).
   */
  async seek(target: number): Promise<SeekOutcome> {
    if (this.disabled) return "disabled";
    const generation = ++this.generation;
    this.player.seek(target);
    if (await this.verify(target, generation)) return "ok";
    if (generation !== this.generation) return "ok";
    if (!this.player.reload) return "failed";
    await this.player.reload(target);
    if (generation !== this.generation) return "ok";
    this.player.seek(target);
    return (await this.verify(target, generation)) || generation !== this.generation
      ? "ok"
      : "failed";
  }

  private async verify(target: number, generation: number): Promise<boolean> {
    const started = this.clock.now();
    while (this.clock.now() - started <= VERIFY_TIMEOUT_MS) {
      await this.clock.sleep(VERIFY_POLL_MS);
      if (generation !== this.generation) return true;
      const elapsed = (this.clock.now() - started) / 1000;
      if (seekLanded(target, await this.player.position(), elapsed)) return true;
    }
    return false;
  }
}
