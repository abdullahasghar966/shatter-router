import { describe, expect, it } from 'vitest';
import {
  buildMesh,
  clampShardCount,
  deviceTier,
  farthestCorner,
  FLOATS_PER_VERTEX,
  fracture,
  MAX_SHARDS,
  MIN_SHARDS,
  sampleSeeds,
  TIER_SHARDS,
  VERTEX_LAYOUT,
  voronoiShards,
} from '../src/engine/fracture';

const W = 1440;
const H = 900;

function signedArea(ring: Float64Array): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    twice += (ring[i] ?? 0) * (ring[j + 1] ?? 0) - (ring[j] ?? 0) * (ring[i + 1] ?? 0);
  }
  return twice / 2;
}

describe('fracture geometry', () => {
  const origins = [
    { x: 720, y: 450 },
    { x: 3, y: 4 },
    { x: W, y: H },
    { x: 1200, y: 120 },
  ];

  it.each(origins)('conserves area within 0.01 % (origin %o)', (origin) => {
    for (const count of [12, 40, 160, 400]) {
      const geometry = fracture({ width: W, height: H, origin, count, seed: 7 });
      const total = geometry.shards.reduce((sum, shard) => sum + shard.area, 0);
      expect(Math.abs(total - W * H) / (W * H)).toBeLessThan(1e-4);
    }
  });

  it('gives every cell at least 3 vertices and a counter-clockwise (on screen) ring', () => {
    const geometry = fracture({
      width: W,
      height: H,
      origin: { x: 500, y: 300 },
      count: 160,
      seed: 1,
    });
    for (const shard of geometry.shards) {
      expect(shard.polygon.length / 2).toBeGreaterThanOrEqual(3);
      // y-down screen: counter-clockwise on screen has a negative shoelace sum.
      expect(signedArea(shard.polygon)).toBeLessThan(0);
      // Closed duplicate removed: first vertex is not repeated at the end.
      const n = shard.polygon.length;
      expect(
        shard.polygon[0] === shard.polygon[n - 2] && shard.polygon[1] === shard.polygon[n - 1],
      ).toBe(false);
    }
  });

  it('keeps every UV in [0, 1] and every vertex inside the viewport', () => {
    const geometry = fracture({ width: W, height: H, origin: { x: 0, y: 0 }, count: 400, seed: 3 });
    const { vertices, vertexCount } = geometry;
    for (let v = 0; v < vertexCount; v++) {
      const o = v * FLOATS_PER_VERTEX;
      const x = vertices[o + VERTEX_LAYOUT.position.offset] ?? NaN;
      const y = vertices[o + VERTEX_LAYOUT.position.offset + 1] ?? NaN;
      const u = vertices[o + VERTEX_LAYOUT.uv.offset] ?? NaN;
      const t = vertices[o + VERTEX_LAYOUT.uv.offset + 1] ?? NaN;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      expect(x).toBeGreaterThanOrEqual(-1e-3);
      expect(x).toBeLessThanOrEqual(W + 1e-3);
      expect(y).toBeGreaterThanOrEqual(-1e-3);
      expect(y).toBeLessThanOrEqual(H + 1e-3);
      // UV is the position over the viewport size, y down like the texture rows.
      expect(u).toBeCloseTo(x / W, 5);
      expect(t).toBeCloseTo(y / H, 5);
    }
  });

  it('is deterministic with a seed and varies without one', () => {
    const a = fracture({ width: W, height: H, origin: { x: 300, y: 200 }, count: 90, seed: 42 });
    const b = fracture({ width: W, height: H, origin: { x: 300, y: 200 }, count: 90, seed: 42 });
    expect(Array.from(b.vertices)).toEqual(Array.from(a.vertices));
    const c = fracture({ width: W, height: H, origin: { x: 300, y: 200 }, count: 90, seed: 43 });
    expect(Array.from(c.vertices)).not.toEqual(Array.from(a.vertices));
  });

  it('places close to the requested number of shards', () => {
    for (const count of [12, 40, 90, 160, 400]) {
      const seeds = sampleSeeds({
        width: W,
        height: H,
        origin: { x: 720, y: 450 },
        count,
        seed: 9,
      });
      const placed = seeds.length / 2;
      expect(placed).toBeLessThanOrEqual(count);
      expect(placed).toBeGreaterThanOrEqual(Math.floor(count * 0.85));
    }
  });

  it('packs shards near the impact (small near, large far)', () => {
    const geometry = fracture({
      width: W,
      height: H,
      origin: { x: 720, y: 450 },
      count: 160,
      seed: 5,
    });
    const sorted = [...geometry.shards].sort((p, q) => p.distance - q.distance);
    const quarter = Math.floor(sorted.length / 4);
    const mean = (list: typeof sorted): number =>
      list.reduce((sum, shard) => sum + shard.area, 0) / list.length;
    expect(mean(sorted.slice(0, quarter))).toBeLessThan(mean(sorted.slice(-quarter)) / 3);
  });

  it('rejects slivers: seeds keep their distance and cells stay chunky', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const geometry = fracture({
        width: W,
        height: H,
        origin: { x: 640, y: 380 },
        count: 160,
        seed,
      });
      for (const shard of geometry.shards) {
        let perimeter = 0;
        const ring = shard.polygon;
        for (let i = 0; i < ring.length; i += 2) {
          const j = (i + 2) % ring.length;
          perimeter += Math.hypot(
            (ring[j] ?? 0) - (ring[i] ?? 0),
            (ring[j + 1] ?? 0) - (ring[i + 1] ?? 0),
          );
        }
        // Isoperimetric quotient 4πA/P²: 1 for a circle, ~0.6 for a 1:3 rectangle, ~0.1 for a sliver.
        const roundness = (4 * Math.PI * shard.area) / (perimeter * perimeter);
        expect(roundness).toBeGreaterThan(0.25);
        expect(shard.inradius).toBeGreaterThan(1.5);
      }
    }
  });

  it('skips null cells from coincident seeds without losing area', () => {
    const seeds = Float64Array.from([100, 100, 100, 100, 400, 300, 700, 200, 200, 500]);
    const shards = voronoiShards(seeds, 800, 600, { x: 100, y: 100 });
    expect(shards.length).toBe(4);
    const total = shards.reduce((sum, shard) => sum + shard.area, 0);
    expect(total).toBeCloseTo(800 * 600, 3);
  });

  it('handles a single seed as the whole viewport', () => {
    const shards = voronoiShards(Float64Array.from([10, 10]), 800, 600, { x: 10, y: 10 });
    expect(shards).toHaveLength(1);
    expect(shards[0]?.area).toBeCloseTo(800 * 600, 6);
  });

  it('uses a custom seed layout when given', () => {
    const seedPoints = Float32Array.from([200, 150, 600, 150, 200, 450, 600, 450]);
    const geometry = fracture({
      width: 800,
      height: 600,
      origin: { x: 0, y: 0 },
      count: 90,
      seedPoints,
    });
    expect(geometry.shards).toHaveLength(4);
    for (const shard of geometry.shards) expect(shard.area).toBeCloseTo(120_000, 3);
  });

  it('clamps an impact point outside the viewport', () => {
    const geometry = fracture({
      width: 800,
      height: 600,
      origin: { x: -50, y: 9000 },
      count: 40,
      seed: 2,
    });
    expect(geometry.origin).toEqual({ x: 0, y: 600 });
  });

  it('rejects an empty viewport', () => {
    expect(() => fracture({ width: 0, height: 600, origin: { x: 0, y: 0 }, count: 40 })).toThrow(
      RangeError,
    );
  });
});

describe('mesh layout', () => {
  const shards = voronoiShards(Float64Array.from([200, 150, 600, 450]), 800, 600, { x: 0, y: 0 });
  const mesh = buildMesh(shards, 800, 600, 6);
  const edges = shards.reduce((sum, shard) => sum + shard.polygon.length / 2, 0);

  it('emits front, back and side triangles for every edge', () => {
    expect(mesh.frontVertexCount).toBe(edges * 3);
    expect(mesh.vertexCount).toBe(edges * 12);
    expect(mesh.vertices.length).toBe(mesh.vertexCount * FLOATS_PER_VERTEX);
  });

  const attr = (v: number, name: keyof typeof VERTEX_LAYOUT, component = 0): number =>
    mesh.vertices[v * FLOATS_PER_VERTEX + VERTEX_LAYOUT[name].offset + component] ?? NaN;

  it('puts the front faces at z = 0 facing the viewer, covering exactly the viewport', () => {
    let area = 0;
    for (let t = 0; t < mesh.frontVertexCount; t += 3) {
      for (let k = 0; k < 3; k++) {
        expect(attr(t + k, 'position', 2)).toBe(0);
        expect(attr(t + k, 'normal', 2)).toBe(1);
      }
      const ax = attr(t, 'position');
      const ay = attr(t, 'position', 1);
      const bx = attr(t + 1, 'position');
      const by = attr(t + 1, 'position', 1);
      const cx = attr(t + 2, 'position');
      const cy = attr(t + 2, 'position', 1);
      area += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    }
    expect(area).toBeCloseTo(800 * 600, 0);
  });

  it('measures edgeDistance as 0 on cell edges and the distance to the edge at the centroid', () => {
    for (let t = 0; t < mesh.frontVertexCount; t += 3) {
      expect(attr(t + 1, 'edgeDistance')).toBe(0);
      expect(attr(t + 2, 'edgeDistance')).toBe(0);
      expect(attr(t, 'edgeDistance')).toBeGreaterThan(0);
    }
  });

  it('marks side faces with an in-plane normal and non-positive edgeDistance', () => {
    for (let v = mesh.frontVertexCount * 2; v < mesh.vertexCount; v++) {
      expect(attr(v, 'normal', 2)).toBe(0);
      expect(Math.hypot(attr(v, 'normal'), attr(v, 'normal', 1))).toBeCloseTo(1, 5);
      expect(attr(v, 'edgeDistance')).toBeLessThanOrEqual(0);
    }
  });

  it('stores the shard id and centroid on every vertex', () => {
    for (let v = 0; v < mesh.vertexCount; v++) {
      const id = attr(v, 'shardId');
      const shard = shards[id];
      expect(shard).toBeDefined();
      expect(attr(v, 'centroid')).toBeCloseTo(shard?.centroid.x ?? NaN, 3);
      expect(attr(v, 'centroid', 1)).toBeCloseTo(shard?.centroid.y ?? NaN, 3);
    }
  });
});

describe('shard count', () => {
  it('clamps to [12, 400]', () => {
    expect(clampShardCount(3)).toBe(MIN_SHARDS);
    expect(clampShardCount(10_000)).toBe(MAX_SHARDS);
    expect(clampShardCount(90.4)).toBe(90);
    expect(clampShardCount(Number.NaN)).toBe(TIER_SHARDS.mid);
  });

  it('picks a device tier from cores, memory and capture time', () => {
    expect(deviceTier({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe('low');
    expect(deviceTier({ hardwareConcurrency: 8, deviceMemory: 4 })).toBe('low');
    expect(deviceTier({ hardwareConcurrency: 6 })).toBe('mid');
    expect(deviceTier({ hardwareConcurrency: 12, deviceMemory: 16 })).toBe('high');
    expect(deviceTier({ hardwareConcurrency: 12 })).toBe('high');
    expect(deviceTier({ hardwareConcurrency: 12, deviceMemory: 16, captureMs: 300 })).toBe('mid');
    expect(deviceTier({})).toBe('low');
  });

  it('measures the farthest corner', () => {
    expect(farthestCorner({ x: 0, y: 0 }, 300, 400)).toBe(500);
    expect(farthestCorner({ x: 150, y: 200 }, 300, 400)).toBe(250);
  });
});
