import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';

/** Fraction of the motion phase over which pieces start glitching. */
const STAGGER = 0.3;
/** Glitch frames per second: offsets jump instead of gliding. */
const RATE = 24;
/** Largest sideways jump of a piece, px. */
const JUMP = 90;
/** Largest red/blue split, px. */
const SPLIT = 9;

/**
 * `glitch` (matter family, ADR-055): a corrupted signal. No crack and nothing
 * falls: the page is cut into rows (`bricks`) that jump sideways in hard
 * steps, 24 times a second, further and further, stretched now and then,
 * while the picture splits into red and blue and scanlines show; piece by
 * piece the rows drop out, until nothing is left.
 *
 * With p = clamp((t − delay) / life) and the step k = floor(24 t):
 *   x = 90 · g · (h(id, k) − 0.5) · 2 for about half the pieces at each step, g = smoothstep(0, 0.35, p)
 *   visible while h'(id, k) < 1 − p² (so all are gone at p = 1)
 *
 * Shard.a = (delay, life, seed, 0), Shard.b = unused.
 */
export const glitchEffect: ShatterEffect = {
  name: 'glitch',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'bricks',
  stagger: 'random',
  duration: 900,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const total = ctx.duration / 1000;
    shards.forEach((_, i) => {
      const delay = (ctx.order[i] ?? 0) * STAGGER * total;
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = delay;
      data[o + 1] = Math.max(0.05, total - delay);
      data[o + 2] = random() * 97;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float RATE = ${RATE.toFixed(1)};
const float JUMP = ${JUMP.toFixed(1)};

float glitchHash(float x) {
  return fract(sin(x * 12.9898) * 43758.5453);
}

void shardMotion(Shard shard, inout Pose pose) {
  float p = clamp((uTime - shard.a.x) / shard.a.y, 0.0, 1.0);
  float g = smoothstep(0.0, 0.35, p);
  float k = floor(uTime * RATE);
  float s = shard.a.z + k * 7.13;
  float jumps = step(0.45, glitchHash(s + 1.0));
  pose.translate = vec3(JUMP * g * jumps * (glitchHash(s) * 2.0 - 1.0), 6.0 * g * (glitchHash(s + 2.0) - 0.5), 0.0);
  float wide = 1.0 + 0.35 * g * step(0.8, glitchHash(s + 3.0));
  pose.rotate = mat3(wide, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
  pose.alpha = glitchHash(s + 4.0) < 1.0 - p * p ? 1.0 : 0.0;
}
`,

  // The red/blue split and scanlines: exactly the engine's colour at t = 0.
  fragmentChunk: /* glsl */ `
const float SPLIT = ${SPLIT.toFixed(1)};

void shardFragment(inout vec4 color) {
  float env = smoothstep(0.0, 0.12, uTime);
  if (env <= 0.0 || vFace < 0.5) return;
  float k = floor(uTime * ${RATE.toFixed(1)});
  float band = floor(vPos.y / 14.0);
  float h = fract(sin((k * 3.7 + band) * 12.9898) * 43758.5453);
  vec2 offset = vec2(SPLIT * env * (0.3 + 0.7 * h), 0.0) / uViewport;
  float red = texture(uPage, vUv + offset).r;
  float blue = texture(uPage, vUv - offset).b;
  color = vec4(min(red, color.a), color.g, min(blue, color.a), color.a);
  color.rgb *= 1.0 - 0.14 * env * step(2.0, mod(gl_FragCoord.y, 3.0));
}
`,

  // Every row has dropped out by delay + life = duration.
  isComplete(t: number, ctx: EffectState): boolean {
    return t >= ctx.duration;
  },
};
