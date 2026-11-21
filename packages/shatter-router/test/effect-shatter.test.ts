import { describe, expect, it } from 'vitest';
import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardInfo,
} from '../src/core/effect';
import { mulberry32 } from '../src/core/random';
import { shatterEffect } from '../src/engine/effects/shatter';
import { fracture } from '../src/engine/fracture';
import { impactPattern } from '../src/engine/patterns/impact';
import { staggerOrder } from '../src/engine/stagger';

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

function state(ctx: EffectContext): EffectState {
  return { ...ctx, attributes: shatterEffect.shardAttributes(ctx).data };
}

describe('shatter effect', () => {
  it('declares itself per the public interface', () => {
    expect(shatterEffect.name).toBe('shatter');
    expect(shatterEffect.crack).toBe(true);
    expect(shatterEffect.needsIncomingSnapshot).toBe(false);
    expect(shatterEffect.vertexChunk).toContain('void shardMotion(Shard shard, inout Pose pose)');
  });

  it('returns 8 finite floats per shard', () => {
    const ctx = context();
    const { data } = shatterEffect.shardAttributes(ctx);
    expect(data.length).toBe(ctx.shards.length * SHARD_ATTRIBUTE_FLOATS);
    for (const value of data) expect(Number.isFinite(value)).toBe(true);
  });

  it('launches shards away from the impact, nearer ones first and faster', () => {
    const ctx = context();
    const { data } = shatterEffect.shardAttributes(ctx);
    let nearSpeed = 0;
    let farSpeed = 0;
    let near = 0;
    let far = 0;
    for (const shard of ctx.shards) {
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      const vx = data[o] ?? 0;
      const vy = data[o + 1] ?? 0;
      const delay = data[o + 3] ?? -1;
      const dx = shard.centroid.x - ctx.origin.x;
      const dy = shard.centroid.y - ctx.origin.y;
      // Outward: positive projection onto the direction away from the impact (jitter aside).
      if (Math.hypot(dx, dy) > 60) expect(vx * dx + vy * dy).toBeGreaterThan(0);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(0.22 + 1e-6);
      const r = Math.hypot(dx, dy) / ctx.maxRadius;
      if (r < 0.25) {
        nearSpeed += Math.hypot(vx, vy);
        near++;
      } else if (r > 0.75) {
        farSpeed += Math.hypot(vx, vy);
        far++;
      }
      // Tumble axis is a unit vector; +z velocity heads toward the viewer.
      expect(Math.hypot(data[o + 4] ?? 0, data[o + 5] ?? 0, data[o + 6] ?? 0)).toBeCloseTo(1, 5);
      expect(data[o + 2] ?? -1).toBeGreaterThan(0);
    }
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    expect(nearSpeed / near).toBeGreaterThan(farSpeed / far);
  });

  it('is deterministic for a seeded random', () => {
    const a = shatterEffect.shardAttributes(context({ random: mulberry32(5) })).data;
    const b = shatterEffect.shardAttributes(context({ random: mulberry32(5) })).data;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is not complete at the start and is complete by the end of the duration', () => {
    const s = state(context());
    expect(shatterEffect.isComplete(0, s)).toBe(false);
    expect(shatterEffect.isComplete(200, s)).toBe(false);
    expect(shatterEffect.isComplete(1000, s)).toBe(true);
  });

  it('can finish early once every shard has fallen out of view', () => {
    const s = state(context({ gravity: 60_000, duration: 5000 }));
    expect(shatterEffect.isComplete(900, s)).toBe(true);
  });

  it('copes with a shard exactly at the impact point', () => {
    const ctx = context();
    const first = ctx.shards[0];
    if (!first) throw new Error('no shards');
    const shards = [{ ...first, centroid: ctx.origin, distance: 0 }, ...ctx.shards.slice(1)];
    const { data } = shatterEffect.shardAttributes({ ...ctx, shards });
    expect(Number.isFinite(data[0])).toBe(true);
    expect(Math.hypot(data[0] ?? 0, data[1] ?? 0)).toBeGreaterThan(0);
  });
});
