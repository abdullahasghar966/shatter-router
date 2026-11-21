import { describe, expect, it } from 'vitest';
import { fracture, type FracturePattern, type Shard } from '../src/engine/fracture';
import { clipToBox } from '../src/engine/patterns/shared';
import { BUILT_IN_PATTERN_NAMES, PATTERNS } from '../src/engine/plugins';

/** ADR-053: every pattern cuts the viewport into convex cells that tile it exactly. */

async function load(name: string): Promise<FracturePattern> {
  const loader = PATTERNS[name];
  if (!loader) throw new Error(`no pattern ${name}`);
  return loader();
}

function convex(polygon: Float64Array): boolean {
  let sign = 0;
  const n = polygon.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = polygon[i * 2] ?? 0;
    const ay = polygon[i * 2 + 1] ?? 0;
    const bx = polygon[((i + 1) % n) * 2] ?? 0;
    const by = polygon[((i + 1) % n) * 2 + 1] ?? 0;
    const cx = polygon[((i + 2) % n) * 2] ?? 0;
    const cy = polygon[((i + 2) % n) * 2 + 1] ?? 0;
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** Inside a convex polygon (either winding), strictly. */
function contains(polygon: Float64Array, x: number, y: number): boolean {
  let sign = 0;
  const n = polygon.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = polygon[i * 2] ?? 0;
    const ay = polygon[i * 2 + 1] ?? 0;
    const bx = polygon[((i + 1) % n) * 2] ?? 0;
    const by = polygon[((i + 1) % n) * 2 + 1] ?? 0;
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

const CASES = [
  { width: 1440, height: 900, origin: { x: 700, y: 400 }, count: 160 },
  { width: 1440, height: 900, origin: { x: 3, y: 897 }, count: 400 },
  { width: 390, height: 844, origin: { x: 200, y: 120 }, count: 40 },
] as const;

describe.each(BUILT_IN_PATTERN_NAMES)('pattern %s (ADR-053)', (name) => {
  it.each(CASES)('tiles a $width×$height viewport with $count pieces', async (input) => {
    const pattern = await load(name);
    const geometry = fracture(pattern, { ...input, seed: 7 });
    const shards: readonly Shard[] = geometry.shards;
    expect(shards.length).toBeGreaterThanOrEqual(name === 'strips' ? 6 : 12);
    expect(shards.length).toBeLessThanOrEqual(input.count * 1.6);
    let area = 0;
    for (const shard of shards) {
      expect(convex(shard.polygon), 'convex').toBe(true);
      for (let i = 0; i < shard.polygon.length; i += 2) {
        expect(shard.polygon[i]).toBeGreaterThanOrEqual(-1e-6);
        expect(shard.polygon[i]).toBeLessThanOrEqual(input.width + 1e-6);
        expect(shard.polygon[i + 1]).toBeGreaterThanOrEqual(-1e-6);
        expect(shard.polygon[i + 1]).toBeLessThanOrEqual(input.height + 1e-6);
      }
      area += shard.area;
    }
    expect(area / (input.width * input.height)).toBeCloseTo(1, 6);
    // No gaps and no overlaps: each sample point lies in exactly one cell.
    for (let sy = 0; sy < 24; sy++) {
      for (let sx = 0; sx < 24; sx++) {
        const x = ((sx + 0.37) / 24) * input.width;
        const y = ((sy + 0.61) / 24) * input.height;
        const hits = shards.filter((shard) => contains(shard.polygon, x, y)).length;
        expect(hits, `point ${x.toFixed(1)},${y.toFixed(1)}`).toBe(1);
      }
    }
  });

  it('tiles exactly for 25 seeds and two impact points (jitter cases)', async () => {
    const pattern = await load(name);
    for (let seed = 0; seed < 25; seed++) {
      for (const origin of [
        { x: 640, y: 360 },
        { x: 1270, y: 15 },
      ]) {
        const input = { width: 1280, height: 720, origin, count: 90, seed };
        const { shards } = fracture(pattern, input);
        for (let sy = 0; sy < 12; sy++) {
          for (let sx = 0; sx < 12; sx++) {
            const x = ((sx + 0.43) / 12) * input.width;
            const y = ((sy + 0.57) / 12) * input.height;
            const hits = shards.filter((shard) => contains(shard.polygon, x, y)).length;
            expect(hits, `seed ${String(seed)} point ${x.toFixed(1)},${y.toFixed(1)}`).toBe(1);
          }
        }
      }
    }
  });

  it('is deterministic for a seed', async () => {
    const pattern = await load(name);
    const input = { width: 1280, height: 720, origin: { x: 500, y: 300 }, count: 120, seed: 3 };
    const a = fracture(pattern, input).shards.map((shard) => [...shard.polygon]);
    const b = fracture(pattern, input).shards.map((shard) => [...shard.polygon]);
    expect(a).toEqual(b);
  });

  // Reports the time (budget: 4 ms at 400 pieces, recorded in PROGRESS); like
  // fracture.bench, the assertion is a loose ceiling so a busy machine or a
  // parallel run does not fail it.
  it('fractures 400 pieces quickly', async () => {
    const pattern = await load(name);
    const input = { width: 1440, height: 900, origin: { x: 700, y: 400 }, count: 400 };
    for (let i = 0; i < 5; i++) fracture(pattern, { ...input, seed: i });
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      fracture(pattern, { ...input, seed: 100 + i });
      times.push(performance.now() - start);
    }
    times.sort((x, y) => x - y);
    console.warn(
      `[pattern] ${name} 400 pieces @1440x900: median ${(times[7] ?? NaN).toFixed(3)} ms`,
    );
    expect(times[7]).toBeLessThan(40);
  });
});

describe('clipToBox (ADR-053)', () => {
  it('keeps a polygon inside, cuts one that crosses, drops one outside', () => {
    expect(clipToBox([10, 10, 20, 10, 20, 20, 10, 20], 100, 100)).toEqual([
      10, 10, 20, 10, 20, 20, 10, 20,
    ]);
    const cut = clipToBox([-10, -10, 50, -10, 50, 50, -10, 50], 100, 100);
    expect(Math.min(...cut)).toBe(0);
    expect(clipToBox([200, 200, 300, 200, 300, 300], 100, 100)).toEqual([]);
  });
});
