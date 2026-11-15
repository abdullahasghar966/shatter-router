import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { PHYSICS_TRANSFORM_FLOATS, type PhysicsShard } from '../src/core/physics';
import { fracture } from '../src/engine/fracture';
import { RapierSimulation, STEP } from '../src/rapier/simulation';

// Reports the cost of one frame of physics (one fixed step plus the transform
// write) at 160 shards, so the number can be recorded in PROGRESS. The
// assertion is a loose ceiling so a slow CI machine does not fail it.
beforeAll(async () => {
  await RAPIER.init();
});

function shards(): PhysicsShard[] {
  const geometry = fracture({
    width: 1440,
    height: 900,
    origin: { x: 700, y: 400 },
    count: 160,
    seed: 9,
  });
  return geometry.shards.map((shard, id) => ({
    id,
    ...shard,
    velocity: { x: (shard.centroid.x - 700) * 1.5, y: (shard.centroid.y - 400) * 1.5, z: 200 },
    spin: { x: 0.6, y: 0.8, z: 0, speed: 4 },
    delay: 0,
  }));
}

describe('rapier step timing', () => {
  for (const floor of [false, true]) {
    it(`steps 160 shards ${floor ? 'with' : 'without'} a floor within a frame budget`, () => {
      const pieces = shards();
      const sim = new RapierSimulation(
        RAPIER,
        { width: 1440, height: 900, thickness: 6, gravity: 2600, linearDamping: 0, shards: pieces },
        { floor },
      );
      const target = new Float32Array(pieces.length * PHYSICS_TRANSFORM_FLOATS);
      const times: number[] = [];
      for (let frame = 1; frame <= 120; frame++) {
        const start = performance.now();
        sim.advance(frame * STEP);
        sim.write(target);
        times.push(performance.now() - start);
      }
      sim.free();
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)] ?? NaN;
      const p95 = times[Math.floor(times.length * 0.95)] ?? NaN;
      console.warn(
        `[rapier] 160 shards, floor ${String(floor)}: median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms per frame (Node ${process.version})`,
      );
      expect(median).toBeLessThan(16);
    });
  }
});
