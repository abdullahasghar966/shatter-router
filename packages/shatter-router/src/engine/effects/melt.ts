import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { reach } from './common';

/** Fraction of the motion phase over which the melt spreads (from the click by default). */
const STAGGER = 0.35;
/** Longest drip: the piece is stretched to 1 + this times its height. */
const STRETCH = 2.4;
/** How far the drips run down at the end, share of the viewport height. */
const DROP = 0.75;

/**
 * `melt` (matter family, ADR-055): the page melts like wax under a heat
 * source at the click. No crack: each piece sags, its top held while the rest
 * stretches down into a drip that runs, thins and fades; neighbouring columns
 * drip at different speeds, so the page runs off in uneven curtains.
 *
 *   e = p², p = clamp((t − delay) / travel);  stretch sy = 1 + 2.4·e·drip, sx = 1 − 0.2·e,
 *   anchored at the top edge, then the drip runs down by 0.75·height·p³·drip
 *
 * Shard.a = (delay, travel, top reach px, drip 0.35..1), Shard.b = (layer px, 0, 0, 0).
 */
export const meltEffect: ShatterEffect = {
  name: 'melt',
  needsIncomingSnapshot: false,
  crack: false,
  duration: 1300,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    // Two slow waves across the page set how fast each column drips.
    const phase = random() * Math.PI * 2;
    shards.forEach((shard, i) => {
      const x = shard.centroid.x;
      const wave =
        (0.5 + 0.5 * Math.sin(x * 0.011 + phase)) * (0.6 + 0.4 * Math.sin(x * 0.037 + 2 * phase));
      const delay = (ctx.order[i] ?? 0) * STAGGER * total;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = delay;
      data[o + 1] = Math.max(0.05, total - delay);
      data[o + 2] = reach(shard, 0, -1);
      data[o + 3] = 0.35 + 0.65 * Math.max(0, Math.min(1, wave * (0.85 + 0.3 * random())));
      data[o + 4] = 1 + 5 * random();
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float STRETCH = ${STRETCH.toFixed(3)};
const float DROP = ${DROP.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.x) / shard.a.y, 0.0, 1.0);
  float e = p * p;
  float drip = shard.a.w;
  float sy = 1.0 + STRETCH * e * drip;
  pose.rotate = mat3(1.0 - 0.2 * e, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 1.0);
  // Hold the top edge where it was, then let the drip run.
  float run = DROP * uViewport.y * p * e * drip;
  pose.translate = vec3(0.0, (sy - 1.0) * shard.a.z + run, shard.b.x * smoothstep(0.0, 0.1, p));
  pose.alpha = 1.0 - smoothstep(0.5, 1.0, p);
}
`,

  // Every drip has run and faded by delay + travel = duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
