import { vi } from 'vitest';
import type { EffectState, ShatterEffect } from '../../src/core/effect';
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
  shading: { tint: readonly [number, number, number]; chromatic: boolean } | null = null;
  /** Effect names passed to resolveEffect, in order. */
  readonly resolved: string[] = [];
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
      resolveEffect(
        effect: string | ShatterEffect,
        registered: ReadonlyMap<string, ShatterEffect>,
      ) {
        world.calls.push('resolveEffect');
        if (typeof effect !== 'string') return effect;
        world.resolved.push(effect);
        const registeredEffect = registered.get(effect);
        if (registeredEffect) return registeredEffect;
        const needsIncoming = FAKE_BUILT_INS[effect];
        if (needsIncoming === undefined) throw new Error(`Unknown effect "${effect}"`);
        return { ...testEffect, name: effect, needsIncomingSnapshot: needsIncoming };
      },
      resolveShardCount: () => ({ count: 40, tier: 'low' as const }),
      async cover() {
        world.calls.push('cover');
        if (world.coverGate) await world.coverGate.promise;
        if (world.coverError) throw world.coverError;
      },
      fracture() {
        world.calls.push('fracture');
        return { shardCount: 40, vertexCount: 480, fractureMs: 1 };
      },
      setIncoming() {
        world.calls.push('setIncoming');
      },
      replaceEffect(effect: ShatterEffect) {
        world.calls.push(`replaceEffect:${effect.name}`);
      },
      setShading(shading: { tint: readonly [number, number, number]; chromatic: boolean }) {
        world.shading = shading;
      },
      startPhysics() {
        world.calls.push('startPhysics');
        return true;
      },
      prepareMotion() {
        world.calls.push('prepareMotion');
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
    return {
      load: (): Promise<Loaded> =>
        this.loadError
          ? Promise.reject(this.loadError)
          : Promise.resolve({ engine: this.engine, capturer: this.capturer }),
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
