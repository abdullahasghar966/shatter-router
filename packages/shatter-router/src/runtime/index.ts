import type { DomCapturer } from '../capture/index';
import type { DebugPanel } from '../debug/index';
import type { SoundCue } from '../sound/index';
import { DEFAULT_INTENSITY } from '../core/interaction';
import type { Engine } from '../engine/index';
import { announceTitle, focusNewPage } from '../core/a11y';
import { crossfade } from '../core/crossfade';
import { type EffectSource, effectName, isComposition } from '../core/compose';
import type { EffectComposition, ShatterEffect } from '../core/effect';
import type { PhysicsBackend, PhysicsPlugin } from '../core/physics';
import { prefersReducedMotion } from '../core/env';
import { parseHexColor, type Rgb } from '../core/shading';
import { StateMachine, type TransitionState } from '../core/machine';
import { Precapture, PRECAPTURE_TTL_MS } from '../core/precapture';
import { type ScrollTarget, waitUntilReady } from '../core/ready';
import { createScrollLock, type ScrollLock } from '../core/scroll-lock';
import { ShatterFacade, type RuntimeHost, type ShatterRuntime } from '../core/shatter';
import type { Snapshot } from '../core/snapshot';
import type {
  FallbackReason,
  PausePoint,
  Point,
  Shatter,
  ShatterEventMap,
  ShatterEventName,
  ShatterOptions,
  ShatterTestHook,
  TransitionRequest,
} from '../core/types';
import { readViewport, type ViewportMetrics } from '../core/viewport';
import { HistoryMemory, locationKey } from './history';

/** The parts of the engine the controller uses (lets tests drive the state machine). */
export type EngineLike = Pick<
  Engine,
  | 'maxTextureSize'
  | 'contextLost'
  | 'textureCount'
  | 'overlayElement'
  | 'wireframe'
  | 'lastLoopStats'
  | 'loadEffect'
  | 'preloadEffect'
  | 'resolveShardCount'
  | 'cover'
  | 'fracture'
  | 'setIncoming'
  | 'replaceEffect'
  | 'startPhysics'
  | 'setShading'
  | 'setMaterial'
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
/** The sound engine as the runtime uses it (ADR-060). */
export interface SoundLike {
  resume(): void;
  play(cue: SoundCue): void;
  destroy(): void;
}

export interface ShatterDeps {
  load(doc: Document): Promise<Loaded>;
  /** Creates the sound engine (lazy chunk); tests pass a fake. */
  loadSound?(win: Window, volume: number): Promise<SoundLike>;
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
  async loadSound(win, volume) {
    const module = await import('../sound/index');
    return module.createSoundEngine(win, volume);
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
  /** The effect, impact point and motion direction, decided when the run starts. */
  readonly plan: Plan;
}

/** What a transition plays (ADR-047). */
interface Plan {
  readonly effect: EffectSource;
  readonly origin: Point | undefined;
  /** How hard the page is hit, 0..1 (ADR-060). */
  readonly intensity: number;
  /** A tear: the points the page breaks along (ADR-060). */
  readonly path: readonly Point[] | undefined;
  /** `uDirection`: a reversed effect runs forward in reverse time. */
  readonly direction: 'forward' | 'back';
}

interface Settings {
  readonly effect: EffectSource;
  readonly duration: number | undefined;
  readonly shards: 'auto' | number;
  readonly gravity: number;
  readonly impulse: number;
  readonly thickness: number;
  readonly precapture: 'pointerdown' | 'hover' | false;
  readonly captureBudget: number;
  readonly readyTimeout: number;
  readonly reducedMotion: 'crossfade' | 'instant' | 'ignore';
  readonly backForward: 'mirror' | 'reverse' | 'same' | 'none';
  readonly physics: PhysicsPlugin | null;
  readonly seed: number | undefined;
  readonly debug: boolean;
  readonly panel: boolean;
}

const DEFAULT_MOTION_MS = 1000;

/** `sessionStorage`, or null where it is blocked (sandboxed frames, privacy modes). */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** First signs of a user's intent that start the priming capture (ADR-043). */
const PRIME_EVENTS = ['pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

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
    backForward: options.backForward ?? 'mirror',
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
  /** Which effect brought the user to each page (ADR-047). */
  // Keyed to the page Shatter was created on: the lazy runtime may first load
  // for a Back, when the URL has already changed.
  private readonly memory: HistoryMemory;
  /** Effect objects passed in options or requests, by name (for the memory). */
  private readonly seen = new Map<string, ShatterEffect | EffectComposition>();
  /** The capturer has captured once (warm), or a priming capture is on its way. */
  private primed = false;
  private removePrimeListeners: (() => void) | null = null;

  /** The sound engine, once loaded (ADR-060). */
  private sound: SoundLike | null = null;
  private soundLoading: Promise<SoundLike | null> | null = null;

  constructor(
    private readonly host: RuntimeHost,
    private readonly deps: ShatterDeps,
  ) {
    this.settings = settingsFrom(host.options);
    this.memory = new HistoryMemory(host.startKey, sessionStore());
    this.machine = new StateMachine(() => performance.now());
    this.hook = this.settings.debug ? this.installHook() : null;
    if (this.hook && this.settings.panel) this.openPanel(this.hook);
    this.scrollLock = createScrollLock(window, host.options.scrollLock);
  }

  /**
   * The visitor interacted, or sound was turned on afterwards (ADR-060):
   * loads the sound engine once and resumes it. Never under reduced motion.
   */
  soundGesture(): void {
    const settings = this.host.sound();
    if (!settings.enabled || this.destroyed || prefersReducedMotion() || !this.deps.loadSound)
      return;
    // No Web Audio in this browser: sound is simply unavailable, not an error.
    const scope = window as Window & { AudioContext?: unknown; webkitAudioContext?: unknown };
    if (!scope.AudioContext && !scope.webkitAudioContext) return;
    if (this.sound) {
      this.sound.resume();
      return;
    }
    this.soundLoading ??= this.deps.loadSound(window, settings.volume).then(
      (sound) => {
        if (this.destroyed) {
          sound.destroy();
          return null;
        }
        this.sound = sound;
        sound.resume();
        return sound;
      },
      (error: unknown) => {
        // No Web Audio, a blocked chunk: transitions stay silent.
        if (this.settings.debug) console.warn('[shatter-router] sound unavailable', error);
        return null;
      },
    );
  }

  /** Plays a transition's sounds when sound is on and allowed (ADR-060). */
  private playSound(cue: SoundCue): void {
    if (!this.sound || !this.host.sound().enabled || prefersReducedMotion()) return;
    try {
      this.sound.play(cue);
      if (this.hook) this.hook.lastSound = cue.motion;
    } catch (error) {
      // Sound never breaks a transition.
      if (this.settings.debug) console.warn('[shatter-router] sound failed', error);
    }
  }

  warmUp(): void {
    void this.load().then((loaded) => {
      if (loaded) this.armPrime();
    });
  }

  /**
   * The first capture of a page is about three times slower than the next
   * ones (JIT, the library's style caches, embedded fonts: 160–185 ms against
   * 50–110 ms on the docs landing page). On the first sign of the user's
   * intent, one throwaway capture runs at idle, so the click's capture is a
   * warm one. Not at load: that would be a long task in every page load
   * (ADR-043).
   */
  private armPrime(): void {
    if (this.primed || this.removePrimeListeners || this.destroyed) return;
    const onIntent = (): void => {
      // A capture is happening anyway (a transition, a pre-capture, a check).
      if (this.current || this.pending || this.busy) return;
      this.disarmPrime();
      this.primed = true;
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => void this.prime(), { timeout: 500 });
      } else {
        window.setTimeout(() => void this.prime(), 50);
      }
    };
    for (const name of PRIME_EVENTS) {
      window.addEventListener(name, onIntent, { capture: true, passive: true });
    }
    this.removePrimeListeners = () => {
      for (const name of PRIME_EVENTS) {
        window.removeEventListener(name, onIntent, { capture: true });
      }
    };
  }

  private disarmPrime(): void {
    this.removePrimeListeners?.();
    this.removePrimeListeners = null;
  }

  private async prime(): Promise<void> {
    const loaded = this.loaded;
    if (!loaded || this.destroyed || this.current || this.pending) return;
    if (document.visibilityState === 'hidden' || loaded.engine.contextLost) return;
    // No effect will play: nothing to warm up.
    if (this.settings.reducedMotion !== 'ignore' && prefersReducedMotion()) return;
    const viewport = readViewport(window);
    if (viewport.pinchZoomed) return;
    try {
      const snapshot = await loaded.capturer.capture({
        viewport,
        maxTextureSize: loaded.engine.maxTextureSize,
      });
      snapshot.dispose();
    } catch {
      // The real capture reports its own failure.
    }
  }

  precapture(effect?: string): void {
    this.startPrecapture();
    // The link's own effect: fetch its chunks while the pointer is on its way.
    if (effect && this.loaded) void this.loaded.engine.preloadEffect(effect, this.registry());
  }

  /**
   * Fetches the default effect's chunks and the substitute's (ADR-048), so
   * the first transition does not wait for them. Never rejects.
   */
  private async preload(engine: EngineLike): Promise<void> {
    await Promise.all([
      engine.preloadEffect(this.settings.effect, this.registry()),
      engine.preloadEffect(SUBSTITUTE_EFFECT, this.registry()),
    ]);
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
      plan: this.plan(request),
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
    this.sound?.destroy();
    this.sound = null;
    const run = this.current;
    if (run) {
      run.cancel.abort();
      run.skip.abort();
    }
    this.dropPrecapture();
    this.disarmPrime();
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
      // The effect's chunks (ADR-048), usually prefetched already.
      const effect = await engine.loadEffect(run.plan.effect, this.registry());
      this.throwIfCancelled(run);
      // The material (ADR-057): the call's, the effect's own, else the option's.
      // An unknown one throws here, before anything is shown.
      const material = engine.setMaterial(
        request.material ?? effect.material ?? this.host.material() ?? 'glass',
      );
      if (this.hook) this.hook.lastMaterial = material;

      const { snapshot, precaptured } = await this.snapshotFor(run, loaded, viewport);
      // A real capture warmed the capturer: no priming capture needed.
      this.primed = true;
      this.disarmPrime();
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
      const origin = run.plan.origin ?? { x: viewport.width / 2, y: viewport.height / 2 };
      const { count, tier } = engine.resolveShardCount(settings.shards, snapshot.duration);
      const seed = settings.seed;
      const stats = engine.fracture({
        effect,
        origin,
        count,
        thickness: settings.thickness,
        ...(seed === undefined ? {} : { seed }),
        ...(run.plan.path ? { path: run.plan.path } : {}),
      });
      if (this.hook) {
        this.hook.lastFracture = { ...stats, tier };
        this.hook.lastIntensity = run.plan.intensity;
        this.hook.lastTear = run.plan.path !== undefined && run.plan.path.length >= 2;
      }
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
          motionEffect = await engine.loadEffect(SUBSTITUTE_EFFECT, this.registry());
          engine.replaceEffect(motionEffect);
        }
      }
      if (this.hook) this.hook.lastEffect = motionEffect.name;

      engine.prepareMotion({
        duration: settings.duration ?? motionEffect.duration ?? DEFAULT_MOTION_MS,
        gravity: settings.gravity,
        // A charged press hits harder (ADR-060): 0.5 (a click) leaves it as set.
        impulse: settings.impulse * (0.5 + run.plan.intensity),
        direction: run.plan.direction,
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
      this.playSound({
        motion: motionEffect.name.split(/[ :]/)[0] ?? motionEffect.name,
        material,
        crackMs: motionEffect.crack ? (motionEffect.crackDuration ?? 140) : 0,
        durationMs: settings.duration ?? motionEffect.duration ?? DEFAULT_MOTION_MS,
        shardCount: stats.shardCount,
        intensity: run.plan.intensity,
        reverse: motionEffect.name.endsWith(':reverse'),
        pan: viewport.width > 0 ? (origin.x / viewport.width) * 2 - 1 : 0,
      });
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
    this.remember(run);
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
    this.remember(run);
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
   * Decides what a transition plays (ADR-047). Forward: the requested
   * effect. Back/forward through history, with `backForward: 'mirror'`
   * (default): Back plays the reverse of the effect that brought the user to
   * the page being left, from the same point; Forward replays the effect
   * that brought them to the page they return to. Without a memory (the
   * landing page), the reverse of the default effect.
   */
  private plan(request: TransitionRequest): Plan {
    const chosen = request.effect ?? this.settings.effect;
    if (typeof chosen !== 'string') this.seen.set(effectName(chosen), chosen);
    // The press or drag that started this navigation, if any (ADR-060).
    const gesture = request.direction === 'back' ? null : this.host.takeGesture();
    const force = {
      intensity: Math.min(
        1,
        Math.max(0, request.intensity ?? gesture?.intensity ?? DEFAULT_INTENSITY),
      ),
      path: request.path ?? gesture?.path,
    };
    if (request.direction !== 'back') {
      return {
        effect: chosen,
        origin: gesture?.origin ?? request.origin,
        direction: 'forward',
        ...force,
      };
    }
    const pop = this.memory.pop(locationKey(window.location));
    const mode = this.settings.backForward;
    if (mode === 'mirror') {
      if (pop.direction === 'forward' && pop.entry?.effect) {
        return {
          effect: pop.entry.effect,
          origin: request.origin ?? pop.entry.origin ?? undefined,
          direction: 'forward',
          ...force,
        };
      }
      const left = pop.direction === 'back' ? pop.entry : null;
      const name = left?.effect ?? effectName(chosen);
      return {
        ...this.mirrorOf(name),
        origin: request.origin ?? left?.origin ?? undefined,
        ...force,
      };
    }
    const reversed =
      mode === 'reverse' && typeof chosen === 'string' && !this.host.effects.has(chosen)
        ? (REVERSED[chosen] ?? chosen)
        : chosen;
    return { effect: reversed, origin: request.origin, direction: 'back', ...force };
  }

  /**
   * The reverse of an effect: effects that end on the new page (`flip`, custom
   * ones) run backwards as themselves, `assemble` reverses as `shatter`, and
   * every other effect gets its time reverse. Compositions follow their motion.
   */
  private mirrorOf(name: string): Pick<Plan, 'effect' | 'direction'> {
    const motion = this.motionOf(name);
    const own = this.registry().get(motion);
    if (own && !isComposition(own)) {
      // A custom effect that ends on the new page runs as is, with uDirection = -1.
      if (own.needsIncomingSnapshot) return { effect: name, direction: 'back' };
    } else if (motion === 'flip') {
      return { effect: name, direction: 'back' };
    } else if (motion === 'assemble') {
      return { effect: 'shatter', direction: 'back' };
    }
    return { effect: `${name}:reverse`, direction: 'forward' };
  }

  /** The motion an effect name comes down to, through registered compositions. */
  private motionOf(name: string): string {
    let current = name;
    for (let depth = 0; depth < 4; depth++) {
      const entry = this.registry().get(current);
      if (!entry || !isComposition(entry)) return current;
      current = entry.motion;
    }
    return current;
  }

  /** A forward navigation committed: remember how the user got here. */
  private remember(run: Run): void {
    if (run.request.direction === 'back') return;
    const { effect, origin } = run.plan;
    this.memory.record(
      locationKey(window.location),
      effectName(effect),
      origin ?? null,
      run.request.replace ?? false,
    );
  }

  /** Registered effects plus effect objects passed to transitions (by name). */
  private registry(): ReadonlyMap<string, ShatterEffect | EffectComposition> {
    if (this.seen.size === 0) return this.host.effects;
    return new Map([...this.seen, ...this.host.effects]);
  }

  /**
   * Captures the new page under the overlay, within the capture budget.
   * Null when it fails or takes too long: the caller substitutes an effect.
   */
  private async captureIncoming(run: Run, loaded: Loaded): Promise<Snapshot | null> {
    const started = performance.now();
    if (this.hook) this.hook.lastIncomingCaptureStart = started;
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
    let pre = this.pending;
    this.pending = null;
    window.clearTimeout(this.precaptureExpiry);
    // A tear moved the pointer away from the link after the press: the page
    // looks different now (hover), so it is captured as it is (ADR-060).
    if (pre && run.plan.path) {
      pre.abandon();
      pre = null;
    }
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
        void this.preload(loaded.engine).then(() => {
          if (this.hook) this.hook.ready = true;
        });
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

  /**
   * The `glassTint` option as channels, overriding the material's tint; null
   * when unset or not a `#rgb`/`#rrggbb` colour (the material's tint is used).
   */
  private glassTint(): Rgb | null {
    const option = this.host.options.glassTint;
    const parsed = option === undefined ? null : parseHexColor(option);
    if (option !== undefined && !parsed && this.settings.debug) {
      console.warn(
        `[shatter-router] glassTint "${option}" is not #rgb or #rrggbb; using the material's tint`,
      );
    }
    return parsed;
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
      lastIncomingCaptureStart: null,
      lastMaterial: null,
      lastIntensity: null,
      lastTear: false,
      lastSound: null,
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
