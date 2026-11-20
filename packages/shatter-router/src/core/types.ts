import type { ShatterEffect } from './effect';
import type { PhysicsPlugin } from './physics';
import type { PhaseTimings, TransitionState } from './machine';
import type { ScrollTarget } from './ready';
import type { ScrollLock } from './scroll-lock';

export interface ShatterOptions {
  /** Effect name or effect object. Default `'shatter'`. */
  effect?: string | ShatterEffect;
  /** Motion phase length in ms (excluding the crack). Default: the effect's own, else 1000. */
  duration?: number;
  /**
   * Number of shards, or `'auto'` to pick by device tier: 40 (low), 90 (mid),
   * 160 (high). Clamped to [12, 400]. Default `'auto'`.
   */
  shards?: 'auto' | number;
  /** Gravity in px/s², positive is down. Default 2600. */
  gravity?: number;
  /** Launch speed in px/s. Default 900. */
  impulse?: number;
  /** Glass thickness in CSS pixels, seen on the shards' sides as they tumble. Default 6. */
  thickness?: number;
  /** Colour of the glass' cut edges (`#rgb` or `#rrggbb`), mixed in at 12 %. Default `'#cfe8ff'`. */
  glassTint?: string;
  /** Colour fringing along fast shards' motion, up to 1.5 px. Default true. */
  chromatic?: boolean;
  /**
   * How falling shards move (`shatter`, `explode`): `'procedural'` (default,
   * closed-form in the vertex shader, no download) or a physics plugin, e.g.
   * `rapier({ floor: true })` from `shatter-router/rapier` (loaded lazily;
   * if it cannot load, the procedural motion is used).
   */
  physics?: 'procedural' | PhysicsPlugin;
  /**
   * Start capturing before the click, to hide capture latency:
   * `'pointerdown'` (default) on pressing a link, `'hover'` after a 120 ms
   * dwell on a link, `false` to capture on click.
   */
  precapture?: 'pointerdown' | 'hover' | false;
  /** Longest capture time in ms before falling back to a plain navigation. Default 250. */
  captureBudget?: number;
  /** Longest wait in ms for the new route (fonts, images) before animating anyway. Default 1500. */
  readyTimeout?: number;
  /**
   * With `prefers-reduced-motion: reduce`: `'crossfade'` (default, a ≤ 200 ms
   * View Transition crossfade, or an instant swap), `'instant'`, or `'ignore'`
   * (play the full effect; for demos only, discouraged).
   */
  reducedMotion?: 'crossfade' | 'instant' | 'ignore';
  /**
   * Effect for back/forward navigations (`direction: 'back'`):
   * - `'mirror'` (default, ADR-047): Shatter remembers, per tab, which effect
   *   and impact point brought the user to each page. Back plays the time
   *   reverse of the effect that brought them to the page they leave (the
   *   pieces of the earlier page fly back the way they left), from the same
   *   point; Forward replays the effect. `flip` turns the other way,
   *   `assemble` reverses as `shatter`; custom effects that end on the new
   *   page run with `uDirection = -1`. Without a memory, the reverse of the
   *   default effect;
   * - `'reverse'`: the visual reverse where one exists: `shatter`,
   *   `explode` and `implode` become `assemble` (the new page flies together),
   *   `assemble` becomes `shatter`, `flip` turns the other way; custom effects
   *   play as they are, with `uDirection = -1`;
   * - `'same'`: the same effect as forward (with `uDirection = -1`);
   * - `'none'`: no effect, the page swaps instantly (fallback reason `'disabled'`).
   */
  backForward?: 'mirror' | 'reverse' | 'same' | 'none';
  /** Makes fracture layouts and motion deterministic. Default: random each time. */
  seed?: number;
  /**
   * Debug mode: exposes `window.__SHATTER_TEST__`, logs diagnostics and shows
   * the debug panel (timings, shard count, FPS, draw calls, wireframe toggle,
   * seam check). `{ panel: false }` keeps everything but the panel. Default false.
   */
  debug?: boolean | ShatterDebugOptions;
  /** Custom scroll lock for smooth-scroll libraries (Lenis etc.), used alongside the built-in one. */
  scrollLock?: ScrollLock;
}

/** Debug mode with options (`debug: true` is `{ panel: true }`). */
export interface ShatterDebugOptions {
  /** Shows the debug panel (a lazy chunk). Default true. */
  panel?: boolean;
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
  /** Per-call effect override. */
  effect?: string | ShatterEffect;
  /** Replace the current history entry instead of adding one (navigation memory, ADR-047). */
  replace?: boolean;
  /** Navigation direction. Default `'forward'`. */
  direction?: 'forward' | 'back';
  /**
   * Where to scroll the new page while it is hidden: `'top'` (default for
   * forward), `'none'` (default for back: the router restores it), or a position.
   */
  scroll?: ScrollTarget;
}

/** Why a transition ran without the WebGL effect. */
export type FallbackReason =
  | 'unsupported'
  | 'reduced-motion'
  | 'hidden'
  | 'pinch-zoom'
  | 'capture-budget'
  | 'capture-failed'
  | 'context-lost'
  | 'disabled'
  | 'error';

export interface ShatterEventMap {
  /** A transition was requested. */
  start: undefined;
  /** The overlay shows the outgoing page; the live DOM is no longer visible. */
  covered: { captureMs: number; precaptured: boolean };
  /** The page is broken into shards (geometry ready, nothing has moved yet). */
  fractured: { shardCount: number; fractureMs: number };
  /** The app's `commit()` finished. */
  committed: undefined;
  /** The new route is ready under the overlay; the effect starts. */
  animating: { effect: string };
  /** The overlay is gone and the new page is live (also after a fallback). */
  end: { fallback: boolean };
  /** The WebGL effect was skipped. Navigation still completes. */
  fallback: { reason: FallbackReason };
  /** Something threw inside the pipeline. Navigation still completes. */
  error: { error: unknown };
}

export type ShatterEventName = keyof ShatterEventMap;
export type ShatterEventHandler<K extends ShatterEventName> = (payload: ShatterEventMap[K]) => void;

export interface Shatter {
  /**
   * Runs a transition around `commit`. Resolves once the new page is live, or
   * at once without committing if a newer transition superseded this one
   * before it committed. Errors thrown by `commit` are passed on.
   */
  transition(request: TransitionRequest): Promise<void>;
  /** Subscribes to a lifecycle event. Returns a function that unsubscribes. */
  on<K extends ShatterEventName>(event: K, handler: ShatterEventHandler<K>): () => void;
  /** Makes a custom effect available by name. */
  registerEffect(effect: ShatterEffect): void;
  /** The current state of the transition state machine. */
  readonly state: TransitionState;
  /** Removes listeners, frees GL resources and loses the context. Idempotent. */
  destroy(): void;
}

/**
 * Phases a test can pause the pipeline at (debug mode only). `'settled'`: the
 * motion has ended and the overlay still shows its last frame (for effects that
 * end on the incoming page, that frame must equal the live page underneath).
 */
export type PausePoint = 'covered' | 'fractured' | 'cracked' | 'animating' | 'settled';

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
  /** Current state of the state machine. */
  state(): TransitionState;
  /** Phase durations of the latest transition, ms. */
  timings(): PhaseTimings;
  /** Live GPU textures; 0 between transitions. */
  textureCount(): number;
  /** Duration of the most recent capture in milliseconds, or null. */
  lastCaptureMs: number | null;
  /** Whether the most recent transition used a pre-captured snapshot. */
  lastPrecaptured: boolean;
  /** Reason of the most recent fallback, or null. */
  lastFallback: FallbackReason | null;
  /** Effect the most recent transition played, after back/forward mapping and any substitution. */
  lastEffect: string | null;
  /** Motion of the most recent transition: 'procedural' or the physics plugin's name. */
  lastPhysics: string | null;
  /** Duration of the most recent capture of the incoming page in ms, or null. */
  lastIncomingCaptureMs: number | null;
  /** Grid the page copy is laid out on in this engine, once the capturer is loaded. */
  layoutGrid(): 'css' | 'device' | null;
  /** Most recent fracture: shard count, CPU time and the device tier used for `'auto'`. */
  lastFracture: { shardCount: number; fractureMs: number; tier: string } | null;
  /** Frames of the most recent motion phase, and the GL draw calls per drawn frame. */
  lastAnimation: {
    frames: number;
    durationMs: number;
    worstFrameMs: number;
    fps: number;
    /** GL draw calls per drawn frame (1 by design). */
    drawCallsPerFrame: number;
  } | null;
  /** Draws every cell edge and the impact point on the overlay. */
  wireframe: boolean;
  /** Freezes the crack at `radius` CSS px (with no flash) while paused. */
  setCrack(radius: number): void;
  /** While paused at `animating`: draws the motion frozen at `ms` into the motion phase. */
  setMotionTime(ms: number): void;
  /**
   * Times the fracture of the current viewport into `shards` pieces, `runs`
   * times, isolated from capture and drawing. Null until the engine is loaded.
   */
  measureFracture(
    shards: number,
    runs: number,
  ): { medianMs: number; p95Ms: number; runs: number } | null;
}
