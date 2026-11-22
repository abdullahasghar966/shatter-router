import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection } from './common';

/** Share of the motion over which the wave front crosses the page. */
const SPREAD = 0.45;
/** Share of the motion one piece rides the waves; SPREAD + LIFE = 1. */
const LIFE = 0.55;
/** Half-waves a piece rides before it is gone. */
const WAVES = 3;

/**
 * `ripple` (matter family, ADR-055), the docs' `ripple-out` promoted: the
 * page is water and the click a dropped stone. It breaks into concentric
 * `rings`; as the wave front reaches a ring it bobs toward and away from the
 * viewer on a growing swell, tilting with the slope of the wave (so the glint
 * runs along the crests), drifts outward, shrinks and fades.
 *
 *   p = clamp((t − delay) / life);  z = lift · p · sin(3π p),  tilt = tiltMax · p · cos(3π p)
 *   drift = drift · p³,  scale = 1 − 0.35 p²,  alpha fades over the last 40 %
 *
 * Shard.a = (dir.x, dir.y, delay, life), Shard.b = (lift px, tilt rad, drift px, 0).
 */
export const rippleEffect: ShatterEffect = {
  name: 'ripple',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'rings',
  duration: 1300,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const d = radialDirection(shard, origin, random);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = d.x;
      data[o + 1] = d.y;
      data[o + 2] = (ctx.order[i] ?? 0) * SPREAD * total;
      data[o + 3] = LIFE * total;
      data[o + 4] = 150 * (0.75 + 0.5 * random());
      data[o + 5] = 0.55 * (0.8 + 0.4 * random());
      data[o + 6] = 40 + 90 * random();
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float WAVE = ${(WAVES * Math.PI).toFixed(5)};

void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.z) / shard.a.w, 0.0, 1.0);
  vec2 d = shard.a.xy;
  pose.translate = vec3(d * shard.b.z * p * p * p, shard.b.x * p * sin(WAVE * p));
  // Tilt with the slope of the wave, about the axis along the ring.
  pose.rotate = axisAngle(vec3(-d.y, d.x, 0.0), shard.b.y * p * cos(WAVE * p) * uDirection);
  pose.scale = 1.0 - 0.35 * p * p;
  pose.alpha = 1.0 - smoothstep(0.6, 1.0, p);
}
`,

  // Every piece has faded by delay + life <= duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
