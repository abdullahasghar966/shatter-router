import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardAttributes,
  type ShatterEffect,
} from '../../core/effect';
import { radialDirection, sizeFactor, tumbleAxis } from './common';

/** Air drag, 1/s: the blast is violent, then slows down. */
const DRAG = 3;
/** Seconds of weightless blast before gravity takes over. */
const GRAVITY_DELAY = 0.25;
/** Longest stretch along the velocity, as a fraction of the shard size. */
const MAX_STRETCH = 0.6;
/** Fraction of the motion phase after which shards fade out. */
const FADE_START = 0.55;
/** Seconds over which the stretch builds up: at t = 0 the pose is exactly at rest (ADR-047). */
const STRETCH_RAMP = 0.05;
/** Seconds the shockwave takes from the impact to the farthest corner. */
const WAVE_TRAVEL = 0.16;
/** How far the shockwave lifts the page toward the viewer at its front, px. */
const BULGE = 46;
/** Seconds the lift builds before the front arrives at a piece. */
const WAVE_WIDTH = 0.07;
/** Camera shake: amplitude in px, decay in 1/s. */
const SHAKE = 7;
const SHAKE_DECAY = 9;

/** Screen-plane position offset of a shard at `t` s (the shader's formula, for completion checks). */
function offsetAt(vx: number, vy: number, delay: number, gravity: number, t: number): Float64Array {
  const local = Math.max(0, t - delay);
  const travel = (1 - Math.exp(-DRAG * local)) / DRAG;
  const fall = Math.max(0, local - GRAVITY_DELAY);
  OFFSET[0] = vx * travel;
  OFFSET[1] = vy * travel + 0.5 * gravity * fall * fall;
  return OFFSET;
}

/** `offsetAt`'s result, reused: `isComplete` runs every frame and must not allocate (ADR-040). */
const OFFSET = new Float64Array(2);

/**
 * `explode`: the blast (ADR-054), unmistakably not `shatter`. No crack: the
 * page breaks into a spider web (`radial`), a white flash at the impact, a
 * shockwave that lifts the page toward the viewer as its front passes, a short
 * camera shake, then the pieces fly hard at the viewer, stretched along their
 * velocity, slowing with drag, and fall. Every addition is exactly zero at
 * t = 0, so the first frame is the page.
 *
 *   pos(t) = centre + v0·(1 − e^(−k t'))/k + ½ g max(0, t' − 0.25)²
 *   stretch along v: 1 + 0.6·|v(t)|/|v0|, |v(t)| = |v0|·e^(−k t'),
 *   ramped in over the first 50 ms so the motion starts exactly at rest
 *
 * Shard.a = (v0.x, v0.y, v0.z, delay), Shard.b = (axis.x, axis.y, axis.z, ω).
 */
export const explodeEffect: ShatterEffect = {
  name: 'explode',
  needsIncomingSnapshot: false,
  crack: false,
  pattern: 'radial',
  duration: 1100,

  shardAttributes(ctx: EffectContext): ShardAttributes {
    const { shards, origin, maxRadius, impulse, random } = ctx;
    const data = new Float32Array(shards.length * SHARD_ATTRIBUTE_FLOATS);
    shards.forEach((shard, i) => {
      const dir = radialDirection(shard, origin, random);
      const r = Math.min(1, dir.distance / Math.max(1, maxRadius));
      const speed = impulse * 2.4 * (1 - 0.6 * r) * (0.8 + 0.4 * random());
      const vz = impulse * (0.8 + 0.7 * random()) * (1 - 0.5 * r);
      const axis = tumbleAxis(random, 0.6);
      const omega = (4 + 6 * random()) * sizeFactor(shard, ctx) * (random() < 0.5 ? -1 : 1);
      const o = i * SHARD_ATTRIBUTE_FLOATS;
      data[o] = dir.x * speed;
      data[o + 1] = dir.y * speed;
      data[o + 2] = vz;
      // The shockwave reaches each piece in stagger order (radial: by distance).
      data[o + 3] = (ctx.order[i] ?? r) * WAVE_TRAVEL;
      data[o + 4] = axis.x;
      data[o + 5] = axis.y;
      data[o + 6] = axis.z;
      data[o + 7] = omega;
    });
    return { data };
  },

  vertexChunk: /* glsl */ `
const float DRAG = ${DRAG.toFixed(3)};
const float GRAVITY_DELAY = ${GRAVITY_DELAY.toFixed(3)};
const float MAX_STRETCH = ${MAX_STRETCH.toFixed(3)};
const float FADE_START = ${FADE_START.toFixed(3)};
const float STRETCH_RAMP = ${STRETCH_RAMP.toFixed(3)};
const float BULGE = ${BULGE.toFixed(1)};
const float WAVE_WIDTH = ${WAVE_WIDTH.toFixed(3)};
const float SHAKE = ${SHAKE.toFixed(1)};
const float SHAKE_DECAY = ${SHAKE_DECAY.toFixed(1)};

void shardMotion(Shard shard, inout Pose pose) {
  float t = max(0.0, uTime - shard.a.w);
  float decay = exp(-DRAG * t);
  float travel = (1.0 - decay) / DRAG;
  float fall = max(0.0, t - GRAVITY_DELAY);
  pose.translate = shard.a.xyz * travel + vec3(0.0, 0.5 * uGravity * fall * fall, 0.0);

  // Motion stretch along the screen-plane velocity, fading with the speed.
  vec2 v = shard.a.xy;
  float speed = length(v);
  mat3 stretch = mat3(1.0);
  if (speed > 1e-3) {
    vec3 d = vec3(v / speed, 0.0);
    float k = MAX_STRETCH * decay * min(1.0, speed / (2.0 * uImpulse)) * smoothstep(0.0, STRETCH_RAMP, t);
    stretch += k * mat3(d.x * d, d.y * d, d.z * d);
  }
  pose.rotate = stretch * axisAngle(shard.b.xyz, shard.b.w * t);
  pose.alpha = 1.0 - smoothstep(FADE_START, 1.0, uTime / uDuration);

  // The shockwave: the page lifts toward the viewer as the front approaches
  // (0 at t = 0, full where the front has arrived), then the piece flies.
  float arrive = smoothstep(shard.a.w - WAVE_WIDTH, shard.a.w, uTime) * smoothstep(0.0, 0.03, uTime);
  pose.translate.z += BULGE * arrive;
  // Camera shake: every piece moves together, decaying; sin() is 0 at t = 0.
  float shake = SHAKE * exp(-SHAKE_DECAY * uTime);
  pose.translate.xy += shake * vec2(sin(uTime * 83.0), sin(uTime * 71.0));
}
`,

  // A white flash around the impact, peaking at 35 ms and gone by 220 ms:
  // 0 at t = 0 (first-frame seam) and at the end.
  fragmentChunk: /* glsl */ `
void shardFragment(inout vec4 color) {
  float flash = smoothstep(0.0, 0.035, uTime) * (1.0 - smoothstep(0.035, 0.22, uTime));
  float near = 1.0 - smoothstep(0.0, uMaxRadius * 0.55, distance(vPos, uOrigin));
  color.rgb = mix(color.rgb, vec3(color.a), flash * (0.25 + 0.55 * near));
}
`,

  isComplete(t: number, ctx: EffectState): boolean {
    if (t >= ctx.duration) return true;
    // Done early once every shard is outside the viewport (generous margin).
    const seconds = t / 1000;
    const data = ctx.attributes;
    const { shards } = ctx;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `for...of` allocates an iterator per call in unoptimised code; this runs every frame (ADR-040)
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      if (!shard) continue;
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      const offset = offsetAt(
        data[o] ?? 0,
        data[o + 1] ?? 0,
        data[o + 3] ?? 0,
        ctx.gravity,
        seconds,
      );
      const x = shard.centroid.x + (offset[0] ?? 0);
      const y = shard.centroid.y + (offset[1] ?? 0);
      const reach = Math.sqrt(shard.area) * (2 + MAX_STRETCH);
      const inside =
        x + reach > -ctx.width * 0.5 &&
        x - reach < ctx.width * 1.5 &&
        y + reach > -ctx.height * 0.5 &&
        y - reach < ctx.height * 1.5;
      if (inside) return false;
    }
    return true;
  },
};
