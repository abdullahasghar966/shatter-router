import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { tumbleAxis } from './common';

/** Fraction of the motion phase over which the gust front crosses the page. */
const STAGGER = 0.35;
/** Turbulence: how far a piece is buffeted, px per second of flight. */
const GUST = 90;

/**
 * `wind` (force family, ADR-055): a gust blows the page away. It comes from
 * the side of the click and sweeps across (nearest pieces first by default):
 * no crack, every piece lifts a little and is carried off sideways, speeding
 * up as the air takes it, buffeted by turbulence and fluttering like paper.
 * Each piece's push is chosen so that it leaves the viewport within its
 * flight, whatever its position.
 *
 *   x(t) = ½ a t'²,  y(t) = ½ lift t'²,  plus turbulence ∝ t' (0 at rest)
 *   rot(t) = axisAngle(axis, ω t' + 0.7 sin(9 t'))
 *
 * Shard.a = (a.x, lift, delay, travel), Shard.b = (axis.x, axis.y, axis.z, ω).
 */
export const windEffect: ShatterEffect = {
  name: 'wind',
  needsIncomingSnapshot: false,
  crack: false,
  duration: 1200,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, impulse, random, width } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    // Blow away from the side of the click.
    const sign = origin.x <= width / 2 ? 1 : -1;
    shards.forEach((shard, i) => {
      const size = Math.sqrt(shard.area);
      const delay = (ctx.order[i] ?? 0) * STAGGER * total;
      const travel = Math.max(0.05, total - delay) * 0.85;
      // Far enough to clear the viewport edge, with turbulence and flutter to spare.
      const distance = (sign > 0 ? width - shard.centroid.x : shard.centroid.x) + size * 2 + 80;
      const accel = ((2 * distance) / (travel * travel)) * (1 + 0.4 * random());
      const axis = tumbleAxis(random, 0.8);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = sign * accel;
      data[o + 1] = -impulse * (0.2 + 0.6 * random());
      data[o + 2] = delay;
      data[o + 3] = travel;
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = (3 + 5 * random()) * (random() < 0.5 ? -1 : 1);
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float GUST = ${GUST.toFixed(1)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.z);
  float phase = float(shard.id) * 1.731;
  vec2 buffet = GUST * t * vec2(sin(7.0 * t + phase), sin(11.0 * t + 2.0 * phase));
  pose.translate = vec3(0.5 * shard.a.xy * t * t + buffet, 40.0 * t * sin(5.0 * t + phase));
  pose.rotate = axisAngle(shard.b.xyz, shard.b.w * t + 0.7 * sin(9.0 * t));
  pose.alpha = 1.0 - smoothstep(0.75, 1.0, t / shard.a.w);
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    // Done once every piece has finished its flight (faded, past the edge).
    const seconds = t / 1000;
    const data = ctx.attributes;
    const { shards } = ctx;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `for...of` allocates an iterator per call in unoptimised code; this runs every frame (ADR-040)
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      if (!shard) continue;
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      if (seconds < (data[o + 2] ?? 0) + (data[o + 3] ?? 0)) return false;
    }
    return true;
  },
};
