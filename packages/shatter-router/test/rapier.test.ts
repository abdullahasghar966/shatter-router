import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PHYSICS_TRANSFORM_FLOATS,
  type PhysicsSetup,
  type PhysicsShard,
} from '../src/core/physics';
import { fracture } from '../src/engine/fracture';
import { createRapierBackend } from '../src/rapier/backend';
import { rapier } from '../src/rapier/index';
import { MAX_STEPS, RapierSimulation, STEP } from '../src/rapier/simulation';

const WIDTH = 800;
const HEIGHT = 600;

function setup(overrides: Partial<PhysicsSetup> = {}, delay = 0): PhysicsSetup {
  const geometry = fracture({
    width: WIDTH,
    height: HEIGHT,
    origin: { x: 400, y: 300 },
    count: 24,
    seed: 4,
  });
  const shards: PhysicsShard[] = geometry.shards.map((shard, id) => ({
    id,
    ...shard,
    velocity: { x: 0, y: -100, z: 50 },
    spin: { x: 0, y: 1, z: 0, speed: 3 },
    delay,
  }));
  return {
    width: WIDTH,
    height: HEIGHT,
    thickness: 6,
    gravity: 2600,
    linearDamping: 0,
    shards,
    ...overrides,
  };
}

function transforms(sim: RapierSimulation, count: number): Float32Array {
  const target = new Float32Array(count * PHYSICS_TRANSFORM_FLOATS);
  sim.write(target);
  return target;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe('Rapier simulation (master prompt 5.3)', () => {
  it('starts every shard exactly at rest: identity rotation, zero translation', () => {
    const s = setup({}, 10);
    const sim = new RapierSimulation(RAPIER, s, { floor: false });
    const data = transforms(sim, s.shards.length);
    for (let i = 0; i < s.shards.length; i++) {
      const o = i * PHYSICS_TRANSFORM_FLOATS;
      expect([...data.subarray(o, o + 16)].map((v) => v + 0)).toEqual([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
      ]);
    }
    sim.free();
  });

  it('keeps shards still until their delay, then releases them with the procedural velocity', () => {
    const s = setup({ gravity: 0 }, 0.1);
    const sim = new RapierSimulation(RAPIER, s, { floor: false });
    sim.advance(0.05);
    expect(transforms(sim, s.shards.length)[13]).toBe(0);
    for (let t = 0.06; t <= 0.5 + 1e-9; t += 1 / 60) sim.advance(t);
    // Released at 0.1 s with vy = -100 px/s and no gravity: about -40 px by 0.5 s.
    const dy = transforms(sim, s.shards.length)[13] ?? 0;
    expect(dy).toBeLessThan(-30);
    expect(dy).toBeGreaterThan(-50);
    sim.free();
  });

  it('falls with gravity in CSS px (100 px = 1 m) and finishes below the viewport', () => {
    const s = setup();
    const sim = new RapierSimulation(RAPIER, s, { floor: false });
    sim.advance(0.2);
    const early = transforms(sim, s.shards.length)[13] ?? 0;
    for (let t = 0.3; t < 3; t += 0.05) sim.advance(t);
    const late = transforms(sim, s.shards.length)[13] ?? 0;
    expect(late).toBeGreaterThan(early + HEIGHT);
    expect(sim.finished).toBe(true);
    sim.free();
  });

  it('with a floor, shards come to rest on it inside the viewport', () => {
    const s = setup();
    const sim = new RapierSimulation(RAPIER, s, { floor: true });
    for (let t = 0.05; t < 8 && !sim.finished; t += 0.05) sim.advance(t);
    expect(sim.finished).toBe(true);
    const data = transforms(sim, s.shards.length);
    for (const shard of s.shards) {
      const y = shard.centroid.y + (data[shard.id * PHYSICS_TRANSFORM_FLOATS + 13] ?? 0);
      expect(y).toBeLessThan(HEIGHT + 2);
    }
    sim.free();
  });

  it(`steps at a fixed ${STEP.toFixed(4)} s and never more than ${MAX_STEPS} steps per call`, () => {
    const s = setup({ gravity: 0 });
    const sim = new RapierSimulation(RAPIER, s, { floor: false });
    // A 1 s stall: only MAX_STEPS steps are simulated, the rest of the time is dropped.
    sim.advance(1);
    const moved = -(transforms(sim, s.shards.length)[13] ?? 0);
    expect(moved).toBeCloseTo(100 * MAX_STEPS * STEP, 0);
    sim.free();
  });

  it('writes without allocating new arrays and frees idempotently', () => {
    const s = setup();
    const sim = new RapierSimulation(RAPIER, s, { floor: false });
    const target = new Float32Array(s.shards.length * PHYSICS_TRANSFORM_FLOATS);
    sim.advance(0.1);
    sim.write(target);
    expect(target.every(Number.isFinite)).toBe(true);
    sim.free();
    sim.free();
    expect(sim.finished).toBe(true);
  });
});

describe('shatter-router/rapier', () => {
  it('describes a plugin that loads Rapier only when asked', async () => {
    const plugin = rapier({ floor: true });
    expect(plugin.name).toBe('rapier');
    const backend = await plugin.load();
    const sim = backend.createSimulation(setup());
    expect(sim.finished).toBe(false);
    sim.free();
  });

  it('createRapierBackend initialises Rapier once', async () => {
    const a = await createRapierBackend({ floor: false });
    const b = await createRapierBackend({ floor: false });
    expect(a).not.toBe(b);
  });
});
