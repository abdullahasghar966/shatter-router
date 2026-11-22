import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';

/** Seconds over which the drops start (each at its stagger order). */
const SPREAD_S = 0.45;
/** Drops are heavier than glass: gravity times this. */
const WEIGHT = 1.25;
/** Longest vertical streak, as a share of the piece's height. */
const MAX_STREAK = 0.9;
/** Speed at which a streak is at full length, px/s. */
const STREAK_SPEED = 2400;
/** Seconds over which the streak builds: at t = 0 the pose is exactly at rest. */
const STREAK_RAMP = 0.06;
/** Fraction of the motion phase after which drops fade out. */
const FADE_START = 0.8;

/** Vertical offset of a drop at `t` s (the shader's formula, for completion checks). */
function dropAt(speed: number, delay: number, gravity: number, t: number): number {
  const local = Math.max(0, t - delay);
  return speed * local + 0.5 * gravity * WEIGHT * local * local;
}

/**
 * `rain` (gravity family, ADR-055): the page runs off like rain on a window.
 * No crack and no tumble: every piece drops straight down at its own moment
 * (a random order by default, on square `tiles`), speeding up and streaking
 * along its fall, with a faint sideways sway. Pairs with `strips` too: then
 * whole columns pour away.
 *
 *   y(t) = v0 t' + ½ (1.25 g) t'²,  t' = max(0, t − delay)
 *   streak: scale (1 − 0.25 k, 1 + k) with k = 0.9 · min(1, |v| / 2400), ramped in over 60 ms
 *
 * Shard.a = (0, v0, 0, delay), Shard.b = (sway px, sway rad/s, 0, 0).
 */
export const rainEffect: ShatterEffect = {
  name: 'rain',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'tiles',
  stagger: 'random',
  duration: 1200,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, impulse, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    shards.forEach((shard, i) => {
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o + 1] = impulse * (0.1 + 0.25 * random());
      data[o + 3] = (ctx.order[i] ?? 0) * SPREAD_S;
      data[o + 4] = (random() - 0.5) * 14;
      data[o + 5] = 4 + 5 * random();
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float WEIGHT = ${WEIGHT.toFixed(3)};
const float MAX_STREAK = ${MAX_STREAK.toFixed(3)};
const float STREAK_SPEED = ${STREAK_SPEED.toFixed(1)};
const float STREAK_RAMP = ${STREAK_RAMP.toFixed(3)};
const float FADE_START = ${FADE_START.toFixed(3)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.w);
  float g = uGravity * WEIGHT;
  float speed = shard.a.y + g * t;
  // sin() is 0 at t = 0: no sway at rest.
  pose.translate = vec3(shard.b.x * sin(shard.b.y * t), shard.a.y * t + 0.5 * g * t * t, 0.0);
  float k = MAX_STREAK * min(1.0, speed / STREAK_SPEED) * smoothstep(0.0, STREAK_RAMP, t);
  pose.rotate = mat3(1.0 - 0.25 * k, 0.0, 0.0, 0.0, 1.0 + k, 0.0, 0.0, 0.0, 1.0);
  pose.alpha = 1.0 - smoothstep(FADE_START, 1.0, uTime / uDuration);
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    const seconds = t / 1000;
    const data = ctx.attributes;
    const { shards } = ctx;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `for...of` allocates an iterator per call in unoptimised code; this runs every frame (ADR-040)
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      if (!shard) continue;
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      const y = shard.centroid.y + dropAt(data[o + 1] ?? 0, data[o + 3] ?? 0, ctx.gravity, seconds);
      // The streak reaches up to (1 + MAX_STREAK) times the piece's half height.
      if (y - Math.sqrt(shard.area) * (1 + MAX_STREAK) < ctx.height) return false;
    }
    return true;
  },
};
