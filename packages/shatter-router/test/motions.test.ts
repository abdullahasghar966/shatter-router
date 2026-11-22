import { describe, expect, it } from 'vitest';
import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardInfo,
  type ShatterEffect,
  type Stagger,
} from '../src/core/effect';
import { mulberry32 } from '../src/core/random';
import { blindsEffect } from '../src/engine/effects/blinds';
import { reach } from '../src/engine/effects/common';
import { crumbleEffect } from '../src/engine/effects/crumble';
import { dominoEffect } from '../src/engine/effects/domino';
import { explodeEffect } from '../src/engine/effects/explode';
import { foldEffect } from '../src/engine/effects/fold';
import { glitchEffect } from '../src/engine/effects/glitch';
import { implodeEffect } from '../src/engine/effects/implode';
import { meltEffect } from '../src/engine/effects/melt';
import { rainEffect } from '../src/engine/effects/rain';
import { reverseEffect } from '../src/engine/effects/reverse';
import { rippleEffect } from '../src/engine/effects/ripple';
import { shatterEffect } from '../src/engine/effects/shatter';
import { slideEffect } from '../src/engine/effects/slide';
import { vortexEffect } from '../src/engine/effects/vortex';
import { windEffect } from '../src/engine/effects/wind';
import { fracture, type FracturePattern } from '../src/engine/fracture';
import { tilesPattern } from '../src/engine/patterns/grid';
import { impactPattern } from '../src/engine/patterns/impact';
import { staggerOrder } from '../src/engine/stagger';
import { PHYSICS_DAMPING } from '../src/engine/plugins';

/** The motion families of ADR-055. */

const WIDTH = 1440;
const HEIGHT = 900;
const ORIGIN = { x: 1100, y: 300 };

function context(
  options: {
    pattern?: FracturePattern;
    stagger?: Stagger;
    order?: (i: number) => number;
    duration?: number;
  } = {},
): EffectContext {
  const geometry = fracture(options.pattern ?? impactPattern, {
    width: WIDTH,
    height: HEIGHT,
    origin: ORIGIN,
    count: 160,
    seed: 5,
  });
  const shards: ShardInfo[] = geometry.shards.map((shard, id) => ({ id, ...shard }));
  const order = staggerOrder(options.stagger ?? 'radial', geometry);
  if (options.order) for (let i = 0; i < order.length; i++) order[i] = options.order(i);
  return {
    width: WIDTH,
    height: HEIGHT,
    origin: geometry.origin,
    maxRadius: geometry.maxRadius,
    shards,
    duration: options.duration ?? 1000,
    gravity: 2600,
    impulse: 900,
    thickness: 6,
    direction: 'forward',
    cameraZ: HEIGHT / 2 / Math.tan((40 * Math.PI) / 360),
    random: mulberry32(9),
    order,
  };
}

function state(effect: ShatterEffect, ctx: EffectContext): EffectState {
  return { ...ctx, attributes: effect.shardAttributes(ctx).data };
}

function field(data: Float32Array, shard: number, index: number): number {
  return data[shard * SHARD_ATTRIBUTE_FLOATS + index] ?? Number.NaN;
}

interface MotionCase {
  readonly effect: ShatterEffect;
  /** Where the start delay lives in the 8 floats. */
  readonly delay: number;
  /** Seconds after which a piece is gone (faded or past the edge), from its data. */
  readonly end?: (data: Float32Array, shard: number) => number;
}

const CASES: readonly MotionCase[] = [
  { effect: crumbleEffect, delay: 3 },
  { effect: rainEffect, delay: 3 },
  { effect: vortexEffect, delay: 1, end: (d, i) => field(d, i, 1) + field(d, i, 2) },
  { effect: windEffect, delay: 2, end: (d, i) => field(d, i, 2) + field(d, i, 3) },
  { effect: blindsEffect, delay: 0, end: (d, i) => field(d, i, 0) + field(d, i, 1) },
  {
    effect: dominoEffect,
    delay: 0,
    end: (d, i) => field(d, i, 0) + field(d, i, 1) + field(d, i, 2),
  },
  { effect: slideEffect, delay: 2, end: (d, i) => field(d, i, 2) + field(d, i, 3) },
  { effect: foldEffect, delay: 3, end: (d, i) => field(d, i, 3) + field(d, i, 4) },
  { effect: meltEffect, delay: 0, end: (d, i) => field(d, i, 0) + field(d, i, 1) },
  { effect: rippleEffect, delay: 2, end: (d, i) => field(d, i, 2) + field(d, i, 3) },
  { effect: glitchEffect, delay: 0, end: (d, i) => field(d, i, 0) + field(d, i, 1) },
];

describe('motion families (ADR-055)', () => {
  it.each(CASES)('$effect.name follows the public interface', ({ effect }) => {
    expect(effect.vertexChunk).toContain('void shardMotion(Shard shard, inout Pose pose)');
    if (effect.fragmentChunk) {
      expect(effect.fragmentChunk).toContain('void shardFragment(inout vec4 color)');
    }
    // They end off the page or transparent: Back reverses them with the wrapper.
    expect(effect.needsIncomingSnapshot).toBe(false);
    expect(effect.layers ?? 1).toBe(1);
  });

  it.each(CASES)('$effect.name writes 8 finite floats per piece', ({ effect }) => {
    const ctx = context();
    const { data } = effect.shardAttributes(ctx);
    expect(data.length).toBe(ctx.shards.length * SHARD_ATTRIBUTE_FLOATS);
    for (const value of data) expect(Number.isFinite(value)).toBe(true);
  });

  it.each(CASES)('$effect.name takes its start delays from ctx.order', ({ effect, delay }) => {
    const first = effect.shardAttributes(context({ order: () => 0 })).data;
    const last = effect.shardAttributes(context({ order: () => 1 })).data;
    const n = first.length / SHARD_ATTRIBUTE_FLOATS;
    for (let i = 0; i < n; i++) {
      expect(field(first, i, delay)).toBe(0);
      expect(field(last, i, delay)).toBeGreaterThan(0.1);
    }
    // A later order never starts earlier (crumble jitters its delays by ±10 %).
    const ctx = context({ order: (i) => (i % 10) / 9 });
    const data = effect.shardAttributes(ctx).data;
    for (let i = 0; i + 1 < n; i++) {
      const a = ctx.order[i] ?? 0;
      const b = ctx.order[i + 1] ?? 0;
      if (a < b) {
        expect(field(data, i, delay)).toBeLessThanOrEqual(field(data, i + 1, delay) * 1.25 + 1e-6);
      }
    }
  });

  it.each(CASES.filter((c) => c.end))(
    '$effect.name has every piece gone by the end of the phase',
    ({ effect, end }) => {
      for (const duration of [300, 1000, 2500]) {
        const ctx = context({ duration });
        const { data } = effect.shardAttributes(ctx);
        for (let i = 0; i < ctx.shards.length; i++) {
          expect(end?.(data, i)).toBeLessThanOrEqual(duration / 1000 + 1e-6);
        }
      }
    },
  );

  it.each(CASES)('$effect.name: not complete at the start, complete at the end', ({ effect }) => {
    const ctx = context();
    const s = state(effect, ctx);
    expect(effect.isComplete(0, s)).toBe(false);
    expect(effect.isComplete(ctx.duration, s)).toBe(true);
    expect(effect.isComplete(ctx.duration * 2, s)).toBe(true);
  });

  it('the gravity motions finish early once every piece is below the viewport', () => {
    for (const effect of [crumbleEffect, rainEffect]) {
      const ctx = context({
        duration: 5000,
        pattern: effect === rainEffect ? tilesPattern : undefined,
      });
      const s = state(effect, ctx);
      expect(effect.isComplete(500, s)).toBe(false);
      expect(effect.isComplete(3000, s)).toBe(true);
    }
  });

  it('crumble gives way from the bottom up and can be driven by physics', () => {
    expect(crumbleEffect.stagger).toEqual({ type: 'linear', angle: 270 });
    const ctx = context({ stagger: crumbleEffect.stagger });
    const { data } = crumbleEffect.shardAttributes(ctx);
    let lowest = 0;
    let highest = 0;
    ctx.shards.forEach((shard, i) => {
      if (shard.centroid.y > (ctx.shards[lowest]?.centroid.y ?? 0)) lowest = i;
      if (shard.centroid.y < (ctx.shards[highest]?.centroid.y ?? HEIGHT)) highest = i;
    });
    expect(field(data, lowest, 3)).toBeLessThan(field(data, highest, 3));
    // The physics layout: a = (v0, delay), b = (axis, ω), like shatter.
    expect(PHYSICS_DAMPING.crumble).toBe(0);
    for (let i = 0; i < ctx.shards.length; i++) {
      expect(Math.hypot(field(data, i, 4), field(data, i, 5), field(data, i, 6))).toBeCloseTo(1, 5);
    }
  });

  it('wind blows away from the click and pushes every piece past the edge', () => {
    for (const origin of [ORIGIN, { x: 200, y: 300 }]) {
      const ctx = { ...context(), origin };
      const { data } = windEffect.shardAttributes(ctx);
      const sign = origin.x <= WIDTH / 2 ? 1 : -1;
      ctx.shards.forEach((shard, i) => {
        const accel = field(data, i, 0);
        expect(Math.sign(accel)).toBe(sign);
        const travel = field(data, i, 3);
        const x = shard.centroid.x + 0.5 * accel * travel * travel;
        const size = Math.sqrt(shard.area);
        if (sign > 0) expect(x - size).toBeGreaterThan(WIDTH);
        else expect(x + size).toBeLessThan(0);
      });
    }
  });

  it('slide sends alternate rows opposite ways, each past its edge', () => {
    const ctx = context({ pattern: tilesPattern });
    const { data } = slideEffect.shardAttributes(ctx);
    const directions = new Set<number>();
    ctx.shards.forEach((shard, i) => {
      const dir = field(data, i, 0);
      directions.add(dir);
      // The trailing edge clears the viewport.
      const end = shard.centroid.x + dir * field(data, i, 1);
      if (dir > 0) expect(end - reach(shard, -1, 0)).toBeGreaterThan(WIDTH);
      else expect(end + reach(shard, 1, 0)).toBeLessThan(0);
    });
    expect([...directions].sort()).toEqual([-1, 1]);
  });

  it('domino, fold and melt hinge on the edge of each piece', () => {
    const ctx = context();
    const domino = dominoEffect.shardAttributes(ctx).data;
    const fold = foldEffect.shardAttributes(ctx).data;
    const melt = meltEffect.shardAttributes(ctx).data;
    ctx.shards.forEach((shard, i) => {
      // The hinge lies on the outline: between the inradius and the farthest vertex.
      for (const hinge of [field(domino, i, 3), field(fold, i, 2), field(melt, i, 2)]) {
        expect(hinge).toBeGreaterThanOrEqual(shard.inradius - 1e-3);
        expect(hinge).toBeLessThanOrEqual(Math.sqrt(shard.area) * 2);
      }
    });
  });

  it('every pose term is guarded to be at rest at t = 0', () => {
    // Progress-based motions clamp (uTime - delay) at 0; the time-based ones
    // multiply every offset by t, use sin(…t) or ramp in with smoothstep.
    expect(rainEffect.vertexChunk).toContain('smoothstep(0.0, STREAK_RAMP, t)');
    expect(rainEffect.vertexChunk).toContain('sin(shard.b.y * t)');
    expect(windEffect.vertexChunk).toContain('GUST * t *');
    expect(windEffect.vertexChunk).toContain('40.0 * t * sin(');
    expect(rippleEffect.vertexChunk).toContain('p * sin(WAVE * p)');
    expect(rippleEffect.vertexChunk).toContain('p * cos(WAVE * p)');
    expect(glitchEffect.vertexChunk).toContain('smoothstep(0.0, 0.35, p)');
    expect(glitchEffect.fragmentChunk).toContain('smoothstep(0.0, 0.12, uTime)');
    expect(glitchEffect.fragmentChunk).toContain('if (env <= 0.0');
  });

  it('the default parts make each motion read differently', () => {
    expect(rainEffect.pattern).toBe('tiles');
    expect(blindsEffect.pattern).toBe('strips');
    expect(slideEffect.pattern).toBe('tiles');
    expect(rippleEffect.pattern).toBe('rings');
    expect(glitchEffect.pattern).toBe('bricks');
    expect(blindsEffect.stagger).toBe('linear');
    expect(rainEffect.stagger).toBe('random');
    const names = CASES.map((c) => c.effect.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('reverse wrapper (ADR-047, ADR-055)', () => {
  it('keeps the base pattern and stagger, so pieces return along their paths', () => {
    expect(reverseEffect(explodeEffect).pattern).toBe('radial');
    expect(reverseEffect(blindsEffect).stagger).toBe('linear');
    expect(reverseEffect(crumbleEffect).stagger).toEqual({ type: 'linear', angle: 270 });
    expect(reverseEffect(shatterEffect).pattern).toBeUndefined();
  });

  it("reads the incoming page in the effect's own fragment work", () => {
    const fragment = reverseEffect(implodeEffect).fragmentChunk ?? '';
    expect(fragment).not.toMatch(/\buPage\b/);
    expect(fragment).toContain('texture(uIncoming');
    expect(reverseEffect(glitchEffect).fragmentChunk).not.toMatch(/\buPage\b/);
  });

  it('runs the effect’s fragment at the reversed time and never on the last frame', () => {
    const fragment = reverseEffect(glitchEffect).fragmentChunk ?? '';
    expect(fragment).toContain('if (now >= uDuration) return;');
    expect(fragment).toContain('uTime = max(0.0, uDuration - now);');
    const call = fragment.indexOf('forwardFragment(color);');
    expect(call).toBeGreaterThan(fragment.indexOf('uTime = max(0.0, uDuration - now);'));
  });
});

describe('completion from the remembered last-visible time (ADR-058)', () => {
  it.each([shatterEffect, explodeEffect, crumbleEffect, rainEffect])(
    '$name completes never earlier than the per-piece check, and at most one step later',
    (effect) => {
      const ctx = context({
        duration: 5000,
        pattern: effect === rainEffect ? tilesPattern : undefined,
      });
      const data = effect.shardAttributes(ctx).data;
      const remembered = { ...ctx, attributes: data };
      // A copy is not remembered: the effect checks every piece each time.
      const checked = { ...ctx, attributes: data.slice() };
      const firstDone = (state: EffectState): number => {
        for (let t = 0; t <= ctx.duration; t++) if (effect.isComplete(t, state)) return t;
        return Number.POSITIVE_INFINITY;
      };
      const fast = firstDone(remembered);
      const slow = firstDone(checked);
      expect(slow).toBeLessThan(ctx.duration);
      expect(fast).toBeGreaterThanOrEqual(slow);
      expect(fast - slow).toBeLessThanOrEqual(1000 / 120 + 1);
    },
  );
});
