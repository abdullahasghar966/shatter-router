import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effectName, isComposition } from '../src/core/compose';
import type { EffectContext, ShardInfo, ShatterEffect, Stagger } from '../src/core/effect';
import { mulberry32 } from '../src/core/random';
import type { Shatter, ShatterOptions } from '../src/core/types';
import { composeEffect } from '../src/engine/compose';
import { flipEffect } from '../src/engine/effects/flip';
import { shatterEffect } from '../src/engine/effects/shatter';
import { fracture, type FractureGeometry } from '../src/engine/fracture';
import { impactPattern } from '../src/engine/patterns/impact';
import { BUILT_IN_EFFECT_NAMES, MOTIONS, PATTERNS } from '../src/engine/plugins';
import { staggerOrder } from '../src/engine/stagger';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld } from './helpers/fakes';

const geometry: FractureGeometry = fracture(impactPattern, {
  width: 1440,
  height: 900,
  origin: { x: 300, y: 200 },
  count: 160,
  seed: 5,
});

function context(order: Float32Array): EffectContext {
  const shards: ShardInfo[] = geometry.shards.map((shard, id) => ({ id, ...shard }));
  return {
    width: geometry.width,
    height: geometry.height,
    origin: geometry.origin,
    maxRadius: geometry.maxRadius,
    shards,
    duration: 1000,
    gravity: 2600,
    impulse: 900,
    thickness: 6,
    direction: 'forward',
    cameraZ: 1200,
    random: mulberry32(11),
    order,
  };
}

describe('stagger order (ADR-048)', () => {
  const STAGGERS: Stagger[] = [
    'radial',
    'linear',
    { type: 'linear', angle: 90 },
    'spiral',
    'random',
    'reading-order',
  ];

  it.each(STAGGERS.map((stagger) => [JSON.stringify(stagger), stagger] as const))(
    '%s gives every shard a value in [0, 1]',
    (_, stagger) => {
      const order = staggerOrder(stagger, { ...geometry, seed: 1 });
      expect(order).toHaveLength(geometry.shards.length);
      for (const value of order) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    },
  );

  it("'radial' (the default) is the distance over maxRadius, as the effects used before", () => {
    const order = staggerOrder(undefined, geometry);
    geometry.shards.forEach((shard, i) => {
      expect(order[i]).toBeCloseTo(Math.min(1, shard.distance / geometry.maxRadius), 6);
    });
  });

  it("'linear' runs left to right; at 90 degrees top to bottom", () => {
    const across = staggerOrder('linear', geometry);
    const down = staggerOrder({ type: 'linear', angle: 90 }, geometry);
    geometry.shards.forEach((shard, i) => {
      expect(across[i]).toBeCloseTo(shard.centroid.x / geometry.width, 5);
      expect(down[i]).toBeCloseTo(shard.centroid.y / geometry.height, 5);
    });
  });

  it("'reading-order' goes row by row", () => {
    const order = staggerOrder('reading-order', geometry);
    const top = geometry.shards.findIndex((shard) => shard.centroid.y < 60);
    const bottom = geometry.shards.findIndex((shard) => shard.centroid.y > 840);
    expect(order[top]).toBeLessThan(order[bottom] ?? 0);
  });

  it("'random' is deterministic for a seed and differs between seeds", () => {
    const a = staggerOrder('random', { ...geometry, seed: 3 });
    const b = staggerOrder('random', { ...geometry, seed: 3 });
    const c = staggerOrder('random', { ...geometry, seed: 4 });
    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
  });

  it('the built-in motions delay each shard by its order', () => {
    const linear = staggerOrder('linear', geometry);
    const data = shatterEffect.shardAttributes(context(linear)).data;
    geometry.shards.forEach((_, i) => {
      // shatter: Shard.a.w = order × 0.12 s.
      expect(data[i * 8 + 3]).toBeCloseTo((linear[i] ?? 0) * 0.12, 6);
    });
  });
});

describe('compositions (ADR-048)', () => {
  it('are told apart from effect objects and named after their parts', () => {
    expect(isComposition({ motion: 'explode' })).toBe(true);
    expect(isComposition(shatterEffect)).toBe(false);
    expect(effectName({ motion: 'explode' })).toBe('explode');
    expect(
      effectName({
        motion: 'explode',
        pattern: 'impact',
        stagger: { type: 'linear', angle: 90 },
        material: 'glass',
        timing: { duration: 900 },
      }),
    ).toBe('explode pattern=impact stagger=linear(90) material=glass duration=900');
    expect(effectName({ name: 'wave', motion: 'implode', stagger: 'spiral' })).toBe('wave');
    expect(effectName('flip')).toBe('flip');
  });

  it('keep the motion and override name, pattern, stagger and duration', () => {
    const composed = composeEffect(
      { name: 'curtain', motion: 'flip', stagger: 'linear', timing: { duration: 2000 } },
      flipEffect,
    );
    expect(composed.name).toBe('curtain');
    expect(composed.needsIncomingSnapshot).toBe(true);
    expect(composed.crack).toBe(flipEffect.crack);
    expect(composed.layers).toBe(flipEffect.layers);
    expect(composed.vertexChunk).toBe(flipEffect.vertexChunk);
    expect(composed.duration).toBe(2000);
    expect(composed.stagger).toBe('linear');
    const ctx = context(staggerOrder('linear', geometry));
    expect([...composed.shardAttributes(ctx).data]).toEqual([
      ...flipEffect.shardAttributes(context(staggerOrder('linear', geometry))).data,
    ]);
  });

  it('without overrides take everything from the motion', () => {
    const composed = composeEffect({ motion: 'shatter' }, shatterEffect);
    expect(composed.name).toBe('shatter');
    expect(composed.duration).toBe(shatterEffect.duration);
    expect(composed.pattern).toBeUndefined();
    expect(composed.stagger).toBeUndefined();
  });
});

describe('built-in parts load on demand (ADR-048)', () => {
  it.each(BUILT_IN_EFFECT_NAMES)('motion %s', async (name) => {
    const loader = MOTIONS[name];
    expect(loader).toBeDefined();
    const motion = await loader?.();
    expect(motion?.name).toBe(name);
    expect(motion?.vertexChunk).toContain('void shardMotion(');
  });

  it('pattern impact', async () => {
    const pattern = await PATTERNS.impact?.();
    expect(pattern?.name).toBe('impact');
    const shards = pattern?.cells({ width: 800, height: 600, origin: { x: 1, y: 1 }, count: 40 });
    const area = (shards ?? []).reduce((sum, shard) => sum + shard.area, 0);
    expect(area).toBeCloseTo(800 * 600, 0);
  });
});

describe('runtime: compositions', () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
    const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
  });

  it('plays a composition passed per transition, under its derived name', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await shatter.transition({
      commit: () => {
        history.pushState(null, '', '/a');
      },
      effect: { motion: 'explode', stagger: 'linear' },
    });
    expect(world.resolved).toEqual(['explode stagger=linear']);
  });

  it('a registered composition plays by name, and Back reverses it', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    shatter.registerEffect({ name: 'sweep', motion: 'shatter', stagger: 'linear' });
    await shatter.transition({
      commit: () => {
        history.pushState(null, '', '/a');
      },
      effect: 'sweep',
    });
    history.replaceState(null, '', '/');
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(world.resolved).toEqual(['sweep', 'sweep:reverse']);
  });

  it('Back runs a composition of flip backwards as itself', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    shatter.registerEffect({ name: 'curtain', motion: 'flip', stagger: 'linear' });
    await shatter.transition({
      commit: () => {
        history.pushState(null, '', '/a');
      },
      effect: 'curtain',
    });
    history.replaceState(null, '', '/');
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(world.resolved).toEqual(['curtain', 'curtain']);
    expect(world.directions).toEqual(['forward', 'back']);
  });

  it('a composition can use a registered effect as its motion', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    const ripple: ShatterEffect = { ...shatterEffect, name: 'ripple' };
    shatter.registerEffect(ripple);
    await shatter.transition({
      commit: () => undefined,
      effect: { motion: 'ripple', stagger: 'spiral' },
    });
    expect(world.resolved).toEqual(['ripple stagger=spiral']);
  });

  it('registerEffect needs a name for a composition', () => {
    const world = new FakeWorld();
    const shatter = create(world);
    expect(() => {
      shatter.registerEffect({ motion: 'shatter' } as never);
    }).toThrow(/needs a name/);
  });
});
