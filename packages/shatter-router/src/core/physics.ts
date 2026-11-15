import type { ShardInfo } from './effect';

/**
 * A rigid-body physics backend for the falling effects (`shatter`, `explode`),
 * master prompt 5.3. The built-in one is `rapier()` from
 * `shatter-router/rapier`; the core never imports a physics engine itself
 * (ADR-037).
 *
 * The engine hands the simulation the shards at rest and their initial
 * motion (the same velocities the procedural mode uses), steps it with a fixed
 * timestep, and reads one transform per shard each frame into a float
 * texture that the vertex shader reads with `texelFetch`: still one draw call.
 */
export interface PhysicsPlugin {
  readonly name: string;
  /**
   * Loads the simulation code and its physics engine. Called once, lazily
   * (prefetched when the browser is idle). If it rejects (offline, a CSP
   * without `'wasm-unsafe-eval'`), transitions use the procedural motion.
   */
  load(): Promise<PhysicsBackend>;
}

export interface PhysicsBackend {
  /** Builds a world for one transition. */
  createSimulation(setup: PhysicsSetup): PhysicsSimulation;
}

/** One shard's start: rest pose plus the procedural mode's initial motion. */
export interface PhysicsShard extends ShardInfo {
  /** Initial velocity, CSS px/s (+z toward the viewer). */
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  /** Unit spin axis and angular speed in rad/s. */
  readonly spin: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly speed: number;
  };
  /** Seconds after the motion starts before the shard is released. */
  readonly delay: number;
}

export interface PhysicsSetup {
  /** Viewport, CSS px. */
  readonly width: number;
  readonly height: number;
  /** Glass thickness, CSS px. */
  readonly thickness: number;
  /** px/s², positive is down. */
  readonly gravity: number;
  /** Linear damping, 1/s (air drag; `explode` uses some). */
  readonly linearDamping: number;
  readonly shards: readonly PhysicsShard[];
}

/** Floats per shard in `PhysicsSimulation.write`: a column-major mat4. */
export const PHYSICS_TRANSFORM_FLOATS = 16;

export interface PhysicsSimulation {
  /** Advances the world to `seconds` since the motion started (fixed internal steps). */
  advance(seconds: number): void;
  /**
   * Writes each shard's transform relative to its rest pose into `target`
   * (`PHYSICS_TRANSFORM_FLOATS` per shard, shard order): columns 0–2 are the
   * rotation, column 3 the translation in CSS px, and the spare fourth row
   * (floats 3, 7, 11) the linear velocity in CSS px/s (used for shading).
   * Must not allocate.
   */
  write(target: Float32Array): void;
  /** True once every shard has left the viewport (or come to rest, with a floor). */
  readonly finished: boolean;
  /** Frees the world. Idempotent. */
  free(): void;
}
