// Keeps one play alive (01-product/player.md §2.3, §2.4, §2.6):
// - every attempt gets 12 s to show its first frame (not armed on the last attempt);
// - before the first frame, an error or a missed deadline moves to the next attempt;
// - once playing, errors never switch attempt: the reconnect loop runs (6 s delay, at most 10
//   tries, the counter reset after 5 s of healthy playback);
// - after the 10th failed try the play has failed; the screen offers Retry (§6 Mobile).
// Each reconnect asks for a fresh URL (Q-behaviour-fixes #10: expired Stalker links recover).

export const FIRST_FRAME_TIMEOUT_MS = 12_000;
export const RECONNECT_DELAY_MS = 6_000;
export const RECONNECT_MAX = 10;
export const HEALTHY_RESET_MS = 5_000;

export type SupervisorStatus = "loading" | "playing" | "reconnecting" | "failed";

export interface SupervisorState {
  status: SupervisorStatus;
  /** The attempt in the stream plan being loaded or played. */
  attempt: number;
  /** Reconnect tries used (0…10). */
  reconnects: number;
}

export type LoadReason = "start" | "fallback" | "reconnect";

export interface SupervisorListener {
  /** Load `attempt` of the plan; "start" and "reconnect" resolve the URL again. */
  load(attempt: number, reason: LoadReason): void;
  state(state: SupervisorState): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class PlaybackSupervisor {
  private attempt = 0;
  private reconnects = 0;
  private started = false;
  private status: SupervisorStatus = "loading";
  private watchdog: unknown;
  private healthy: unknown;
  private retryTimer: unknown;
  private disposed = false;

  constructor(
    private readonly attempts: number,
    private readonly listener: SupervisorListener,
    private readonly timers: Timers = realTimers,
  ) {}

  get state(): SupervisorState {
    return { status: this.status, attempt: this.attempt, reconnects: this.reconnects };
  }

  /** A new play (or the Retry button): the reconnect budget starts again. */
  start(): void {
    this.reconnects = 0;
    this.begin(0, "start");
  }

  /** The first frame is on screen. */
  firstFrame(): void {
    if (this.disposed) return;
    this.clear("watchdog");
    this.started = true;
    this.setStatus("playing");
    this.clear("healthy");
    // The 5 s rule stops a load → error → load cycle from repeating forever.
    this.healthy = this.timers.setTimeout(() => {
      this.healthy = undefined;
      this.reconnects = 0;
      this.emit();
    }, HEALTHY_RESET_MS);
  }

  /** A fatal player error (or a missed first-frame deadline). */
  error(): void {
    // Ignored while a reconnect is already scheduled, or after the play has failed.
    if (this.disposed || this.status === "failed" || this.retryTimer !== undefined) return;
    this.clear("watchdog");
    this.clear("healthy");
    if (!this.started && this.attempt + 1 < this.attempts) {
      this.begin(this.attempt + 1, "fallback");
      return;
    }
    this.scheduleReconnect();
  }

  dispose(): void {
    this.disposed = true;
    this.clear("watchdog");
    this.clear("healthy");
    this.clear("retry");
  }

  private begin(attempt: number, reason: LoadReason): void {
    if (this.disposed) return;
    this.clear("retry");
    this.attempt = attempt;
    this.started = false;
    // A fallback keeps the status it had ("loading", or "reconnecting" during the loop).
    if (reason === "start") this.setStatus("loading");
    this.clear("watchdog");
    if (attempt + 1 < this.attempts) {
      this.watchdog = this.timers.setTimeout(() => {
        this.watchdog = undefined;
        this.error();
      }, FIRST_FRAME_TIMEOUT_MS);
    }
    this.listener.load(attempt, reason);
  }

  private scheduleReconnect(): void {
    if (this.reconnects >= RECONNECT_MAX) {
      this.setStatus("failed");
      return;
    }
    this.setStatus("reconnecting");
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = undefined;
      this.reconnects += 1;
      // Still "reconnecting" on screen until the first frame or the next failure.
      this.emit();
      this.begin(0, "reconnect");
    }, RECONNECT_DELAY_MS);
  }

  private setStatus(status: SupervisorStatus): void {
    this.status = status;
    this.emit();
  }

  private emit(): void {
    if (!this.disposed) this.listener.state(this.state);
  }

  private clear(which: "watchdog" | "healthy" | "retry"): void {
    const handle =
      which === "watchdog" ? this.watchdog : which === "healthy" ? this.healthy : this.retryTimer;
    if (handle !== undefined) this.timers.clearTimeout(handle);
    if (which === "watchdog") this.watchdog = undefined;
    else if (which === "healthy") this.healthy = undefined;
    else this.retryTimer = undefined;
  }
}
