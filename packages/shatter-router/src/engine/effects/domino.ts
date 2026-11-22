import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { reach } from './common';

/** Fraction of the motion phase over which the cascade runs (one piece knocks the next). */
const STAGGER = 0.5;
/** Fraction of the motion phase one piece takes to tip over. */
const TIP = 0.25;

/**
 * `domino` (order family, ADR-055): a cascade. Starting at the click (by
 * default), each piece tips over about its bottom edge, its top swinging out
 * toward the viewer, faster and faster as it falls, one after another like a
 * row of dominoes; once flat it drops away and fades.
 *
 *   angle(t) = ½π · p², p = clamp((t − delay) / tip), about the hinge at the bottom edge
 *   afterwards: y += ½ g t''², alpha fades over the rest of the phase
 *
 * Shard.a = (delay, tip, fade, hinge: centre-to-bottom-edge px), Shard.b = (yaw, 0, 0, 0).
 */
export const dominoEffect: ShatterEffect = {
  name: 'domino',
  needsIncomingSnapshot: false,
  crack: false,
  duration: 1200,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((shard, i) => {
      const delay = (ctx.order[i] ?? 0) * STAGGER * total;
      const tip = TIP * total;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = delay;
      data[o + 1] = tip;
      // Faded out by the end of the phase.
      data[o + 2] = Math.max(0.02, total - delay - tip);
      data[o + 3] = reach(shard, 0, 1);
      data[o + 4] = (random() - 0.5) * 0.5;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
void shardMotion(Shard shard, inout Pose pose) {
  float t = uTime - shard.a.x;
  float p = clamp(t / shard.a.y, 0.0, 1.0);
  float angle = 1.5707963 * p * p;
  // About the hinge: translate = (I - R) * (hinge - centre); the top comes toward the viewer.
  mat3 tip = axisAngle(vec3(1.0, 0.0, 0.0), -angle);
  vec3 hinge = vec3(0.0, shard.a.w, 0.0);
  mat3 yaw = axisAngle(vec3(0.0, 0.0, 1.0), shard.b.x * p);
  pose.rotate = yaw * tip;
  pose.translate = hinge - pose.rotate * hinge;
  float fall = max(0.0, t - shard.a.y);
  pose.translate.y += 0.5 * uGravity * fall * fall;
  pose.alpha = 1.0 - smoothstep(0.0, shard.a.z, fall);
}
`,

  // Every piece has tipped, dropped and faded by delay + tip + fade = duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
