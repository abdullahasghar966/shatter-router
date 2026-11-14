import { describe, expect, it } from 'vitest';
import { fracture } from '../src/engine/fracture';

// Reports fracture time so the number can be recorded (master prompt 5.1:
// move fracture to a Worker only if it exceeds 4 ms at 160 shards).
// Runs with the unit tests; the assertion is a loose ceiling, not the budget,
// so a slow CI machine does not fail it.
describe('fracture timing', () => {
  it('fractures 1440x900 into 160 shards quickly', () => {
    const runs = 200;
    // Warm up the JIT.
    for (let i = 0; i < 20; i++) {
      fracture({ width: 1440, height: 900, origin: { x: 700, y: 400 }, count: 160, seed: i });
    }
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      fracture({
        width: 1440,
        height: 900,
        origin: { x: 700, y: 400 },
        count: 160,
        seed: 1000 + i,
      });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(runs / 2)] ?? NaN;
    const p95 = times[Math.floor(runs * 0.95)] ?? NaN;
    console.warn(
      `[fracture] 160 shards @1440x900: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms`,
    );
    expect(median).toBeLessThan(40);
  });
});
