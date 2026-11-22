import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection, reach } from './common';

/** Fraction of the motion phase over which the folds are staggered. */
const STAGGER = 0.4;
/** Fraction of the motion phase one fold takes; STAGGER + FOLD <= 1. */
const FOLD = 0.6;
/** Depth between pieces folding at different times, px: later folds land on top. */
const LAYER = 6;

/**
 * `fold` (order family, ADR-055): origami. The creases appear first; then
 * every piece folds over toward the click about its edge that faces it, like
 * paper creased toward a point: it lifts, turns over by 180° and lands on the
 * impact side, the nearest first, the later ones on top, fading as they land
 * so the new page shows through. Unlike `flip`, a piece turns about an edge,
 * not its centre, and changes place.
 *
 *   angle(t) = −π · smoothstep(0, 1, p),  p = clamp((t − delay) / fold),
 *   about the hinge h = −d · reach(−d), axis = d rotated by 90°, d = from the click to the piece
 *
 * Shard.a = (axis.x, axis.y, hinge px, delay), Shard.b = (fold s, layer px, 0, 0).
 */
export const foldEffect: ShatterEffect = {
  name: 'fold',
  needsIncomingSnapshot: false,
  crack: true,
  crackDuration: 220,
  duration: 1100,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const d = radialDirection(shard, origin, random);
      const order = ctx.order[i] ?? 0;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = -d.y;
      data[o + 1] = d.x;
      data[o + 2] = reach(shard, -d.x, -d.y);
      data[o + 3] = order * STAGGER * total;
      data[o + 4] = FOLD * total;
      data[o + 5] = LAYER * (0.5 + order);
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.w) / shard.b.x, 0.0, 1.0);
  float e = smoothstep(0.0, 1.0, p);
  vec3 axis = vec3(shard.a.xy, 0.0);
  // The hinge: the piece's edge toward the click (d = axis turned back by 90°).
  vec3 hinge = vec3(axis.y, -axis.x, 0.0) * -shard.a.z;
  pose.rotate = axisAngle(axis, -3.14159265 * e);
  pose.translate = hinge - pose.rotate * hinge + vec3(0.0, 0.0, shard.b.y * e);
  pose.alpha = 1.0 - smoothstep(0.55, 1.0, p);
}
`,

  // Every piece has folded and faded by delay + fold <= duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
