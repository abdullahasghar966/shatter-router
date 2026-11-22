import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { reach } from './common';

/** Fraction of the motion phase over which the starts are staggered. */
const STAGGER = 0.4;
/** Fraction of the motion phase one piece takes to leave; STAGGER + TRAVEL <= 1. */
const TRAVEL = 0.6;
/** How far a piece first pulls back before it goes (back-in easing overshoot). */
const ANTICIPATION = 1.3;
/** Depth between pieces that start at different times, px (no z-fighting where they overlap). */
const LAYER = 4;

/**
 * `slide` (order family, ADR-055): the page is dealt away. Flat, unlit by
 * turning, the pieces (square `tiles` by default) slide straight out of the
 * viewport, alternate rows in opposite directions, each pulling back a touch
 * before it goes, in stagger order (from the click by default). Pieces that
 * start earlier ride a few pixels above the rest, so they pass over them.
 *
 *   x(t) = dir · distance · p²((s + 1) p − s),  p = clamp((t − delay) / travel), s = 1.3
 *
 * Shard.a = (dir, distance px, delay, travel), Shard.b = (layer px, 0, 0, 0).
 */
export const slideEffect: ShatterEffect = {
  name: 'slide',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'tiles',
  duration: 1000,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, width, height } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    const row = Math.max(1, Math.sqrt((width * height) / Math.max(1, shards.length)));
    shards.forEach((shard, i) => {
      const dir = Math.floor(shard.centroid.y / row) % 2 === 0 ? -1 : 1;
      // Far enough that the trailing edge clears the viewport.
      const distance =
        (dir < 0
          ? shard.centroid.x + reach(shard, 1, 0)
          : width - shard.centroid.x + reach(shard, -1, 0)) + 24;
      const order = ctx.order[i] ?? 0;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = dir;
      data[o + 1] = distance;
      data[o + 2] = order * STAGGER * total;
      data[o + 3] = TRAVEL * total;
      data[o + 4] = LAYER * (1 - order);
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float ANTICIPATION = ${ANTICIPATION.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.z) / shard.a.w, 0.0, 1.0);
  float e = p * p * ((ANTICIPATION + 1.0) * p - ANTICIPATION);
  pose.translate = vec3(shard.a.x * shard.a.y * e, 0.0, shard.b.x * smoothstep(0.0, 0.1, p));
  pose.alpha = 1.0 - smoothstep(0.92, 1.0, p);
}
`,

  // Every piece is past the edge (and faded) by delay + travel <= duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
