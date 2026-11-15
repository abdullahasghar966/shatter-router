import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsSetup, PhysicsShard, PhysicsSimulation } from '../core/physics';
import { PHYSICS_TRANSFORM_FLOATS } from '../core/physics';

type Rapier = typeof RAPIER;

/** World scale: 100 CSS px = 1 m keeps the solver in its comfortable range (master prompt 5.3). */
export const PX_PER_METRE = 100;
/** Fixed timestep, s. */
export const STEP = 1 / 60;
/** Most steps one `advance()` may take: a long stall drops time instead of freezing (spiral of death). */
export const MAX_STEPS = 6;
/** Colliders are shrunk about the centre so neighbours released together do not start interpenetrating. */
const HULL_SCALE = 0.92;
/** The rest transform: identity rotation, no translation. */
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Below this speed (m/s) a shard resting on the floor counts as settled. */
const REST_SPEED = 0.05;

export interface RapierSimulationOptions {
  /** A fixed floor along the bottom edge of the viewport: shards pile up on it. */
  readonly floor: boolean;
}

/**
 * One transition's rigid-body world. Bodies start disabled at the rest pose
 * and are released at their delay with the procedural mode's velocities, so
 * both modes look alike; with a floor they pile up and slide.
 */
export class RapierSimulation implements PhysicsSimulation {
  private readonly world: RAPIER.World;
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly released: boolean[] = [];
  private readonly shards: readonly PhysicsShard[];
  /** Reused by `write()` so a frame allocates nothing. */
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly rotation = { x: 0, y: 0, z: 0, w: 1 };
  private readonly velocity = { x: 0, y: 0, z: 0 };
  private time = 0;
  private freed = false;

  constructor(
    private readonly R: Rapier,
    private readonly setup: PhysicsSetup,
    private readonly options: RapierSimulationOptions,
  ) {
    const m = PX_PER_METRE;
    this.shards = setup.shards;
    this.world = new R.World({ x: 0, y: setup.gravity / m, z: 0 });
    this.world.timestep = STEP;
    const depth = setup.thickness / m;
    for (const shard of setup.shards) {
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(shard.centroid.x / m, shard.centroid.y / m, 0)
          .setLinearDamping(setup.linearDamping)
          .setCanSleep(true)
          .setEnabled(false),
      );
      this.world.createCollider(this.collider(shard, depth), body);
      this.bodies.push(body);
      this.released.push(false);
    }
    if (options.floor) {
      // A slab just below the viewport, wide and deep enough for any tumble.
      this.world.createCollider(
        R.ColliderDesc.cuboid(setup.width / m, 0.5, 10)
          .setTranslation(setup.width / 2 / m, setup.height / m + 0.5, 0)
          .setFriction(0.6),
      );
    }
  }

  /** Convex hull of the extruded cell around its centre; a box when the hull is degenerate. */
  private collider(shard: PhysicsShard, depth: number): RAPIER.ColliderDesc {
    const { R } = this;
    const m = PX_PER_METRE;
    const ring = shard.polygon;
    const corners = ring.length / 2;
    const points = new Float32Array(corners * 6);
    for (let i = 0; i < corners; i++) {
      const x = (((ring[i * 2] ?? 0) - shard.centroid.x) * HULL_SCALE) / m;
      const y = (((ring[i * 2 + 1] ?? 0) - shard.centroid.y) * HULL_SCALE) / m;
      points.set([x, y, 0, x, y, -depth], i * 6);
    }
    const hull = R.ColliderDesc.convexHull(points);
    const half = (Math.sqrt(shard.area) * HULL_SCALE) / 2 / m;
    const desc =
      hull ?? R.ColliderDesc.cuboid(half, half, depth / 2).setTranslation(0, 0, -depth / 2);
    return desc.setDensity(1).setFriction(0.6).setRestitution(0.15);
  }

  advance(seconds: number): void {
    if (this.freed) return;
    this.release(seconds);
    let steps = 0;
    while (this.time + STEP <= seconds) {
      if (steps === MAX_STEPS) {
        // Too far behind (a stalled tab): skip the rest instead of catching up.
        this.time = seconds;
        break;
      }
      this.world.step();
      this.time += STEP;
      steps += 1;
    }
  }

  /** Enables every shard whose delay has passed, with its initial motion. */
  private release(seconds: number): void {
    const m = PX_PER_METRE;
    this.shards.forEach((shard, i) => {
      if (this.released[i] || seconds < shard.delay) return;
      const body = this.bodies[i];
      if (!body) return;
      this.released[i] = true;
      body.setEnabled(true);
      const v = this.velocity;
      v.x = shard.velocity.x / m;
      v.y = shard.velocity.y / m;
      v.z = shard.velocity.z / m;
      body.setLinvel(v, true);
      const { spin } = shard;
      v.x = spin.x * spin.speed;
      v.y = spin.y * spin.speed;
      v.z = spin.z * spin.speed;
      body.setAngvel(v, true);
    });
  }

  write(target: Float32Array): void {
    const m = PX_PER_METRE;
    const p = this.position;
    const q = this.rotation;
    this.bodies.forEach((body, i) => {
      const shard = this.shards[i];
      if (!shard) return;
      const o = i * PHYSICS_TRANSFORM_FLOATS;
      if (!this.released[i]) {
        // Exactly at rest: reading the body back would cost a float32 round trip (~1e-5 px).
        target.set(IDENTITY, o);
        return;
      }
      body.translation(p);
      body.rotation(q);
      const { x, y, z, w } = q;
      // Column-major rotation from the unit quaternion.
      // The spare row carries the linear velocity in px/s (for shading).
      const v = this.velocity;
      body.linvel(v);
      target[o] = 1 - 2 * (y * y + z * z);
      target[o + 1] = 2 * (x * y + z * w);
      target[o + 2] = 2 * (x * z - y * w);
      target[o + 3] = v.x * m;
      target[o + 4] = 2 * (x * y - z * w);
      target[o + 5] = 1 - 2 * (x * x + z * z);
      target[o + 6] = 2 * (y * z + x * w);
      target[o + 7] = v.y * m;
      target[o + 8] = 2 * (x * z + y * w);
      target[o + 9] = 2 * (y * z - x * w);
      target[o + 10] = 1 - 2 * (x * x + y * y);
      target[o + 11] = v.z * m;
      // Translation relative to the rest pose, CSS px.
      target[o + 12] = p.x * m - shard.centroid.x;
      target[o + 13] = p.y * m - shard.centroid.y;
      target[o + 14] = p.z * m;
      target[o + 15] = 1;
    });
  }

  get finished(): boolean {
    if (this.freed) return true;
    const m = PX_PER_METRE;
    const v = this.velocity;
    const p = this.position;
    return this.bodies.every((body, i) => {
      if (!this.released[i]) return false;
      if (body.isSleeping()) return true;
      body.translation(p);
      const shard = this.shards[i];
      const reach = shard ? Math.sqrt(shard.area) * 1.5 : 0;
      if (p.y * m - reach > this.setup.height) return true;
      if (!this.options.floor) return false;
      body.linvel(v);
      return Math.hypot(v.x, v.y, v.z) < REST_SPEED;
    });
  }

  free(): void {
    if (this.freed) return;
    this.freed = true;
    this.world.free();
  }
}
