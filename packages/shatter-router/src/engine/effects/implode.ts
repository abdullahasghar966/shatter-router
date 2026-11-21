import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection, sizeFactor, tumbleAxis } from './common';

/** Fraction of the motion phase over which the start is staggered (nearest shards first). */
const STAGGER = 0.3;
/** How far shards sink away from the viewer into the point, CSS px. */
const SINK = 160;
/** Strength of the lensing pull on the texture near the point (fraction of the viewport). */
const LENS = 0.035;

/**
 * `implode`: shards spiral into the impact point like a black hole, with
 * tangential and inward motion, shrinking to nothing as they arrive, and a
 * brief lensing pull on the glass near the point.
 *
 * Per shard, with p = clamp((t − delay) / travel) and e = p² (accelerating in):
 *   radius(t) = r0·(1 − e),  angle(t) = θ0 + spin·e,  scale = 1 − e
 *
 * Shard.a = (spin, delay, travel, ω), Shard.b = (axis.x, axis.y, axis.z, 0).
 */
export const implodeEffect: ShatterEffect = {
  name: 'implode',
  needsIncomingSnapshot: false,
  crack: true,
  duration: 1000,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const dir = radialDirection(shard, origin, random);
      const r = Math.min(1, dir.distance / Math.max(1, maxRadius));
      const delay = (ctx.order[i] ?? r) * STAGGER * total;
      const travel = Math.max(0.05, total - delay) * (0.85 + 0.15 * random());
      // All shards swirl the same way, a bit more than a turn for the far ones.
      const spin = (1.2 + 1.6 * r + 0.4 * random()) * Math.PI;
      const axis = tumbleAxis(random, 0.5);
      const omega = (2 + 3 * random()) * sizeFactor(shard, ctx);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = spin;
      data[o + 1] = delay;
      data[o + 2] = travel;
      data[o + 3] = omega;
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = 0;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float SINK = ${SINK.toFixed(1)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.y);
  float p = clamp(t / shard.a.z, 0.0, 1.0);
  float e = p * p;
  vec2 rel = shard.center - uOrigin;
  float r0 = length(rel);
  float theta = atan(rel.y, rel.x) + shard.a.x * e * uDirection;
  vec2 target = uOrigin + r0 * (1.0 - e) * vec2(cos(theta), sin(theta));
  pose.translate = vec3(target - shard.center, -SINK * e);
  pose.rotate =
    axisAngle(vec3(0.0, 0.0, 1.0), shard.a.x * e * uDirection) * axisAngle(shard.b.xyz, shard.a.w * t);
  pose.scale = 1.0 - e;
  pose.alpha = 1.0 - smoothstep(0.85, 1.0, p);
}
`,

  fragmentChunk: /* glsl */ `
const float LENS = ${LENS.toFixed(4)};

void shardFragment(inout vec4 color) {
  // Lensing: late in the fall, the glass near the point pulls its picture inward.
  float pulse = sin(3.14159265 * clamp((uTime / uDuration - 0.5) / 0.5, 0.0, 1.0));
  if (pulse <= 0.0 || abs(vFace) < 0.5) return;
  vec2 toPoint = (uOrigin - vPos) / uViewport;
  float near = exp(-dot(toPoint, toPoint) * 40.0);
  vec2 uv = vUv + toPoint * LENS * pulse * near / max(length(toPoint), 1e-3);
  vec4 bent = texture(uPage, clamp(uv, vec2(0.0), vec2(1.0)));
  color = mix(color, bent, near * pulse);
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    // Done once every shard has arrived (scale 0) at the point.
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
