import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from 'shatter-router';

/** Share of the motion over which the wave front crosses the page. */
const SPREAD = 0.45;
/** Share of the motion one shard takes to rise, tilt and fade (SPREAD + LIFE = 1). */
const LIFE = 0.55;
/** How far a shard rises toward the viewer at the top of its arc, CSS px. */
const LIFT = 140;

/**
 * `ripple-out`: a ring spreads from the click like a stone dropped in water.
 * When the ring reaches a shard, the shard rises toward you on an arc, tilts
 * away from the impact point, drifts outward, shrinks and fades.
 *
 * Per-shard data (two vec4 per shard, read in GLSL as `shard.a` and `shard.b`):
 *   a = (direction.x, direction.y, delay s, life s)
 *   b = (tilt in radians, drift in px, lift in px, unused)
 */
export const rippleOut: ShatterEffect = {
  name: 'ripple-out',
  // It ends with every shard faded out over the new page: no capture of it needed.
  needsIncomingSnapshot: false,
  crack: false,
  duration: 1100,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, random } = ctx;
    const seconds = ctx.duration / 1000;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    shards.forEach((shard, i) => {
      const dx = shard.centroid.x - origin.x;
      const dy = shard.centroid.y - origin.y;
      const length = Math.hypot(dx, dy);
      // A shard right under the click gets a random direction.
      const angle = random() * Math.PI * 2;
      const ux = length > 1 ? dx / length : Math.cos(angle);
      const uy = length > 1 ? dy / length : Math.sin(angle);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = ux;
      data[o + 1] = uy;
      // The wave front: shards start in stagger order (radial by default:
      // farther from the click, later), so any stagger works with it.
      data[o + 2] = (ctx.order[i] ?? 0) * SPREAD * seconds;
      data[o + 3] = LIFE * seconds;
      data[o + 4] = (0.6 + random() * 0.8) * Math.PI * 0.5;
      data[o + 5] = 60 + random() * 120;
      data[o + 6] = LIFT * (0.7 + random() * 0.6);
    });
    return { data };
  },

  // Runs for every vertex, every frame. At uTime = 0 every shard is exactly
  // at rest (progress 0), so the first frame is the page itself.
  vertexChunk: /* glsl */ `
const float PI = 3.14159265;

void shardMotion(Shard shard, inout Pose pose) {
  float local = max(0.0, uTime - shard.a.z);
  float progress = clamp(local / shard.a.w, 0.0, 1.0);
  float arc = sin(progress * PI);
  vec2 direction = shard.a.xy;
  pose.translate = vec3(direction * shard.b.y * progress * progress, shard.b.z * arc);
  // Tilt away from the impact point (about the axis across the direction).
  pose.rotate = axisAngle(vec3(-direction.y, direction.x, 0.0), shard.b.x * progress * uDirection);
  pose.scale = 1.0 - 0.6 * progress * progress;
  pose.alpha = 1.0 - smoothstep(0.55, 1.0, progress);
}
`,

  // Every shard has faded by delay + life <= duration.
  isComplete(t: number, state: EffectState): boolean {
    return t >= state.duration;
  },
};
