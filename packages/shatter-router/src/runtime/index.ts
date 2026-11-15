import type { DomCapturer } from '../capture/index';
import type { DebugPanel } from '../debug/index';
import type { Engine } from '../engine/index';
import { announceTitle, focusNewPage } from '../core/a11y';
import { crossfade } from '../core/crossfade';
import type { ShatterEffect } from '../core/effect';
import type { PhysicsBackend, PhysicsPlugin } from '../core/physics';
import { prefersReducedMotion } from '../core/env';
import { DEFAULT_GLASS_TINT, parseHexColor, type Rgb } from '../core/shading';
import { StateMachine, type TransitionState } from '../core/machine';
import { Precapture, PRECAPTURE_TTL_MS } from '../core/precapture';
import { type ScrollTarget, waitUntilReady } from '../core/ready';
import { createScrollLock, type ScrollLock } from '../core/scroll-lock';
import { ShatterFacade, type RuntimeHost, type ShatterRuntime } from '../core/shatter';
import type { Snapshot } from '../core/snapshot';
import type {
  FallbackReason,
  PausePoint,
  Shatter,
  ShatterEventMap,
  ShatterEventName,
  ShatterOptions,
  ShatterTestHook,
  TransitionRequest,
} from '../core/types';
import { readViewport, type ViewportMetrics } from '../core/viewport';

/** The parts of the engine the controller uses (lets tests drive the state machine). */
export type EngineLike = Pick<
  Engine,
  | 'maxTextureSize'
  | 'contextLost'
  | 'textureCount'
  | 'overlayElement'
  | 'wireframe'
  | 'lastLoopStats'
  | 'resolveEffect'
  | 'resolveShardCount'
  | 'cover'
  | 'fracture'
  | 'setIncoming'
  | 'replaceEffect'
  | 'startPhysics'
  | 'setShading'
  | 'prepareMotion'
  | 'crack'
  | 'animate'
  | 'setCrack'
  | 'setMotionTime'
  | 'draw'
  | 'release'
  | 'destroy'
  | 'measureFracture'
  | 'drawStats'
  | 'readPixels'
>;

export type CapturerLike = Pick<DomCapturer, 'capture' | 'warmUp' | 'destroy' | 'layoutGrid'>;

export interface Loaded {
  readonly engine: EngineLike;
  readonly capturer: CapturerLike;
}

/** How the controller gets its engine and capturer. Tests inject fakes. */
export interface ShatterDeps {
  load(doc: Document): Promise<Loaded>;
}

const defaultDeps: ShatterDeps = {
  async load(doc) {
    const [engineModule, captureModule] = await Promise.all([
      import('../engine/index'),
      import('../capture/index'),
    ]);
    const engine = engineModule.createEngine(doc);
    const capturer = captureModule.createCapturer(doc);
    try {
      await capturer.warmUp();
    } catch (error) {
      engine.destroy();
      capturer.destroy();
      throw error;
    }
    return { engine, capturer };
  },
};

class Fallback extends Error {
  constructor(readonly reason: FallbackReason) {
    super(`Shatter fallback: ${reason}`);
  }
}

/** A newer navigation superseded this one before it committed. */
class Cancelled extends Error {}

/** `commit()` itself threw: the app's error, passed on to the caller. */
class CommitError extends Error {
  constructor(readonly original: unknown) {
    super('commit() failed');
  }
}

interface Run {
  readonly request: TransitionRequest;
  /** Aborted when a newer navigation supersedes this one before it commits. */
  readonly cancel: AbortController;
  /** Aborted to fast-forward the effect to its end (skip, interruption, hidden tab). */
  readonly skip: AbortController;
  /** `commit()` has been called (successfully or not). */
  committing: boolean;
  committed: boolean;
  /** Settles when the run is completely over. Never rejects. */
  done: Promise<void>;
}

interface Settings {
  readonly effect: string | ShatterEffect;
  readonly duration: number | undefined;
  readonly shards: 'auto' | number;
  readonly gravity: number;
  readonly impulse: number;
  readonly thickness: number;
  readonly precapture: 'pointerdown' | 'hover' | false;
  readonly captureBudget: number;
  readonly readyTimeout: number;
  readonly reducedMotion: 'crossfade' | 'instant' | 'ignore';
  readonly backForward: 'reverse' | 'same' | 'none';
  readonly physics: PhysicsPlugin | null;
  readonly seed: number | undefined;
  readonly debug: boolean;
  readonly panel: boolean;
}

const DEFAULT_MOTION_MS = 1000;

type DrawStats = Engine['drawStats'];

/** Draw calls per drawn frame between two engine readings (debug panel). */
function perFrame(before: DrawStats, after: DrawStats): number {
  return (after.calls - before.calls) / Math.max(1, after.frames - before.frames);
}

/**
 * `backForward: 'reverse'`: the built-in effect played for a back/forward
 * navigation, by the forward effect's name (documented on `ShatterOptions`).
 * `flip` is its own reverse (it turns the other way with `uDirection = -1`).
 */
const REVERSED: Readonly<Record<string, string>> = {
  shatter: 'assemble',
  explode: 'assemble',
  implode: 'assemble',
  assemble: 'shatter',
};

/** Effect used when an effect's incoming-page capture fails. */
const SUBSTITUTE_EFFECT = 'shatter';

function settingsFrom(options: ShatterOptions): Settings {
  return {
    effect: options.effect ?? 'shatter',
    duration: options.duration,
    shards: options.shards ?? 'auto',
    gravity: options.gravity ?? 2600,
    impulse: options.impulse ?? 900,
    thickness: options.thickness ?? 6,
    precapture: options.precapture ?? 'pointerdown',
    captureBudget: options.captureBudget ?? 250,
    readyTimeout: options.readyTimeout ?? 1500,
    reducedMotion: options.reducedMotion ?? 'crossfade',
    backForward: options.backForward ?? 'reverse',
    physics:
      options.physics === undefined || options.physics === 'procedural' ? null : options.physics,
    seed: options.seed,
    debug: options.debug !== undefined && options.debug !== false,
    panel:
      typeof options.debug === 'object' ? options.debug.panel !== false : options.debug === true,
  };
}

/** Resolves when `signal` aborts (or at once if it already has). */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else
      signal.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      );
  });
}

class Runtime implements ShatterRuntime {
  private readonly settings: Settings;
  private readonly machine: StateMachine;
  private readonly hook: ShatterTestHook | null;
  private readonly scrollLock: ScrollLock | null;
  private loaded: Loaded | null = null;
  /** The loaded physics backend; null for procedural motion (or when it could not load). */
  private physics: PhysicsBackend | null = null;
  private loading: Promise<Loaded | null> | null = null;
  private current: Run | null = null;
  private ticket = 0;
  /** The pre-capture in flight or waiting for its click, if any. */
  private pending: Precapture | null = null;
  private precaptureExpiry = 0;
  private resumePaused: (() => void) | null = null;
  private wireframe = false;
  private destroyed = false;
  private panel: DebugPanel | null = null;
  /** A debug seam check in progress: transitions wait for it. */
  private busy: Promise<unknown> | null = null;

  constructor(
    private readonly host: RuntimeHost,
    private readonly deps: ShatterDeps,
  ) {
    this.settings = settingsFrom(host.options);
    this.machine = new StateMachine(() => performance.now());
    this.hook = this.settings.debug ? this.installHook() : null;
    if (this.hook && this.settings.panel) this.openPanel(this.hook);
    this.scrollLock = createScrollLock(window, host.options.scrollLock);
  }

  warmUp(): void {
    void this.load();
  }

  precapture(): void {
    this.startPrecapture();
  }

  get state(): TransitionState {
    return this.machine.state;
  }

  async transition(request: TransitionRequest): Promise<void> {
    if (this.destroyed) {
      await request.commit();
      return;
    }
    if (this.busy) await this.busy;
    const ticket = ++this.ticket;
    const previous = this.current;
    if (previous) {
      // Interruption rules (master prompt, section 4): before the commit the
      // old navigation is dropped; after it, the old effect fast-forwards
      // within one frame and reveals, then this one starts.
      if (previous.committing) previous.skip.abort();
      else previous.cancel.abort();
      await previous.done;
      if (ticket !== this.ticket) return; // an even newer navigation won
      if (this.isDestroyed()) {
        await request.commit();
        return;
      }
    }

    const run: Run = {
      request,
      cancel: new AbortController(),
      skip: new AbortController(),
      committing: false,
      committed: false,
      done: Promise.resolve(),
    };
    this.current = run;
    const outcome = this.execute(run);
    run.done = outcome.then(() => undefined);
    const error = await outcome;
    if (error !== undefined) throw error instanceof CommitError ? error.original : error;
  }

  /** A method, so a check after an await is not narrowed away. */
  private isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const run = this.current;
    if (run) {
      run.cancel.abort();
      run.skip.abort();
    }
    this.dropPrecapture();
    this.resumePaused?.();
    this.resumePaused = null;
    this.scrollLock?.unlock();
    this.loaded?.engine.destroy();
    this.loaded?.capturer.destroy();
    this.loaded = null;
    this.panel?.destroy();
    this.panel = null;
    if (this.hook) {
      const holder = window as unknown as { __SHATTER_TEST__?: ShatterTestHook };
      if (holder.__SHATTER_TEST__ === this.hook) delete holder.__SHATTER_TEST__;
    }
  }

  /** Runs one transition. Resolves with the app's commit error, if any. */
  private async execute(run: Run): Promise<unknown> {
    const { settings, machine } = this;
    const { request } = run;
    let engine: EngineLike | null = null;
    let removeSkipListeners: (() => void) | null = null;
    this.emit('start', undefined);
    try {
      if (document.visibilityState === 'hidden') throw new Fallback('hidden');
      if (settings.reducedMotion !== 'ignore' && prefersReducedMotion()) {
        throw new Fallback('reduced-motion');
      }
      if (request.direction === 'back' && settings.backForward === 'none') {
        throw new Fallback('disabled');
      }
      machine.enter('capturing');
      this.scrollLock?.lock();

      const loaded = await this.load();
      this.throwIfCancelled(run);
      if (!loaded) throw new Fallback('unsupported');
      engine = loaded.engine;
      if (engine.contextLost) throw new Fallback('context-lost');
      const viewport = readViewport(window);
      if (viewport.pinchZoomed) throw new Fallback('pinch-zoom');
      const effect = engine.resolveEffect(this.effectFor(request), this.host.effects);

      const { snapshot, precaptured } = await this.snapshotFor(run, loaded, viewport);
      if (this.hook) {
        this.hook.lastCaptureMs = snapshot.duration;
        this.hook.lastPrecaptured = precaptured;
      }
      machine.enter('covering');
      await engine.cover(snapshot);
      this.throwIfCancelled(run);
      this.emit('covered', { captureMs: snapshot.duration, precaptured });
      await this.pause('covered', run);

      // Fracture before the router runs so the geometry work overlaps the
      // time the new route needs to render.
      const origin = request.origin ?? { x: viewport.width / 2, y: viewport.height / 2 };
      const { count, tier } = engine.resolveShardCount(settings.shards, snapshot.duration);
      const seed = settings.seed;
      const stats = engine.fracture({
        effect,
        origin,
        count,
        thickness: settings.thickness,
        ...(seed === undefined ? {} : { seed }),
      });
      if (this.hook) this.hook.lastFracture = { ...stats, tier };
      this.emit('fractured', { shardCount: stats.shardCount, fractureMs: stats.fractureMs });
      await this.pause('fractured', run);
      this.throwIfCancelled(run);

      machine.enter('committing');
      await this.commit(run);
      this.emit('committed', undefined);

      machine.enter('waiting');
      removeSkipListeners = this.listenForSkip(run, engine);
      const direction = request.direction ?? 'forward';
      const scroll: ScrollTarget = request.scroll ?? (direction === 'back' ? 'none' : 'top');
      await waitUntilReady(document, scroll, settings.readyTimeout, run.skip.signal);

      // Effects that end on the new page need a picture of it (master prompt 4.7):
      // captured under the overlay; without one, a substitute effect plays.
      let motionEffect = effect;
      if (effect.needsIncomingSnapshot && !run.skip.signal.aborted) {
        const incoming = await this.captureIncoming(run, loaded);
        if (incoming) {
          engine.setIncoming(incoming);
        } else {
          motionEffect = engine.resolveEffect(SUBSTITUTE_EFFECT, this.host.effects);
          engine.replaceEffect(motionEffect);
        }
      }
      if (this.hook) this.hook.lastEffect = motionEffect.name;

      engine.prepareMotion({
        duration: settings.duration ?? motionEffect.duration ?? DEFAULT_MOTION_MS,
        gravity: settings.gravity,
        impulse: settings.impulse,
        direction,
        ...(seed === undefined ? {} : { seed }),
      });
      // Physics drives the falling effects when a backend is loaded; anything
      // else (or no backend) keeps the procedural motion.
      const physical = this.physics !== null && engine.startPhysics(this.physics);
      if (this.hook) {
        this.hook.lastPhysics = physical && settings.physics ? settings.physics.name : 'procedural';
      }
      machine.enter('animating');
      this.emit('animating', { effect: motionEffect.name });
      if (motionEffect.crack) {
        await engine.crack({ signal: run.skip.signal });
        await this.pause('cracked', run);
      }
      await this.pause('animating', run);
      const before = engine.drawStats;
      const loop = await engine.animate({ signal: run.skip.signal });
      if (this.hook) {
        this.hook.lastAnimation = {
          ...loop,
          fps: loop.durationMs > 0 ? ((loop.frames - 1) * 1000) / loop.durationMs : 0,
          drawCallsPerFrame: perFrame(before, engine.drawStats),
        };
      }

      await this.pause('settled', run);

      machine.enter('revealing');
      engine.release();
      this.finish(false);
      return undefined;
    } catch (error) {
      engine?.release();
      if (error instanceof Cancelled) {
        this.scrollLock?.unlock();
        this.forceState('idle');
        return undefined;
      }
      if (error instanceof CommitError) {
        // The app's own navigation failed: nothing to fall back to.
        this.forceState('fallback');
        this.scrollLock?.unlock();
        this.forceState('idle');
        return error;
      }
      const reason = error instanceof Fallback ? error.reason : 'error';
      this.forceState('fallback');
      if (this.hook) this.hook.lastFallback = reason;
      this.emit('fallback', { reason });
      if (!(error instanceof Fallback)) {
        if (this.settings.debug) console.warn('[shatter-router] transition failed', error);
        this.emit('error', { error });
      }
      if (!run.committing) {
        try {
          await this.fallbackCommit(run, reason);
        } catch (commitError) {
          this.scrollLock?.unlock();
          this.forceState('idle');
          return commitError instanceof CommitError ? commitError : new CommitError(commitError);
        }
        this.emit('committed', undefined);
      }
      this.finish(true);
      return undefined;
    } finally {
      removeSkipListeners?.();
      if (this.current === run) this.current = null;
    }
  }

  private async commit(run: Run): Promise<void> {
    run.committing = true;
    try {
      await run.request.commit();
    } catch (error) {
      throw new CommitError(error);
    }
    run.committed = true;
  }

  /** The fallback chain after the effect: View Transition crossfade, else an instant swap. */
  private async fallbackCommit(run: Run, reason: FallbackReason): Promise<void> {
    const instant =
      reason === 'hidden' ||
      reason === 'disabled' ||
      (reason === 'reduced-motion' && this.settings.reducedMotion === 'instant');
    if (instant) {
      await this.commit(run);
      return;
    }
    run.committing = true;
    await crossfade(document, async () => {
      try {
        await run.request.commit();
      } catch (error) {
        throw new CommitError(error);
      }
    });
    run.committed = true;
  }

  /** After the new page is live: release input, move focus, announce, go idle. */
  private finish(fallback: boolean): void {
    this.scrollLock?.unlock();
    focusNewPage(document);
    announceTitle(document);
    this.emit('end', { fallback });
    this.forceState('idle');
  }

  /** Moves the machine, taking the fallback route if the table forbids the direct move. */
  private forceState(next: TransitionState): void {
    const { machine } = this;
    if (machine.state === next) return;
    if (machine.canEnter(next)) machine.enter(next);
    else if (next === 'idle' && machine.canEnter('fallback')) {
      machine.enter('fallback');
      machine.enter('idle');
    } else if (next === 'fallback' && machine.state === 'idle') machine.enter('fallback');
  }

  private throwIfCancelled(run: Run): void {
    if (run.cancel.signal.aborted) throw new Cancelled();
  }

  /**
   * The effect to play: the request's or the default, mapped for back/forward
   * navigations when `backForward` is `'reverse'`. User-registered effects
   * (and effect objects) are never mapped.
   */
  private effectFor(request: TransitionRequest): string | ShatterEffect {
    const chosen = request.effect ?? this.settings.effect;
    if (request.direction !== 'back' || this.settings.backForward !== 'reverse') return chosen;
    if (typeof chosen !== 'string' || this.host.effects.has(chosen)) return chosen;
    return REVERSED[chosen] ?? chosen;
  }

  /**
   * Captures the new page under the overlay, within the capture budget.
   * Null when it fails or takes too long: the caller substitutes an effect.
   */
  private async captureIncoming(run: Run, loaded: Loaded): Promise<Snapshot | null> {
    const started = performance.now();
    try {
      const snapshot = await this.withinBudget(
        loaded.capturer.capture({
          viewport: readViewport(window),
          maxTextureSize: loaded.engine.maxTextureSize,
        }),
        this.settings.captureBudget,
        run,
      );
      if (this.hook) this.hook.lastIncomingCaptureMs = performance.now() - started;
      return snapshot;
    } catch (error) {
      if (this.settings.debug) console.warn('[shatter-router] incoming capture failed', error);
      return null;
    }
  }

  /** Uses a still-valid pre-capture if there is one; otherwise captures now. */
  private async snapshotFor(
    run: Run,
    loaded: Loaded,
    viewport: ViewportMetrics,
  ): Promise<{ snapshot: Snapshot; precaptured: boolean }> {
    const pre = this.pending;
    this.pending = null;
    window.clearTimeout(this.precaptureExpiry);
    if (pre && pre.age < PRECAPTURE_TTL_MS) {
      const remaining = this.settings.captureBudget - pre.age;
      const snapshot = await this.withinBudget(pre.result, remaining, run, () => {
        pre.abandon();
      });
      pre.claim();
      if (snapshot && snapshot.duration > this.settings.captureBudget) {
        // Finished before the click, but the capture itself was over budget:
        // the page is too heavy to capture reliably, so behave as without pre-capture.
        snapshot.dispose();
        throw new Fallback('capture-budget');
      }
      if (snapshot && pre.isValid(readViewport(window))) return { snapshot, precaptured: true };
      snapshot?.dispose();
    } else {
      pre?.abandon();
    }
    const capture = loaded.capturer.capture({
      viewport,
      maxTextureSize: loaded.engine.maxTextureSize,
    });
    const snapshot = await this.withinBudget(
      capture.catch((error: unknown) => {
        if (this.settings.debug) console.warn('[shatter-router] capture failed', error);
        throw new Fallback('capture-failed');
      }),
      this.settings.captureBudget,
      run,
    );
    if (!snapshot) throw new Fallback('capture-failed');
    return { snapshot, precaptured: false };
  }

  /**
   * Waits for a capture, but no longer than `budget` ms and no longer than the
   * run stays wanted. A snapshot that arrives too late is freed.
   */
  private withinBudget(
    pending: Promise<Snapshot | null>,
    budget: number,
    run: Run,
    onGiveUp?: () => void,
  ): Promise<Snapshot | null> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const giveUp = (error: Error): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        onGiveUp?.();
        reject(error);
      };
      const timer = window.setTimeout(
        () => {
          giveUp(new Fallback('capture-budget'));
        },
        Math.max(0, budget),
      );
      void aborted(run.cancel.signal).then(() => {
        giveUp(new Cancelled());
      });
      pending.then(
        (snapshot) => {
          if (settled) {
            snapshot?.dispose();
            return;
          }
          settled = true;
          window.clearTimeout(timer);
          resolve(snapshot);
        },
        (error: unknown) => {
          giveUp(error instanceof Error ? error : new Fallback('capture-failed'));
        },
      );
    });
  }

  /** Escape, a click on the overlay, or the tab being hidden skip to the end. */
  private listenForSkip(run: Run, engine: EngineLike): () => void {
    const skip = (): void => {
      run.skip.abort();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') skip();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') skip();
    };
    const overlay = engine.overlayElement;
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    overlay.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      overlay.removeEventListener('pointerdown', skip);
    };
  }

  private startPrecapture(): void {
    if (this.current || this.destroyed) return;
    if (this.pending && this.pending.age < 300) return;
    this.dropPrecapture();
    void this.load().then((loaded) => {
      if (!loaded || this.current || this.destroyed || this.pending) return;
      if (document.visibilityState === 'hidden') return;
      if (this.settings.reducedMotion !== 'ignore' && prefersReducedMotion()) return;
      if (loaded.engine.contextLost) return;
      const viewport = readViewport(window);
      if (viewport.pinchZoomed) return;
      const pre = new Precapture(window, viewport, () =>
        loaded.capturer.capture({ viewport, maxTextureSize: loaded.engine.maxTextureSize }),
      );
      this.pending = pre;
      this.precaptureExpiry = window.setTimeout(() => {
        if (this.pending === pre) this.dropPrecapture();
      }, PRECAPTURE_TTL_MS);
    });
  }

  private dropPrecapture(): void {
    window.clearTimeout(this.precaptureExpiry);
    this.pending?.abandon();
    this.pending = null;
  }

  /** Loads the engine and capture chunks once. Null when the effect is unavailable. */
  private load(): Promise<Loaded | null> {
    this.loading ??= Promise.all([this.deps.load(document), this.loadPhysics()]).then(
      ([loaded]) => {
        if (this.destroyed) {
          loaded.engine.destroy();
          loaded.capturer.destroy();
          return null;
        }
        loaded.engine.wireframe = this.wireframe;
        loaded.engine.setShading({
          tint: this.glassTint(),
          chromatic: this.host.options.chromatic ?? true,
        });
        this.loaded = loaded;
        if (this.hook) this.hook.ready = true;
        return loaded;
      },
      (error: unknown) => {
        // No WebGL2, a blocked chunk, a CSP violation: stay on the fallback path.
        if (this.settings.debug) console.warn('[shatter-router] effect unavailable', error);
        return null;
      },
    );
    return this.loading;
  }

  /** The `glassTint` option as channels; the default when it is not a `#rgb`/`#rrggbb` colour. */
  private glassTint(): Rgb {
    const option = this.host.options.glassTint;
    const parsed = option === undefined ? null : parseHexColor(option);
    if (option !== undefined && !parsed && this.settings.debug) {
      console.warn(
        `[shatter-router] glassTint "${option}" is not #rgb or #rrggbb; using ${DEFAULT_GLASS_TINT}`,
      );
    }
    return parsed ?? parseHexColor(DEFAULT_GLASS_TINT) ?? [0.812, 0.91, 1];
  }

  /**
   * Loads the physics plugin alongside the engine. Never rejects: without it
   * (offline, a CSP without 'wasm-unsafe-eval') the motion stays procedural.
   */
  private async loadPhysics(): Promise<void> {
    const plugin = this.settings.physics;
    if (!plugin) return;
    try {
      this.physics = await plugin.load();
    } catch (error) {
      if (this.settings.debug) {
        console.warn(`[shatter-router] physics "${plugin.name}" unavailable`, error);
      }
    }
  }

  /** Debug pause point; a cancel or skip also releases it. */
  private pause(point: PausePoint, run: Run): Promise<void> {
    const hook = this.hook;
    if (hook?.pauseAt !== point) return Promise.resolve();
    hook.pauseAt = null;
    hook.paused = point;
    return new Promise((resolve) => {
      const release = (): void => {
        hook.paused = null;
        this.resumePaused = null;
        resolve();
      };
      this.resumePaused = release;
      void Promise.race([aborted(run.cancel.signal), aborted(run.skip.signal)]).then(release);
    });
  }

  private emit<K extends ShatterEventName>(event: K, payload: ShatterEventMap[K]): void {
    this.host.emit(event, payload);
    this.panel?.update(event);
  }

  /** Loads the debug panel chunk (debug mode only, ADR-041). */
  private openPanel(hook: ShatterTestHook): void {
    import('../debug/index')
      .then(({ createDebugPanel }) => {
        if (this.destroyed) return;
        this.panel = createDebugPanel({
          hook,
          exclusive: (work) => this.exclusive(work),
          shards: this.settings.shards,
          thickness: this.settings.thickness,
          seed: this.settings.seed,
        });
      })
      .catch((error: unknown) => {
        console.warn('[shatter-router] debug panel failed to load', error);
      });
  }

  /** Runs debug work on the engine while no transition runs; transitions wait for it. */
  private async exclusive<T>(work: (loaded: Loaded) => Promise<T>): Promise<T> {
    if (this.busy || this.current || this.machine.state !== 'idle') {
      throw new Error('a transition is running');
    }
    const task = this.load().then((loaded) => {
      if (!loaded) throw new Error('WebGL2 or capture is unavailable');
      return work(loaded);
    });
    this.busy = task.catch(() => undefined);
    try {
      return await task;
    } finally {
      this.busy = null;
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
      state: () => this.machine.state,
      timings: () => this.machine.phaseTimings,
      textureCount: () => this.loaded?.engine.textureCount ?? 0,
      lastCaptureMs: null,
      lastPrecaptured: false,
      lastFallback: null,
      lastEffect: null,
      lastPhysics: null,
      lastIncomingCaptureMs: null,
      layoutGrid: () => this.loaded?.capturer.layoutGrid ?? null,
      lastFracture: null,
      lastAnimation: null,
      get wireframe(): boolean {
        return controller.wireframe;
      },
      set wireframe(value: boolean) {
        controller.wireframe = value;
        const engine = controller.loaded?.engine;
        if (engine) {
          engine.wireframe = value;
          engine.draw();
        }
      },
      setCrack: (radius: number) => {
        this.loaded?.engine.setCrack(radius, 0);
      },
      setMotionTime: (ms: number) => {
        this.loaded?.engine.setMotionTime(ms);
      },
      measureFracture: (shards: number, runs: number) => {
        const engine = this.loaded?.engine;
        if (!engine) return null;
        const { width, height } = readViewport(window);
        return engine.measureFracture(
          {
            width,
            height,
            origin: { x: width / 2, y: height / 2 },
            count: shards,
            thickness: this.settings.thickness,
          },
          runs,
        );
      },
    };
    (window as unknown as { __SHATTER_TEST__?: ShatterTestHook }).__SHATTER_TEST__ = hook;
    return hook;
  }
}

/** Entry point of the lazily loaded runtime chunk. */
export function createRuntime(host: RuntimeHost, deps: ShatterDeps = defaultDeps): ShatterRuntime {
  return new Runtime(host, deps);
}

/** Internal: a Shatter instance with injected engine/capturer (unit tests). */
export function createShatterWith(options: ShatterOptions, deps: ShatterDeps): Shatter {
  return new ShatterFacade(options, () =>
    Promise.resolve({ createRuntime: (host: RuntimeHost) => createRuntime(host, deps) }),
  );
}
