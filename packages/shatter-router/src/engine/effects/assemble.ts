import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection, sizeFactor, tumbleAxis } from './common';

/** Seconds between the first outgoing shard (at the impact) and the last starting to fall. */
const STAGGER = 0.12;
/** Fraction of the motion phase by which the outgoing shards have faded and gone. */
const FADE_END = 0.8;
/** Incoming shards start this fraction of the motion phase in, the nearest first... */
const ARRIVE_START = 0.12;
/** ...staggered by distance over this fraction... */
const ARRIVE_STAGGER = 0.25;
/** ...and take this fraction to land (ARRIVE_START + ARRIVE_STAGGER + LAND <= 1). */
const LAND = 0.6;
/** How far beyond the farthest corner the incoming shards start, as a multiple of maxRadius. */
const START_DISTANCE = 1.15;

/**
 * `assemble`: the outgoing page shatters and falls as in `shatter` (layer 0)
 * while shards of the incoming page (layer 1, the second instance of the same
 * mesh in the same draw call) fly in from off-screen, untwisting, and spring
 * into their exact rest positions with a critically damped spring (`settle`)
 * that never overshoots and is exactly at rest by `uDuration`: the last frame
 * is the new page, pixel for pixel.
 *
 * Shard.a = (v0.x, v0.y, v0.z, delay) of the outgoing shard,
 * Shard.b = (axis.x, axis.y, axis.z, ω); the incoming shard reuses the axis
 * and spin, arriving from the direction the outgoing one leaves in.
 */
export const assembleEffect: ShatterEffect = {
  name: 'assemble',
  needsIncomingSnapshot: true,
  layers: 2,
  crack: true,
  duration: 1200,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, impulse, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    shards.forEach((shard, i) => {
      const dir = radialDirection(shard, origin, random);
      const r = Math.min(1, dir.distance / Math.max(1, maxRadius));
      const speed = impulse * (1 - 0.5 * r) * (0.8 + 0.4 * random());
      const axis = tumbleAxis(random);
      const omega = (2.5 + 4 * random()) * sizeFactor(shard, ctx) * (random() < 0.5 ? -1 : 1);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = dir.x * speed + (random() - 0.5) * impulse * 0.15;
      data[o + 1] = dir.y * speed - random() * impulse * 0.12;
      data[o + 2] = impulse * (0.12 + 0.45 * random()) * (1 - 0.4 * r);
      data[o + 3] = r * STAGGER;
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = omega;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float FADE_END = ${FADE_END.toFixed(3)};
const float ARRIVE_START = ${ARRIVE_START.toFixed(3)};
const float ARRIVE_STAGGER = ${ARRIVE_STAGGER.toFixed(3)};
const float LAND = ${LAND.toFixed(3)};
const float START_DISTANCE = ${START_DISTANCE.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  if (shard.layer == 0) {
    // The outgoing page: shatter and fall, gone (not just transparent) by FADE_END.
    float t = max(0.0, uTime - shard.a.w);
    pose.translate = shard.a.xyz * t + vec3(0.0, 0.5 * uGravity * t * t, 0.0);
    pose.rotate = axisAngle(shard.b.xyz, shard.b.w * t);
    pose.alpha = 1.0 - smoothstep(0.45, FADE_END, uTime / uDuration);
    pose.scale = pose.alpha > 0.0 ? 1.0 : 0.0;
    return;
  }
  // The incoming page: fly in from beyond the corners and settle at rest.
  vec2 rel = shard.center - uOrigin;
  float distance = length(rel);
  vec2 dir = distance > 1e-3 ? rel / distance : vec2(0.0, -1.0);
  float r = min(1.0, distance / max(1.0, uMaxRadius));
  float delay = (ARRIVE_START + ARRIVE_STAGGER * r) * uDuration;
  float s = settle(uTime - delay, LAND * uDuration);
  float away = 1.0 - s;
  vec3 start = vec3(dir * uMaxRadius * START_DISTANCE, 0.5 * uMaxRadius);
  pose.translate = start * away;
  pose.rotate = axisAngle(shard.b.xyz, shard.b.w * 0.6 * away * uDirection);
  pose.alpha = uTime > delay ? smoothstep(0.0, 0.25, s) : 0.0;
}
`,

  fragmentChunk: /* glsl */ `
void shardFragment(inout vec4 color) {
  if (vLayer < 0.5) return;
  vec4 page = texture(uIncoming, vUv);
  if (abs(vFace) < 0.5) page.rgb *= 0.55;
  else if (vFace < -0.5) page.rgb *= 0.82;
  color = page;
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
