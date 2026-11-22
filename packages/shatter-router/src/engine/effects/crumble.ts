import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { sizeFactor, tumbleAxis, finished, rememberLastVisible, type Visible } from './common';

/** Seconds between the first piece (bottom) and the last (top) giving way. */
const STAGGER_S = 0.5;
/** Fraction of the motion phase after which pieces fade out. */
const FADE_START = 0.72;

/** Still on screen at `seconds`: above the bottom edge, after perspective (ADR-058). */
const visible: Visible = (data, shard, seconds, ctx) => {
  const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
  const local = Math.max(0, seconds - (data[o + 3] ?? 0));
  const y = shard.centroid.y + (data[o + 1] ?? 0) * local + 0.5 * ctx.gravity * local * local;
  const z = Math.min((data[o + 2] ?? 0) * local, ctx.cameraZ * 0.9);
  const scale = ctx.cameraZ / (ctx.cameraZ - z);
  const extent = Math.sqrt(shard.area) * 1.5 * scale;
  return ctx.height / 2 + (y - ctx.height / 2) * scale - extent < ctx.height;
};

/**
 * `crumble` (gravity family, ADR-055): the pane gives way from the bottom up,
 * like a wall whose footing is gone. A short crack, then the lowest row drops
 * first and each row above follows, almost straight down: no outward throw, a
 * little sideways scatter, a slow lean toward the viewer and a lazy tumble.
 * Its default stagger runs bottom to top (`linear` at 270°), so the click
 * only decides where the cracks start; any stagger can replace it.
 *
 * The motion is `shatter`'s closed form, so a physics backend can drive it:
 *   pos(t) = centre + v0 t' + ½ g t'²,  rot(t) = axisAngle(axis, ω t'),  t' = max(0, t − delay)
 *
 * Shard.a = (v0.x, v0.y, v0.z, delay), Shard.b = (axis.x, axis.y, axis.z, ω).
 */
export const crumbleEffect: ShatterEffect = {
  name: 'crumble',
  needsIncomingSnapshot: false,
  crack: true,
  crackDuration: 200,
  stagger: { type: 'linear', angle: 270 },
  duration: 1250,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, impulse, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    shards.forEach((shard, i) => {
      const axis = tumbleAxis(random, 0.5);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      // Rubble: a little sideways scatter, a small push down, a slow lean out.
      data[o] = (random() - 0.5) * impulse * 0.12;
      data[o + 1] = random() * impulse * 0.08;
      data[o + 2] = impulse * (0.02 + 0.1 * random());
      data[o + 3] = (ctx.order[i] ?? 0) * STAGGER_S * (0.9 + 0.2 * random());
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = (0.8 + 1.6 * random()) * sizeFactor(shard, ctx) * (random() < 0.5 ? -1 : 1);
    });
    rememberLastVisible(data, ctx, visible);
    return { data };
  },

  vertexChunk: /* glsl */ `
const float FADE_START = ${FADE_START.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.w);
  pose.translate = shard.a.xyz * t + vec3(0.0, 0.5 * uGravity * t * t, 0.0);
  pose.rotate = axisAngle(shard.b.xyz, shard.b.w * t);
  pose.alpha = 1.0 - smoothstep(FADE_START, 1.0, uTime / uDuration);
}
`,

  // Done at the end of the phase, or early once every piece is below the viewport (ADR-058).
  isComplete(t: number, ctx: EffectState): boolean {
    return finished(t, ctx, visible);
  },
};
