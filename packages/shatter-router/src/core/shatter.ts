import type { DomCapturer } from '../capture/index';
import type { Engine } from '../engine/index';
import { isBrowser } from './env';
import { nextFrame } from './frame';
import type { Snapshot } from './snapshot';
import { readViewport } from './viewport';

export interface ShatterOptions {
  /**
   * Longest time, in milliseconds, the outgoing page may take to capture
   * before the transition gives up and navigates plainly. Default 250.
   */
  captureBudget?: number;
  /** Exposes `window.__SHATTER_TEST__` and extra diagnostics. Default false. */
  debug?: boolean;
  /**
   * Number of shards, or `'auto'` to pick by device tier: 40 (low), 90 (mid),
   * 160 (high). Clamped to [12, 400]. Default `'auto'`.
   */
  shards?: 'auto' | number;
  /** Makes the fracture layout deterministic. Default: random each time. */
  seed?: number;
  /** Glass thickness in CSS pixels, seen on the shards' sides as they tumble. Default 6. */
  thickness?: number;
}

/** A point in viewport (CSS pixel) coordinates. */
export interface Point {
  x: number;
  y: number;
}

export interface TransitionRequest {
  /** Makes the app show the new route (swap the DOM, call the router). */
  commit: () => void | Promise<void>;
  /** Impact point in viewport coordinates. Default: the viewport centre. */
  origin?: Point;
}

/** Why a transition ran without the WebGL effect. */
export type FallbackReason =
  | 'unsupported'
  | 'pinch-zoom'
  | 'capture-budget'
  | 'capture-failed'
  | 'context-lost'
  | 'busy'
  | 'error';

export interface ShatterEventMap {
  /** A transition was requested. */
  start: undefined;
  /** The overlay shows the outgoing page; the live DOM is no longer visible. */
  covered: { captureMs: number };
  /** The page is broken into shards (geometry ready, nothing has moved yet). */
  fractured: { shardCount: number; fractureMs: number };
  /** The app's `commit()` finished. */
  committed: undefined;
  /** The overlay is gone and the new page is live. */
  end: undefined;
  /** The WebGL effect was skipped. Navigation still completes. */
  fallback: { reason: FallbackReason };
  /** Something threw inside the pipeline. Navigation still completes. */
  error: { error: unknown };
}

export type ShatterEventName = keyof ShatterEventMap;
export type ShatterEventHandler<K extends ShatterEventName> = (payload: ShatterEventMap[K]) => void;

export interface Shatter {
  /** Runs a transition around `commit`. Always resolves after `commit` has run. */
  transition(request: TransitionRequest): Promise<void>;
  /** Subscribes to a lifecycle event. Returns a function that unsubscribes. */
  on<K extends ShatterEventName>(event: K, handler: ShatterEventHandler<K>): () => void;
  /** Removes listeners, frees GL resources and loses the context. Idempotent. */
  destroy(): void;
}

/** Phases a test can pause the pipeline at (debug mode only). */
export type PausePoint = 'covered' | 'fractured' | 'cracked';

/** Shape of `window.__SHATTER_TEST__`, available only when `debug` is on. */
export interface ShatterTestHook {
  /** Set to make the next transition stop when it reaches this phase. */
  pauseAt: PausePoint | null;
  /** The phase the pipeline is currently stopped at, if any. */
  paused: PausePoint | null;
  /** Continues a paused transition. */
  resume(): void;
  /** True once the lazy chunks are loaded and the capturer is warm. */
  ready: boolean;
  /** Live GPU textures; 0 between transitions. */
  textureCount(): number;
  /** Duration of the most recent capture in milliseconds, or null. */
  lastCaptureMs: number | null;
  /** Reason of the most recent fallback, or null. */
  lastFallback: FallbackReason | null;
  /** Grid the page copy is laid out on in this engine, once the capturer is loaded. */
  layoutGrid(): 'css' | 'device' | null;
  /** Most recent fracture: shard count, CPU time and the device tier used for `'auto'`. */
  lastFracture: { shardCount: number; fractureMs: number; tier: string } | null;
  /** Draws every cell edge and the impact point on the overlay. */
  wireframe: boolean;
  /** Freezes the crack at `radius` CSS px (with no flash) while paused. */
  setCrack(radius: number): void;
  /**
   * Times the fracture of the current viewport into `shards` pieces, `runs`
   * times, isolated from capture and drawing. Null until the engine is loaded.
   */
  measureFracture(
    shards: number,
    runs: number,
  ): { medianMs: number; p95Ms: number; runs: number } | null;
}

class Fallback extends Error {
  constructor(readonly reason: FallbackReason) {
    super(`Shatter fallback: ${reason}`);
  }
}

const DEFAULT_CAPTURE_BUDGET = 250;
const DEFAULT_THICKNESS = 6;

class ShatterController implements Shatter {
  private readonly handlers = new Map<ShatterEventName, Set<(payload: never) => void>>();
  private readonly captureBudget: number;
  private readonly shards: 'auto' | number;
  private readonly seed: number | undefined;
  private readonly thickness: number;
  private readonly hook: ShatterTestHook | null;
  private engine: Engine | null = null;
  private capturer: DomCapturer | null = null;
  private loading: Promise<void> | null = null;
  private resumePaused: (() => void) | null = null;
  private idleHandle: number | null = null;
  private busy = false;
  private wireframe = false;
  private destroyed = false;

  constructor(options: ShatterOptions) {
    this.captureBudget = options.captureBudget ?? DEFAULT_CAPTURE_BUDGET;
    this.shards = options.shards ?? 'auto';
    this.seed = options.seed;
    this.thickness = options.thickness ?? DEFAULT_THICKNESS;
    this.hook = options.debug && isBrowser() ? this.installHook() : null;
    if (isBrowser()) this.scheduleWarmUp();
  }

  on<K extends ShatterEventName>(event: K, handler: ShatterEventHandler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  async transition(request: TransitionRequest): Promise<void> {
    if (this.destroyed || !isBrowser()) {
      await request.commit();
      return;
    }
    this.emit('start', undefined);
    if (this.busy) {
      this.fallback('busy');
      await request.commit();
      this.emit('committed', undefined);
      this.emit('end', undefined);
      return;
    }

    this.busy = true;
    // An object, so the flag set from inside run() is visible to the catch block's type.
    const progress = { committed: false };
    try {
      await this.run(request, progress);
    } catch (error) {
      this.engine?.release();
      if (error instanceof Fallback) {
        this.fallback(error.reason);
      } else {
        this.fallback('error');
        this.emit('error', { error });
      }
      // A failure inside Shatter must never break routing.
      if (!progress.committed) {
        await request.commit();
        this.emit('committed', undefined);
      }
    } finally {
      this.busy = false;
    }
    this.emit('end', undefined);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.idleHandle !== null && isBrowser()) {
      if (typeof window.cancelIdleCallback === 'function')
        window.cancelIdleCallback(this.idleHandle);
      else window.clearTimeout(this.idleHandle);
    }
    this.idleHandle = null;
    this.resumePaused?.();
    this.resumePaused = null;
    this.engine?.destroy();
    this.engine = null;
    this.capturer?.destroy();
    this.capturer = null;
    this.handlers.clear();
    if (this.hook && isBrowser()) {
      const holder = window as unknown as { __SHATTER_TEST__?: ShatterTestHook };
      if (holder.__SHATTER_TEST__ === this.hook) delete holder.__SHATTER_TEST__;
    }
  }

  private async run(request: TransitionRequest, progress: { committed: boolean }): Promise<void> {
    await this.load();
    const { engine, capturer } = this;
    if (!engine || !capturer) throw new Fallback('unsupported');
    if (engine.contextLost) throw new Fallback('context-lost');

    const viewport = readViewport(window);
    if (viewport.pinchZoomed) throw new Fallback('pinch-zoom');

    const snapshot = await this.captureWithinBudget(capturer, engine, viewport);
    if (this.hook) this.hook.lastCaptureMs = snapshot.duration;
    await engine.cover(snapshot);
    this.emit('covered', { captureMs: snapshot.duration });
    await this.pause('covered');

    // Fracture now, before the router runs, so the geometry work overlaps the
    // time the new route needs to render.
    const origin = request.origin ?? { x: viewport.width / 2, y: viewport.height / 2 };
    const { count, tier } = engine.resolveShardCount(this.shards, snapshot.duration);
    const stats = engine.fracture({
      origin,
      count,
      thickness: this.thickness,
      ...(this.seed === undefined ? {} : { seed: this.seed }),
    });
    if (this.hook) this.hook.lastFracture = { ...stats, tier };
    this.emit('fractured', { shardCount: stats.shardCount, fractureMs: stats.fractureMs });
    await this.pause('fractured');

    await request.commit();
    progress.committed = true;
    this.emit('committed', undefined);

    // Let the new route lay out and paint under the overlay.
    await nextFrame(window);
    await nextFrame(window);

    await engine.crack();
    await this.pause('cracked');
    engine.release();
  }

  private captureWithinBudget(
    capturer: DomCapturer,
    engine: Engine,
    viewport: ReturnType<typeof readViewport>,
  ): Promise<Snapshot> {
    return new Promise<Snapshot>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        settled = true;
        reject(new Fallback('capture-budget'));
      }, this.captureBudget);
      capturer.capture({ viewport, maxTextureSize: engine.maxTextureSize }).then(
        (snapshot) => {
          window.clearTimeout(timer);
          // Too late to use: free it instead of leaking the canvas.
          if (settled) snapshot.dispose();
          else resolve(snapshot);
        },
        (error: unknown) => {
          window.clearTimeout(timer);
          if (settled) return;
          if (this.hook) console.warn('[shatter-router] capture failed', error);
          reject(new Fallback('capture-failed'));
        },
      );
    });
  }

  /** Loads the engine and capture chunks and warms the capturer. Shared by all callers. */
  private load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const [engineModule, captureModule] = await Promise.all([
          import('../engine/index'),
          import('../capture/index'),
        ]);
        if (this.destroyed) return;
        this.engine = engineModule.createEngine(document);
        this.engine.wireframe = this.wireframe;
        this.capturer = captureModule.createCapturer(document);
        await this.capturer.warmUp();
        if (this.hook) this.hook.ready = true;
      } catch (error) {
        // No WebGL2, a blocked chunk, a CSP violation: stay on the fallback path.
        this.engine?.destroy();
        this.engine = null;
        this.capturer?.destroy();
        this.capturer = null;
        if (this.hook) console.warn('[shatter-router] effect unavailable', error);
      }
    })();
    return this.loading;
  }

  /** Prefetches the lazy chunks when the browser is idle so the first click is fast. */
  private scheduleWarmUp(): void {
    const start = (): void => {
      this.idleHandle = null;
      if (!this.destroyed) void this.load();
    };
    if (typeof window.requestIdleCallback === 'function') {
      this.idleHandle = window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      this.idleHandle = window.setTimeout(start, 200);
    }
  }

  private pause(point: PausePoint): Promise<void> {
    const hook = this.hook;
    if (hook?.pauseAt !== point) return Promise.resolve();
    hook.pauseAt = null;
    hook.paused = point;
    return new Promise((resolve) => {
      this.resumePaused = () => {
        hook.paused = null;
        this.resumePaused = null;
        resolve();
      };
    });
  }

  private fallback(reason: FallbackReason): void {
    if (this.hook) this.hook.lastFallback = reason;
    this.emit('fallback', { reason });
  }

  private emit<K extends ShatterEventName>(event: K, payload: ShatterEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as ShatterEventHandler<K>)(payload);
      } catch (error) {
        // A throwing listener must not derail the transition.
        console.error('[shatter-router] event handler threw', error);
      }
    }
  }

  private installHook(): ShatterTestHook {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- accessor properties below need the instance
    const controller = this;
    const hook: ShatterTestHook = {
      pauseAt: null,
      paused: null,
      resume: () => this.resumePaused?.(),
      ready: false,
      textureCount: () => this.engine?.textureCount ?? 0,
      lastCaptureMs: null,
      lastFallback: null,
      layoutGrid: () => this.capturer?.layoutGrid ?? null,
      lastFracture: null,
      get wireframe(): boolean {
        return controller.wireframe;
      },
      set wireframe(value: boolean) {
        controller.wireframe = value;
        const engine = controller.engine;
        if (engine) {
          engine.wireframe = value;
          engine.draw();
        }
      },
      setCrack: (radius: number) => {
        this.engine?.setCrack(radius, 0);
      },
      measureFracture: (shards: number, runs: number) => {
        const engine = this.engine;
        if (!engine) return null;
        const { width, height } = readViewport(window);
        return engine.measureFracture(
          {
            width,
            height,
            origin: { x: width / 2, y: height / 2 },
            count: shards,
            thickness: this.thickness,
          },
          runs,
        );
      },
    };
    (window as unknown as { __SHATTER_TEST__?: ShatterTestHook }).__SHATTER_TEST__ = hook;
    return hook;
  }
}

/** Creates a Shatter instance. Safe to call during SSR; nothing touches the DOM until used. */
export function createShatter(options: ShatterOptions = {}): Shatter {
  return new ShatterController(options);
}
