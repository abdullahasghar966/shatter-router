import type { MaterialSource } from '../../src/core/material';
import { resolveMaterial } from '../../src/engine/materials';
import { vi } from 'vitest';
import { type EffectSource, effectName, isComposition } from '../../src/core/compose';
import type { EffectComposition, EffectState, ShatterEffect } from '../../src/core/effect';
import type { CapturerLike, EngineLike, Loaded, ShatterDeps } from '../../src/runtime/index';
import type { Snapshot } from '../../src/core/snapshot';

export interface Gate<T = void> {
  readonly promise: Promise<T>;
  open(value: T): void;
  fail(error: unknown): void;
}

export function gate<T = void>(): Gate<T> {
  let open!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    open = resolve;
    fail = reject;
  });
  return { promise, open, fail };
}

/** Resolves when the gate opens or the signal aborts; at once without a gate. */
async function untilOpenOrAborted(g: Gate | null, signal?: AbortSignal): Promise<void> {
  if (!g || signal?.aborted) return;
  await Promise.race([
    g.promise,
    new Promise<void>((resolve) =>
      signal?.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      ),
    ),
  ]);
}

export const testEffect: ShatterEffect = {
  name: 'shatter',
  needsIncomingSnapshot: false,
  crack: true,
  duration: 1000,
  shardAttributes: () => ({ data: new Float32Array(0) }),
  vertexChunk: 'void shardMotion(Shard shard, inout Pose pose) {}',
  isComplete: () => true,
};

/** Built-in effect names the fake engine knows; the ones ending on the new page need it captured. */
const FAKE_BUILT_INS: Readonly<Record<string, boolean>> = {
  shatter: false,
  explode: false,
  implode: false,
  flip: true,
  assemble: true,
};

export type FakeSnapshot = Snapshot & { readonly dispose: ReturnType<typeof vi.fn<() => void>> };

export function fakeSnapshot(duration = 40): FakeSnapshot {
  return {
    source: document.createElement('canvas'),
    width: 800,
    height: 600,
    deviceWidth: 800,
    deviceHeight: 600,
    duration,
    dispose: vi.fn<() => void>(),
  };
}

/** A controllable stand-in for the WebGL engine and the capturer. */
export class FakeWorld {
  readonly calls: string[] = [];
  /** The shading the runtime set on the engine (glassTint, chromatic). */
  shading: { tint: readonly [number, number, number] | null; chromatic: boolean } | null = null;
  /** The material of each transition, as the runtime set it (ADR-057). */
  materials: string[] = [];
  /** Effect names passed to loadEffect, in order. */
  readonly resolved: string[] = [];
  /** Impact points passed to fracture, in order. */
  readonly origins: ({ x: number; y: number } | undefined)[] = [];
  /** Directions passed to prepareMotion, in order. */
  readonly directions: string[] = [];
  /** Tear paths and impulses the runtime asked for (ADR-060). */
  readonly paths: (readonly { x: number; y: number }[] | undefined)[] = [];
  readonly impulses: number[] = [];
  /** Sound cues played through `deps.loadSound`, when a test enables it. */
  readonly sounds: { motion: string; intensity: number; reverse: boolean }[] = [];
  soundResumes = 0;
  /** Set to give the runtime a sound engine (ADR-060). */
  withSound = false;
  readonly overlay = document.createElement('div');
  readonly snapshots: FakeSnapshot[] = [];
  /** Hold the matching phase until opened (or aborted, for crack/animate). */
  coverGate: Gate | null = null;
  crackGate: Gate | null = null;
  animateGate: Gate | null = null;
  captureGate: Gate | null = null;
  captureError: Error | null = null;
  coverError: Error | null = null;
  animateError: Error | null = null;
  contextLost = false;
  loadError: Error | null = null;
  lastCrackSignal: AbortSignal | undefined;
  lastAnimateSignal: AbortSignal | undefined;

  readonly engine: EngineLike;
  readonly capturer: CapturerLike;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- fake objects read live test settings
    const world = this;
    const engine = {
      maxTextureSize: 4096,
      get contextLost() {
        return world.contextLost;
      },
      textureCount: 0,
      overlayElement: world.overlay,
      wireframe: false,
      lastLoopStats: { frames: 61, durationMs: 1000, worstFrameMs: 17 },
      drawStats: { calls: 0, frames: 0 },
      readPixels: () => ({ width: 2, height: 1, data: new Uint8Array(8) }),
      async loadEffect(
        effect: EffectSource,
        registered: ReadonlyMap<string, ShatterEffect | EffectComposition>,
      ) {
        world.calls.push('loadEffect');
        await Promise.resolve();
        if (typeof effect !== 'string' && !isComposition(effect)) return effect;
        const name = effectName(effect);
        world.resolved.push(name);
        const found = registered.get(name);
        const spec = typeof effect === 'string' ? found : effect;
        if (spec && !isComposition(spec)) return spec;
        // A composition takes its motion's needs.
        const motion = spec ? spec.motion : name;
        // A composition's own material travels with it, as in composeEffect (ADR-057).
        const material = spec?.material === undefined ? {} : { material: spec.material };
        const own = registered.get(motion);
        if (own && !isComposition(own)) return { ...own, name, ...material };
        // '<name>:reverse' wraps a known effect and always needs the new page.
        const base = motion.endsWith(':reverse') ? motion.slice(0, -':reverse'.length) : null;
        if (base !== null && (registered.has(base) || base in FAKE_BUILT_INS)) {
          return { ...testEffect, name, needsIncomingSnapshot: true };
        }
        const needsIncoming = FAKE_BUILT_INS[motion];
        if (needsIncoming === undefined) throw new Error(`Unknown effect "${motion}"`);
        return { ...testEffect, name, needsIncomingSnapshot: needsIncoming, ...material };
      },
      /** Fetching chunks ahead of time is not observable in these tests. */
      preloadEffect: () => Promise.resolve(),
      resolveShardCount: () => ({ count: 40, tier: 'low' as const }),
      async cover() {
        world.calls.push('cover');
        if (world.coverGate) await world.coverGate.promise;
        if (world.coverError) throw world.coverError;
      },
      fracture(options: {
        origin?: { x: number; y: number };
        path?: readonly { x: number; y: number }[];
      }) {
        world.paths.push(options.path);
        world.calls.push('fracture');
        world.origins.push(options.origin);
        return { shardCount: 40, vertexCount: 480, fractureMs: 1 };
      },
      setIncoming() {
        world.calls.push('setIncoming');
      },
      replaceEffect(effect: ShatterEffect) {
        world.calls.push(`replaceEffect:${effect.name}`);
      },
      setShading(shading: { tint: readonly [number, number, number] | null; chromatic: boolean }) {
        world.shading = shading;
      },
      setMaterial(source: MaterialSource) {
        // The real resolver: unknown names throw as in the engine.
        const name = resolveMaterial(source).name;
        world.materials.push(name);
        return name;
      },
      startPhysics() {
        world.calls.push('startPhysics');
        return true;
      },
      prepareMotion(options: { direction: string; impulse: number }) {
        world.impulses.push(options.impulse);
        world.calls.push('prepareMotion');
        world.directions.push(options.direction);
        return {} as EffectState;
      },
      async crack(options: { signal?: AbortSignal } = {}) {
        world.calls.push('crack');
        world.lastCrackSignal = options.signal;
        await untilOpenOrAborted(world.crackGate, options.signal);
      },
      async animate(options: { signal?: AbortSignal } = {}) {
        world.calls.push('animate');
        world.lastAnimateSignal = options.signal;
        await untilOpenOrAborted(world.animateGate, options.signal);
        if (world.animateError) throw world.animateError;
        world.calls.push(options.signal?.aborted ? 'animate:skipped' : 'animate:done');
        const { frames } = engine.lastLoopStats;
        engine.drawStats = {
          calls: engine.drawStats.calls + frames,
          frames: engine.drawStats.frames + frames,
        };
        return engine.lastLoopStats;
      },
      setCrack: () => undefined,
      setMotionTime: () => undefined,
      scrub: () => undefined,
      scrubLength: 0,
      setOverlayShown: () => undefined,
      draw: () => undefined,
      release() {
        world.calls.push('release');
      },
      destroy() {
        world.calls.push('destroy');
      },
      measureFracture: () => ({ medianMs: 1, p95Ms: 1, runs: 1 }),
    };
    this.engine = engine;
    this.capturer = {
      layoutGrid: 'css',
      warmUp: () => Promise.resolve(),
      destroy() {
        world.calls.push('capturer:destroy');
      },
      async capture() {
        world.calls.push('capture');
        const snapshot = fakeSnapshot();
        world.snapshots.push(snapshot);
        if (world.captureGate) await world.captureGate.promise;
        if (world.captureError) throw world.captureError;
        return snapshot;
      },
    } as unknown as CapturerLike;
  }

  get deps(): ShatterDeps {
    const sounds = this.sounds;
    const resumed = (): void => {
      this.soundResumes += 1;
    };
    return {
      load: (): Promise<Loaded> =>
        this.loadError
          ? Promise.reject(this.loadError)
          : Promise.resolve({ engine: this.engine, capturer: this.capturer }),
      ...(this.withSound
        ? {
            loadSound: () =>
              Promise.resolve({
                resume: resumed,
                play: (cue: { motion: string; intensity: number; reverse: boolean }) => {
                  sounds.push({
                    motion: cue.motion,
                    intensity: cue.intensity,
                    reverse: cue.reverse,
                  });
                },
                destroy: () => undefined,
              }),
          }
        : {}),
    };
  }
}

/** Lets pending promise callbacks and short timers run. */
export async function flush(ms = 0): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, ms));
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** Waits until `predicate` holds (polling), failing after `timeout` ms. */
export async function until(predicate: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('until(): timed out');
    await flush(2);
  }
}
