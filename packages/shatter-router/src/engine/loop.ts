/** Longest gap between steps before a timer steps instead of the next animation frame. */
const WATCHDOG_MS = 200;

export interface LoopStats {
  /** Frames drawn. */
  readonly frames: number;
  /** Wall time of the run, ms. */
  readonly durationMs: number;
  /** Longest gap between two frames, ms. */
  readonly worstFrameMs: number;
}

/**
 * Runs `step(now)` once per animation frame until it returns true.
 *
 * Allocation-free per frame: the tick callbacks are bound once, and the only
 * per-frame work besides `step` is scheduling the next frame. A watchdog timer
 * keeps the loop going when the browser stops producing frames (a hidden tab,
 * an unpainted pane) so a transition can never hang; steps are time-based, so
 * they simply jump ahead.
 */
export class FrameLoop {
  private step: ((now: number) => boolean) | null = null;
  private resolve: (() => void) | null = null;
  private reject: ((error: unknown) => void) | null = null;
  private frameId = 0;
  private timerId = 0;
  private started = 0;
  private last = 0;
  private frames = 0;
  private worst = 0;

  constructor(private readonly win: Window) {}

  /** Stats of the most recent completed run. */
  lastStats: LoopStats = { frames: 0, durationMs: 0, worstFrameMs: 0 };

  get running(): boolean {
    return this.step !== null;
  }

  run(step: (now: number) => boolean): Promise<void> {
    this.stop();
    this.step = step;
    this.started = this.win.performance.now();
    this.last = this.started;
    this.frames = 0;
    this.worst = 0;
    const done = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.tick(this.started);
    return done;
  }

  /** Ends the current run (its promise resolves). Safe to call when idle. */
  stop(): void {
    if (this.frameId) this.win.cancelAnimationFrame(this.frameId);
    if (this.timerId) this.win.clearTimeout(this.timerId);
    this.frameId = 0;
    this.timerId = 0;
    if (this.step) {
      this.lastStats = {
        frames: this.frames,
        durationMs: this.last - this.started,
        worstFrameMs: this.worst,
      };
    }
    this.step = null;
    const resolve = this.resolve;
    this.resolve = null;
    this.reject = null;
    resolve?.();
  }

  private readonly onFrame = (now: number): void => {
    this.frameId = 0;
    this.tick(now);
  };

  private readonly onTimer = (): void => {
    this.timerId = 0;
    this.tick(this.win.performance.now());
  };

  private tick(now: number): void {
    if (this.frameId) this.win.cancelAnimationFrame(this.frameId);
    if (this.timerId) this.win.clearTimeout(this.timerId);
    this.frameId = 0;
    this.timerId = 0;
    const step = this.step;
    if (!step) return;
    // rAF timestamps can trail performance.now(); never go backwards.
    const time = Math.max(now, this.last);
    if (this.frames > 0) this.worst = Math.max(this.worst, time - this.last);
    this.last = time;
    this.frames += 1;
    let done: boolean;
    try {
      done = step(time);
    } catch (error) {
      // Surface the error through the run's promise, not as an uncaught frame callback error.
      const reject = this.reject;
      this.resolve = null;
      this.stop();
      reject?.(error);
      return;
    }
    if (done) {
      this.stop();
      return;
    }
    this.frameId = this.win.requestAnimationFrame(this.onFrame);
    this.timerId = this.win.setTimeout(this.onTimer, WATCHDOG_MS);
  }
}
