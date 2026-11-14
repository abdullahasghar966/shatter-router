import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';

/** Seconds between the first shard (at the impact) and the last one starting to move. */
const STAGGER_S = 0.12;
/** Fraction of the motion phase after which shards fade out. */
const FADE_START = 0.6;

/**
 * `shatter` (default): after the crack, shards fly out from the impact point
 * (faster near it), tumble about a random axis, fall with gravity and fade.
 *
 * Per shard (master prompt 5.3):
 *   d      = normalize(centroid - origin), r = |centroid - origin| / maxR
 *   delay  = r * stagger,  t' = max(0, t - delay)
 *   v0     = d * impulse * (1 - 0.5 r) + jitter (incl. +z toward the camera)
 *   pos(t) = centroid + v0 t' + ½ g t'²,  rot(t) = axisAngle(axis, ω t')
 *   alpha  = 1 - smoothstep(fadeStart, 1, t / duration)
 *
 * Shard.a = (v0.x, v0.y, v0.z, delay), Shard.b = (axis.x, axis.y, axis.z, ω).
 */
export const shatterEffect: ShatterEffect = {
  name: 'shatter',
  needsIncomingSnapshot: false,
  crack: true,
  duration: 1000,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, impulse, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    const meanArea = (ctx.width * ctx.height) / Math.max(1, shards.length);
    shards.forEach((shard, i) => {
      const dx = shard.centroid.x - origin.x;
      const dy = shard.centroid.y - origin.y;
      const distance = Math.hypot(dx, dy);
      let ux: number;
      let uy: number;
      if (distance > 1e-3) {
        ux = dx / distance;
        uy = dy / distance;
      } else {
        const angle = random() * Math.PI * 2;
        ux = Math.cos(angle);
        uy = Math.sin(angle);
      }
      const r = Math.min(1, distance / Math.max(1, maxRadius));
      const speed = impulse * (1 - 0.5 * r) * (0.8 + 0.4 * random());
      // Jitter: a little sideways scatter, a small upward kick, and depth toward the viewer.
      const jx = (random() - 0.5) * impulse * 0.15;
      const jy = -random() * impulse * 0.12;
      const vz = impulse * (0.12 + 0.45 * random()) * (1 - 0.4 * r);

      // Tumble axis: mostly in the screen plane so faces flip toward the viewer.
      const ax = random() * 2 - 1;
      const ay = random() * 2 - 1;
      const az = (random() * 2 - 1) * 0.35;
      const axisLength = Math.hypot(ax, ay, az) || 1;
      // Smaller shards spin faster.
      const sizeFactor = Math.min(
        1.8,
        Math.max(0.6, Math.sqrt(meanArea / Math.max(1, shard.area))),
      );
      const omega = (2.5 + 4 * random()) * sizeFactor * (random() < 0.5 ? -1 : 1);

      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = ux * speed + jx;
      data[o + 1] = uy * speed + jy;
      data[o + 2] = vz;
      data[o + 3] = r * STAGGER_S;
      data[o + 4] = ax / axisLength;
      data[o + 5] = ay / axisLength;
      data[o + 6] = az / axisLength;
      data[o + 7] = omega;
    });
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

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    // Done early once every shard has fallen below the viewport.
    const seconds = t / 1000;
    const data = ctx.attributes;
    for (const shard of ctx.shards) {
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      const local = Math.max(0, seconds - (data[o + 3] ?? 0));
      const y = shard.centroid.y + (data[o + 1] ?? 0) * local + 0.5 * ctx.gravity * local * local;
      const z = Math.min((data[o + 2] ?? 0) * local, ctx.cameraZ * 0.9);
      // Project: points nearer the camera spread away from the centre.
      const scale = ctx.cameraZ / (ctx.cameraZ - z);
      const reach = Math.sqrt(shard.area) * 1.5 * scale;
      const screenY = ctx.height / 2 + (y - ctx.height / 2) * scale;
      if (screenY - reach < ctx.height) return false;
    }
    return true;
  },
};
