import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection, sizeFactor, tumbleAxis } from './common';

/** Fraction of the motion phase over which the pieces are caught (nearest first). */
const STAGGER = 0.35;
/** How far the swirl flings a piece outward over its flight, share of maxRadius. */
const FLING = 0.55;
/** How high the twister lifts a piece toward the viewer, CSS px. */
const LIFT = 420;

/**
 * `vortex` (force family, ADR-055): a twister at the click. Unlike `implode`,
 * which drains the page into the point, the vortex throws it out: each piece
 * is caught by the swirl, whirls around the impact point (the inner ones
 * faster, as in a real vortex), spirals outward and up toward the viewer,
 * turning with the flow and tumbling, and fades as it is flung away.
 *
 * With p = clamp((t − delay) / travel) and e = p² (the swirl speeds up):
 *   angle(t) = θ0 + spin·e,  radius(t) = r0 + 0.55·maxR·e,  z(t) = lift·e
 *
 * Shard.a = (spin, delay, travel, lift), Shard.b = (axis.x, axis.y, axis.z, ω).
 */
export const vortexEffect: ShatterEffect = {
  name: 'vortex',
  needsIncomingSnapshot: false,
  crack: true,
  duration: 1200,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const dir = radialDirection(shard, origin, random);
      const r = Math.min(1, dir.distance / Math.max(1, maxRadius));
      const delay = (ctx.order[i] ?? r) * STAGGER * total;
      const travel = Math.max(0.05, total - delay) * (0.9 + 0.1 * random());
      // Angular speed falls off with the distance: the eye spins fastest.
      const spin = (1.1 + 1.4 / (0.35 + r) + 0.3 * random()) * Math.PI;
      const axis = tumbleAxis(random, 0.4);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = spin;
      data[o + 1] = delay;
      data[o + 2] = travel;
      data[o + 3] = LIFT * (0.6 + 0.8 * random());
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = (2 + 3 * random()) * sizeFactor(shard, ctx);
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float FLING = ${FLING.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.y);
  float p = clamp(t / shard.a.z, 0.0, 1.0);
  float e = p * p;
  vec2 rel = shard.center - uOrigin;
  float r0 = length(rel);
  float swirl = shard.a.x * e * uDirection;
  float theta = atan(rel.y, rel.x) + swirl;
  vec2 target = uOrigin + (r0 + FLING * uMaxRadius * e) * vec2(cos(theta), sin(theta));
  pose.translate = vec3(target - shard.center, shard.a.w * e);
  // Turning with the flow, plus a tumble of its own.
  pose.rotate = axisAngle(vec3(0.0, 0.0, 1.0), swirl) * axisAngle(shard.b.xyz, shard.b.w * t * p);
  pose.alpha = 1.0 - smoothstep(0.55, 1.0, p);
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    // Done once every piece has faded out (p = 1).
    const seconds = t / 1000;
    const data = ctx.attributes;
    const { shards } = ctx;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `for...of` allocates an iterator per call in unoptimised code; this runs every frame (ADR-040)
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      if (!shard) continue;
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      if (seconds < (data[o + 1] ?? 0) + (data[o + 2] ?? 0)) return false;
    }
    return true;
  },
};
