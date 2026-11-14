/**
 * The public effect plugin interface (master prompt, section 6).
 *
 * An effect decides how each shard moves. The engine breaks the page into
 * Voronoi shards, asks the effect for 8 floats of per-shard data, uploads them
 * to a float texture and runs the effect's GLSL `shardMotion` function in the
 * vertex shader for every vertex of every shard, every frame. All built-in
 * effects are written against this interface only.
 *
 * ## GLSL hook: `vertexChunk`
 *
 * The chunk must define:
 *
 * ```glsl
 * void shardMotion(Shard shard, inout Pose pose);
 * ```
 *
 * `pose` starts as the rest pose (`translate = vec3(0)`, `rotate = mat3(1)`,
 * `scale = 1`, `alpha = 1`). Set whatever the effect needs. At `uTime == 0`
 * the effect must leave the rest pose untouched, so the first frame is the
 * page itself (seam guarantee).
 *
 * ```glsl
 * struct Shard {
 *   int id;          // 0 .. shardCount-1, the index into ctx.shards
 *   vec2 center;     // rest position of the shard's centre, CSS px, y down
 *                    // (not "centroid": that is a reserved word in GLSL ES 3.00)
 *   vec4 a;          // floats 0..3 of this shard's ShardAttributes
 *   vec4 b;          // floats 4..7
 * };
 * struct Pose {
 *   vec3 translate;  // CSS px, added to the centroid; +z points at the viewer
 *   mat3 rotate;     // rotation about the centroid
 *   float scale;     // uniform scale about the centroid
 *   float alpha;     // 0..1 opacity
 * };
 * ```
 *
 * Uniforms available to the chunk:
 *
 * | Uniform | Type | Meaning |
 * |---|---|---|
 * | `uTime` | float | seconds since the motion phase started |
 * | `uDuration` | float | motion phase length in seconds |
 * | `uOrigin` | vec2 | impact point, CSS px |
 * | `uViewport` | vec2 | viewport size, CSS px |
 * | `uMaxRadius` | float | distance from the impact point to the farthest corner |
 * | `uGravity` | float | px/s², positive is down |
 * | `uImpulse` | float | px/s |
 * | `uDirection` | float | 1 for forward navigation, -1 for back |
 *
 * Helper functions: `mat3 axisAngle(vec3 axis, float angle)`.
 * Positions are clamped so nothing crosses the camera's near plane.
 *
 * ## GLSL hook: `fragmentChunk` (optional)
 *
 * May define `void shardFragment(inout vec4 color);`, called with the
 * premultiplied page colour before the pose's alpha is applied. Varyings:
 * `vUv` (texture coordinate), `vPos` (rest position, CSS px), `vNormal`
 * (rotated normal), `vAlpha`. Uniforms as above plus `sampler2D uPage`.
 */

import type { Random } from './random';

export type { Random } from './random';

export interface EffectPoint {
  readonly x: number;
  readonly y: number;
}

/** One shard at rest, as handed to an effect. */
export interface ShardInfo {
  /** Index of the shard; matches `Shard.id` in GLSL. */
  readonly id: number;
  readonly centroid: EffectPoint;
  /** Area in CSS px². */
  readonly area: number;
  /** Distance from the centroid to the nearest edge, CSS px. */
  readonly inradius: number;
  /** Distance from the impact point to the centroid, CSS px. */
  readonly distance: number;
  /** Outline `[x0, y0, x1, y1, …]`, counter-clockwise on screen. */
  readonly polygon: Float64Array;
}

/** Input to `seedPoints`: where to place the Voronoi seeds. */
export interface FractureContext {
  readonly width: number;
  readonly height: number;
  readonly origin: EffectPoint;
  /** Requested shard count (already clamped). */
  readonly count: number;
  readonly random: Random;
}

/** Everything an effect knows when it builds per-shard data and decides completion. */
export interface EffectContext {
  readonly width: number;
  readonly height: number;
  readonly origin: EffectPoint;
  readonly maxRadius: number;
  readonly shards: readonly ShardInfo[];
  /** Motion phase length in ms. */
  readonly duration: number;
  /** px/s², positive is down. */
  readonly gravity: number;
  /** px/s. */
  readonly impulse: number;
  /** Glass thickness, CSS px. */
  readonly thickness: number;
  readonly direction: 'forward' | 'back';
  /** Camera distance from the z = 0 plane, CSS px (for projecting positions). */
  readonly cameraZ: number;
  readonly random: Random;
}

/** Floats per shard in `ShardAttributes.data`: two vec4 (`Shard.a`, `Shard.b`). */
export const SHARD_ATTRIBUTE_FLOATS = 8;

export interface ShardAttributes {
  /** `SHARD_ATTRIBUTE_FLOATS` floats per shard, in shard order. */
  readonly data: Float32Array;
}

/** The context plus the data `shardAttributes` returned, for completion checks. */
export interface EffectState extends EffectContext {
  /** The `ShardAttributes.data` of this transition. */
  readonly attributes: Float32Array;
}

export interface ShatterEffect {
  /** Unique name, used by `effect: '<name>'` and `data-shatter-effect`. */
  readonly name: string;
  /** True when the effect also needs a capture of the incoming page (flip, assemble). */
  readonly needsIncomingSnapshot: boolean;
  /** Play crack propagation before the motion starts. */
  readonly crack: boolean;
  /** Preferred motion length in ms when the user did not set `duration`. */
  readonly duration?: number;
  /** Custom seed layout `[x0, y0, x1, y1, …]`; default is impact-biased blue noise. */
  seedPoints?(ctx: FractureContext): Float32Array;
  /** Per-shard data for the vertex shader. */
  shardAttributes(ctx: EffectContext): ShardAttributes;
  /** GLSL defining `void shardMotion(Shard shard, inout Pose pose)`. */
  readonly vertexChunk: string;
  /** Optional GLSL defining `void shardFragment(inout vec4 color)`. */
  readonly fragmentChunk?: string;
  /**
   * True once the effect is finished at `t` ms into the motion phase: every
   * shard has left the viewport or is fully transparent (or, for assembling
   * effects, has settled at rest). The overlay is removed in that frame.
   */
  isComplete(t: number, state: EffectState): boolean;
}
