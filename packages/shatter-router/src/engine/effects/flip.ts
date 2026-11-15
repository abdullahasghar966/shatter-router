import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection } from './common';

/** Fraction of the motion phase over which the flips are staggered by distance. */
const STAGGER = 0.4;
/** Fraction of the motion phase one flip takes; STAGGER + FLIP <= 1 so all end by uDuration. */
const FLIP = 0.6;
/** How far a shard lifts toward the viewer halfway through its flip, CSS px. */
const LIFT = 40;

/**
 * `flip`: shards stay in place and each turns over by 180° about a random
 * axis in the screen plane, the nearest first. The front shows the outgoing
 * page, the back the incoming page; the last frame is exactly the new page.
 *
 * A Voronoi cell mirrored across a line is a different polygon, so a plain
 * half turn would not tile the screen. The back face is therefore mirrored
 * across the flip axis first: after the half turn (which mirrors again) it
 * covers its own cell exactly. It is pushed back by the glass thickness so it
 * ends in the z = 0 plane, and the angle follows a critically damped spring
 * (`settle`) that is exactly at rest from `delay + flipTime <= uDuration` on.
 * Side faces would be twisted by the mirroring and are not drawn.
 *
 * Shard.a = (axis.x, axis.y, delay, flipTime), Shard.b = unused.
 */
export const flipEffect: ShatterEffect = {
  name: 'flip',
  needsIncomingSnapshot: true,
  crack: true,
  duration: 1000,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const r = Math.min(
        1,
        radialDirection(shard, origin, random).distance / Math.max(1, maxRadius),
      );
      const angle = random() * Math.PI;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = Math.cos(angle);
      data[o + 1] = Math.sin(angle);
      data[o + 2] = r * STAGGER * total;
      data[o + 3] = FLIP * total;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float PI = 3.14159265;
const float LIFT = ${LIFT.toFixed(1)};

void shardMotion(Shard shard, inout Pose pose) {
  vec2 u = shard.a.xy;
  float angle = PI * settle(uTime - shard.a.z, shard.a.w);
  mat3 turn = axisAngle(vec3(u, 0.0), angle * uDirection);
  if (aNormal.z < -0.5) {
    // Mirror the back face across the flip axis (column-major).
    mat3 mirror = mat3(
      2.0 * u.x * u.x - 1.0, 2.0 * u.x * u.y,       0.0,
      2.0 * u.x * u.y,       2.0 * u.y * u.y - 1.0, 0.0,
      0.0,                   0.0,                   1.0);
    turn = turn * mirror;
  }
  pose.rotate = turn;
  // The back face starts at z = -thickness and ends at +thickness: pull it to 0.
  pose.translate = vec3(0.0, 0.0, -uThickness * 0.5 * (1.0 - cos(angle)) + LIFT * sin(angle));
}
`,

  fragmentChunk: /* glsl */ `
void shardFragment(inout vec4 color) {
  if (abs(vFace) < 0.5) discard;
  if (vFace < -0.5) color = glassSample(uIncoming, vUv);
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
