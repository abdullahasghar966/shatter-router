import { describe, expect, it } from 'vitest';
import type { EffectContext, ShardInfo } from '../src/core/effect';
import { mulberry32 } from '../src/core/random';
import { explodeEffect } from '../src/engine/effects/explode';
import { shatterEffect } from '../src/engine/effects/shatter';
import { fracture } from '../src/engine/fracture';
import { impactPattern } from '../src/engine/patterns/impact';
import { staggerOrder } from '../src/engine/stagger';

/** ADR-054: `shatter` (the pane falls) and `explode` (the blast) are unmistakably different. */

function context(): EffectContext {
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
    cameraZ: 1200,
    random: mulberry32(11),
    order: staggerOrder('radial', geometry),
  };
}

/** Mean of |v| in the screen plane and of v.z over all shards. */
function speeds(data: Float32Array): { plane: number; depth: number; upward: number } {
  let plane = 0;
  let depth = 0;
  // The fastest upward speed (pieces above the impact move outward, i.e. up).
  let upward = 0;
  const n = data.length / 8;
  for (let i = 0; i < n; i++) {
    plane += Math.hypot(data[i * 8] ?? 0, data[i * 8 + 1] ?? 0);
    depth += data[i * 8 + 2] ?? 0;
    upward = Math.max(upward, -(data[i * 8 + 1] ?? 0));
  }
  return { plane: plane / n, depth: depth / n, upward };
}

describe('shatter and explode are distinct (ADR-054)', () => {
  it('shatter cracks for longer; explode does not crack and breaks into a web', () => {
    expect(shatterEffect.crack).toBe(true);
    expect(shatterEffect.crackDuration).toBeGreaterThanOrEqual(300);
    expect(explodeEffect.crack).toBe(false);
    expect(explodeEffect.pattern).toBe('radial');
    expect(shatterEffect.pattern).toBeUndefined();
  });

  it('a falling pane is thrown several times more slowly than a blast, with no upward kick', () => {
    const fall = speeds(shatterEffect.shardAttributes(context()).data);
    const blast = speeds(explodeEffect.shardAttributes(context()).data);
    expect(blast.plane / fall.plane).toBeGreaterThan(5);
    expect(blast.depth / fall.depth).toBeGreaterThan(5);
    // Outward only (0.32 × impulse at most, near the impact): no added kick.
    expect(fall.upward).toBeLessThanOrEqual(0.32 * 900 * 1.4 + 1e-6);
    expect(blast.upward).toBeGreaterThan(fall.upward * 3);
  });

  it("explode's shockwave, shake and flash are guarded to be zero at t = 0", () => {
    const motion = explodeEffect.vertexChunk;
    expect(motion).toContain('smoothstep(0.0, 0.03, uTime)');
    expect(motion).toContain('sin(uTime * 83.0)');
    expect(motion).toContain('sin(uTime * 71.0)');
    expect(explodeEffect.fragmentChunk).toContain('smoothstep(0.0, 0.035, uTime)');
    // Gone well before the motion ends (the last frame of a reverse is the page).
    expect(explodeEffect.fragmentChunk).toContain('smoothstep(0.035, 0.22, uTime)');
  });
});
