import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardInfo,
  type ShatterEffect,
} from '../src/core/effect';
import { mulberry32 } from '../src/core/random';
import { settle, SETTLE_GLSL, SETTLE_STIFFNESS } from '../src/core/spring';
import type {
  Shatter,
  ShatterOptions,
  ShatterTestHook,
  TransitionRequest,
} from '../src/core/types';
import { assembleEffect } from '../src/engine/effects/assemble';
import { explodeEffect } from '../src/engine/effects/explode';
import { flipEffect } from '../src/engine/effects/flip';
import { implodeEffect } from '../src/engine/effects/implode';
import { shatterEffect } from '../src/engine/effects/shatter';
import { fracture } from '../src/engine/fracture';
import { impactPattern } from '../src/engine/patterns/impact';
import { staggerOrder } from '../src/engine/stagger';
import { BUILT_IN_EFFECT_NAMES } from '../src/engine/index';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld, gate, until } from './helpers/fakes';

function context(overrides: Partial<EffectContext> = {}): EffectContext {
  const geometry = fracture(impactPattern, {
    width: 1440,
    height: 900,
    origin: { x: 700, y: 400 },
    count: 160,
    seed: 3,
  });
  const shards: ShardInfo[] = geometry.shards.map((shard, id) => ({ id, ...shard }));
  return {
    width: 1440,
    height: 900,
    origin: geometry.origin,
    maxRadius: geometry.maxRadius,
    shards,
    duration: 1000,
    gravity: 2600,
    impulse: 900,
    thickness: 6,
    direction: 'forward',
    cameraZ: 900 / 2 / Math.tan((40 * Math.PI) / 360),
    random: mulberry32(11),
    order: staggerOrder('radial', geometry),
    ...overrides,
  };
}

function state(effect: ShatterEffect, ctx: EffectContext): EffectState {
  return { ...ctx, attributes: effect.shardAttributes(ctx).data };
}

describe('settle (critically damped spring, master prompt 5.4)', () => {
  it('starts at 0, rises monotonically, never overshoots and is exactly 1 from T on', () => {
    const T = 0.6;
    expect(settle(0, T)).toBe(0);
    expect(settle(-1, T)).toBe(0);
    let previous = 0;
    for (let i = 1; i < 1000; i++) {
      const value = settle((i / 1000) * T, T);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThan(1);
      previous = value;
    }
    expect(settle(T, T)).toBe(1);
    expect(settle(T * 3, T)).toBe(1);
  });

  it('the snap at T is invisible: under 1e-4 of the travel is left just before it', () => {
    expect(1 - settle(0.9999, 1)).toBeLessThan(1e-4);
    expect((1 + SETTLE_STIFFNESS) * Math.exp(-SETTLE_STIFFNESS)).toBeLessThan(1e-4);
  });

  it('the GLSL twin uses the same stiffness', () => {
    expect(SETTLE_GLSL).toContain(`${SETTLE_STIFFNESS.toFixed(1)} * t / T`);
    expect(SETTLE_GLSL).toContain('float settle(float t, float T)');
  });
});

const NEW_EFFECTS = [explodeEffect, implodeEffect, flipEffect, assembleEffect];

describe('built-in effects', () => {
  it('are all registered by name', () => {
    expect([...BUILT_IN_EFFECT_NAMES].sort()).toEqual(
      [
        'assemble',
        'explode',
        'flip',
        'implode',
        'shatter',
        // Motion families (ADR-055).
        'crumble',
        'rain',
        'vortex',
        'wind',
        'blinds',
        'domino',
        'slide',
        'fold',
        'melt',
        'ripple',
        'glitch',
      ].sort(),
    );
  });

  it.each(NEW_EFFECTS)('$name follows the public interface', (effect) => {
    expect(effect.vertexChunk).toContain('void shardMotion(Shard shard, inout Pose pose)');
    if (effect.fragmentChunk) {
      expect(effect.fragmentChunk).toContain('void shardFragment(inout vec4 color)');
    }
    const data = effect.shardAttributes(context()).data;
    expect(data).toHaveLength(context().shards.length * SHARD_ATTRIBUTE_FLOATS);
    expect([...data].every(Number.isFinite)).toBe(true);
  });

  it.each(NEW_EFFECTS)('$name is deterministic for a seed', (effect) => {
    const a = effect.shardAttributes(context({ random: mulberry32(5) })).data;
    const b = effect.shardAttributes(context({ random: mulberry32(5) })).data;
    expect([...a]).toEqual([...b]);
  });

  it('flip and assemble end on the incoming page; the others do not need it', () => {
    expect(flipEffect.needsIncomingSnapshot).toBe(true);
    expect(assembleEffect.needsIncomingSnapshot).toBe(true);
    expect(assembleEffect.layers).toBe(2);
    expect(flipEffect.layers ?? 1).toBe(1);
    for (const effect of [shatterEffect, explodeEffect, implodeEffect]) {
      expect(effect.needsIncomingSnapshot).toBe(false);
      expect(effect.layers ?? 1).toBe(1);
    }
  });

  it('flip: every shard has finished turning by the end of the motion phase', () => {
    const ctx = context();
    const data = flipEffect.shardAttributes(ctx).data;
    for (let i = 0; i < ctx.shards.length; i++) {
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      const [ax = 0, ay = 0, delay = 0, flipTime = 0] = [
        data[o],
        data[o + 1],
        data[o + 2],
        data[o + 3],
      ];
      expect(Math.hypot(ax, ay)).toBeCloseTo(1, 5); // an in-plane unit axis
      expect(delay + flipTime).toBeLessThanOrEqual(ctx.duration / 1000 + 1e-6);
      expect(settle(ctx.duration / 1000 - delay, flipTime)).toBe(1);
    }
    expect(flipEffect.isComplete(ctx.duration - 1, state(flipEffect, ctx))).toBe(false);
    expect(flipEffect.isComplete(ctx.duration, state(flipEffect, ctx))).toBe(true);
  });

  it('implode: every shard reaches the point by the end; complete once all arrived', () => {
    const ctx = context();
    const s = state(implodeEffect, ctx);
    let latest = 0;
    for (let i = 0; i < ctx.shards.length; i++) {
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      latest = Math.max(latest, (s.attributes[o + 1] ?? 0) + (s.attributes[o + 2] ?? 0));
    }
    expect(latest).toBeLessThanOrEqual(ctx.duration / 1000 + 1e-6);
    expect(implodeEffect.isComplete(latest * 1000 - 5, s)).toBe(false);
    expect(implodeEffect.isComplete(latest * 1000 + 1, s)).toBe(true);
  });

  it('explode: no gravity in the first quarter second, complete by the end of the phase', () => {
    const ctx = context();
    const s = state(explodeEffect, ctx);
    expect(explodeEffect.isComplete(10, s)).toBe(false);
    expect(explodeEffect.isComplete(ctx.duration, s)).toBe(true);
    // The blast is radial: velocity points away from the impact point.
    const shard = ctx.shards.find((item) => item.distance > 200);
    expect(shard).toBeDefined();
    if (!shard) return;
    const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
    const outward =
      (s.attributes[o] ?? 0) * (shard.centroid.x - ctx.origin.x) +
      (s.attributes[o + 1] ?? 0) * (shard.centroid.y - ctx.origin.y);
    expect(outward).toBeGreaterThan(0);
    expect(explodeEffect.vertexChunk).toContain('fall = max(0.0, t - GRAVITY_DELAY)');
    // The stretch builds up from 0, so the motion starts exactly at rest (ADR-047).
    expect(explodeEffect.vertexChunk).toContain('smoothstep(0.0, STRETCH_RAMP, t)');
  });

  it('assemble: the incoming layer lands by the end, the outgoing one is gone by then', () => {
    // Phase fractions in the chunk: start + stagger + land must fit in the phase.
    expect(assembleEffect.vertexChunk).toMatch(/ARRIVE_START = 0\.120/);
    expect(0.12 + 0.25 + 0.6).toBeLessThanOrEqual(1);
    expect(assembleEffect.vertexChunk).toContain('pose.scale = pose.alpha > 0.0 ? 1.0 : 0.0');
    const ctx = context();
    expect(assembleEffect.isComplete(ctx.duration, state(assembleEffect, ctx))).toBe(true);
  });
});

function hook(): ShatterTestHook | undefined {
  return (window as unknown as { __SHATTER_TEST__?: ShatterTestHook }).__SHATTER_TEST__;
}

describe('runtime: effects that end on the incoming page', () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
    const shatter = createShatterWith({ precapture: false, debug: true, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }

  beforeEach(() => {
    document.body.innerHTML = '<main><h1>Page</h1></main>';
  });

  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
    vi.restoreAllMocks();
  });

  it('captures the new page after the commit, before the motion is prepared', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'flip' });
    await shatter.transition({ commit: () => undefined });
    expect(world.calls).toEqual([
      'loadEffect',
      'capture',
      'cover',
      'fracture',
      'capture',
      'setIncoming',
      'prepareMotion',
      'crack',
      'animate',
      'animate:done',
      'release',
    ]);
    expect(hook()?.lastEffect).toBe('flip');
    expect(hook()?.lastIncomingCaptureMs).not.toBeNull();
  });

  it('plays shatter instead when the new page cannot be captured, and still navigates', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'assemble' });
    const commit = vi.fn();
    // Only the second capture (the incoming page) fails.
    let captures = 0;
    const original = world.capturer.capture.bind(world.capturer);
    world.capturer.capture = async (request) => {
      captures += 1;
      if (captures > 1) throw new Error('tainted');
      return original(request);
    };
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledOnce();
    expect(world.calls).toContain('replaceEffect:shatter');
    expect(world.calls).not.toContain('setIncoming');
    expect(hook()?.lastEffect).toBe('shatter');
    expect(hook()?.lastFallback).toBeNull();
  });

  it("pauses at 'settled' after the motion, before the overlay goes", async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'flip' });
    // The debug hook appears once the lazy runtime has loaded.
    await shatter.transition({ commit: () => undefined });
    world.calls.splice(0);
    const h = hook();
    expect(h).toBeDefined();
    if (!h) return;
    h.pauseAt = 'settled';
    const done = shatter.transition({ commit: () => undefined });
    await until(() => h.paused === 'settled');
    expect(world.calls.at(-1)).toBe('animate:done');
    expect(world.calls).not.toContain('release');
    h.resume();
    await done;
    expect(world.calls.at(-1)).toBe('release');
  });
});

describe("runtime: backForward (master prompt §6, 'reverse' mapping)", () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
    const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
  });

  it.each([
    ['shatter', 'assemble'],
    ['explode', 'assemble'],
    ['implode', 'assemble'],
    ['assemble', 'shatter'],
    ['flip', 'flip'],
  ])("'reverse' plays %s backwards as %s", async (forward, back) => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: forward, backForward: 'reverse' });
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(world.resolved[0]).toBe(back);
    await shatter.transition({ commit: () => undefined, direction: 'forward' });
    expect(world.resolved.at(-1)).toBe(forward);
  });

  it("'same' plays the forward effect", async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'explode', backForward: 'same' });
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(world.resolved).toEqual(['explode']);
  });

  it('never maps a user-registered effect, even one named like a built-in', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'shatter', backForward: 'reverse' });
    const own: ShatterEffect = { ...shatterEffect, name: 'shatter' };
    shatter.registerEffect(own);
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(world.resolved).toEqual(['shatter']);
  });

  it("'none' swaps instantly on back/forward with fallback reason 'disabled'", async () => {
    const world = new FakeWorld();
    const shatter = create(world, { backForward: 'none' });
    const reasons: string[] = [];
    shatter.on('fallback', ({ reason }) => reasons.push(reason));
    const commit = vi.fn();
    await shatter.transition({ commit, direction: 'back' });
    expect(commit).toHaveBeenCalledOnce();
    expect(reasons).toEqual(['disabled']);
    expect(world.calls).not.toContain('capture');
  });

  it('a gate keeps the incoming capture inside the capture budget', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'flip', captureBudget: 30 });
    let captures = 0;
    const slow = gate();
    const original = world.capturer.capture.bind(world.capturer);
    world.capturer.capture = async (request) => {
      captures += 1;
      if (captures > 1) await slow.promise;
      return original(request);
    };
    await shatter.transition({ commit: () => undefined });
    expect(world.calls).toContain('replaceEffect:shatter');
    slow.open();
  });
});

describe("runtime: backForward 'mirror' (default, ADR-047)", () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
    const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }
  /** A link click: the commit pushes `path`. */
  function go(shatter: Shatter, path: string, extra: Partial<TransitionRequest> = {}) {
    return shatter.transition({
      commit: () => {
        history.pushState(null, '', path);
      },
      ...extra,
    });
  }
  /** A history traversal: the URL has already changed when the transition starts. */
  function pop(shatter: Shatter, path: string) {
    history.replaceState(null, '', path);
    return shatter.transition({ commit: () => undefined, direction: 'back' });
  }
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
  });

  it('Back plays the time reverse of the arriving effect, from the same point', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await go(shatter, '/a', { effect: 'explode', origin: { x: 10, y: 20 } });
    await pop(shatter, '/');
    expect(world.resolved).toEqual(['explode', 'explode:reverse']);
    expect(world.origins).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 20 },
    ]);
    expect(world.directions).toEqual(['forward', 'forward']);
  });

  it('Forward replays the effect that brought the user to the page', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await go(shatter, '/a', { effect: 'implode', origin: { x: 5, y: 6 } });
    await pop(shatter, '/');
    await pop(shatter, '/a');
    expect(world.resolved).toEqual(['implode', 'implode:reverse', 'implode']);
    expect(world.origins.at(-1)).toEqual({ x: 5, y: 6 });
    expect(world.directions.at(-1)).toBe('forward');
  });

  it('flip turns back the other way and assemble reverses as shatter', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await go(shatter, '/a', { effect: 'flip' });
    await go(shatter, '/b', { effect: 'assemble' });
    await pop(shatter, '/a');
    await pop(shatter, '/');
    expect(world.resolved).toEqual(['flip', 'assemble', 'shatter', 'flip']);
    expect(world.directions.slice(2)).toEqual(['back', 'back']);
  });

  it('a custom effect that ends on the new page runs backwards as itself', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    shatter.registerEffect({ ...flipEffect, name: 'turn' });
    await go(shatter, '/a', { effect: 'turn' });
    await pop(shatter, '/');
    expect(world.resolved).toEqual(['turn', 'turn']);
    expect(world.directions).toEqual(['forward', 'back']);
  });

  it('a custom effect that ends off the page is time-reversed', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    shatter.registerEffect({ ...shatterEffect, name: 'ripple-out' });
    await go(shatter, '/a', { effect: 'ripple-out' });
    await pop(shatter, '/');
    expect(world.resolved).toEqual(['ripple-out', 'ripple-out:reverse']);
  });

  it('an effect object is remembered by name and reversed on Back', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    const own: ShatterEffect = { ...shatterEffect, name: 'own' };
    await go(shatter, '/a', { effect: own });
    await pop(shatter, '/');
    expect(world.resolved).toEqual(['own:reverse']);
  });

  it('without a memory (the landing page) Back reverses the default effect', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'explode' });
    await pop(shatter, '/elsewhere');
    expect(world.resolved).toEqual(['explode:reverse']);
  });

  it('a replace overwrites the current entry instead of adding one', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await go(shatter, '/a', { effect: 'explode' });
    await shatter.transition({
      commit: () => {
        history.replaceState(null, '', '/a?tab=2');
      },
      effect: 'implode',
      replace: true,
    });
    await pop(shatter, '/');
    expect(world.resolved.at(-1)).toBe('implode:reverse');
  });

  it('the memory survives a reload of the same page', async () => {
    const world = new FakeWorld();
    const first = create(world);
    await go(first, '/a', { effect: 'implode' });
    first.destroy();
    const second = create(world);
    await pop(second, '/');
    expect(world.resolved.at(-1)).toBe('implode:reverse');
  });
});
