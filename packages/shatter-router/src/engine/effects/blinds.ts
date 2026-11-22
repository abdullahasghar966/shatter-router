import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';

/** Fraction of the motion phase over which the turns are staggered. */
const STAGGER = 0.45;
/** Fraction of the motion phase one turn takes; STAGGER + TURN <= 1. */
const TURN = 0.55;

/**
 * `blinds` (order family, ADR-055): venetian blinds. The page is cut into
 * vertical `strips` that turn about their own vertical axis one after
 * another (left to right by default), edge-on to the viewer, fading as they
 * close so the new page shows between the slats. On other patterns every
 * piece turns the same way, like louvres.
 *
 *   angle(t) = ½π · smoothstep(0, 1, (t − delay) / turn),  alpha fades over the second half
 *
 * Shard.a = (delay, turn, 0, 0), Shard.b = unused.
 */
export const blindsEffect: ShatterEffect = {
  name: 'blinds',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'strips',
  stagger: 'linear',
  duration: 1000,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    for (let i = 0; i < shards.length; i++) {
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = (ctx.order[i] ?? 0) * STAGGER * total;
      data[o + 1] = TURN * total;
    }
    return { data };
  },

  vertexChunk: /* glsl */ `
void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.x) / shard.a.y, 0.0, 1.0);
  float turn = smoothstep(0.0, 1.0, p);
  pose.rotate = axisAngle(vec3(0.0, 1.0, 0.0), 1.5707963 * turn * uDirection);
  pose.alpha = 1.0 - smoothstep(0.45, 1.0, p);
}
`,

  // Every slat has closed and faded by delay + turn <= duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
