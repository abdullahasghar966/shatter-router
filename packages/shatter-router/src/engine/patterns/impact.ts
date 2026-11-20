import { Delaunay } from 'd3-delaunay';
import { createRandom, type Random } from '../../core/random';
import {
  clampShardCount,
  DEFAULT_FALLOFF,
  farthestCorner,
  type FracturePattern,
  type Point,
  type SeedOptions,
  type Shard,
  shardFromRing,
} from '../fracture';

/**
 * Impact-biased seed points.
 *
 * Polar sampling around the origin with `r = maxR * u^k` puts many points near
 * the impact and few at the edges. Its areal density falls off as
 * `r^(1/k - 2)`, so the expected spacing between neighbours grows as
 * `r^(1 - 1/(2k))`. Dart throwing rejects a candidate that lands closer to an
 * existing seed than a fraction of that local spacing (blue noise), so no two
 * seeds crowd together and no cell becomes a sliver.
 */
export function sampleSeeds(
  options: SeedOptions,
  random: Random = createRandom(options.seed),
): Float64Array {
  const { width, height, origin } = options;
  const count = clampShardCount(options.count);
  const k = options.falloff ?? DEFAULT_FALLOFF;
  const maxR = farthestCorner(origin, width, height);

  // Calibrate the spacing law so `count` points would tile the viewport.
  const exponent = 1 - 1 / (2 * k);
  const meanSpacing = Math.sqrt((width * height) / count);
  const minSpacing = Math.max(4, meanSpacing * 0.18);
  const spacingAt = (r: number): number => {
    const t = Math.max(r / maxR, 0.02);
    return Math.max(minSpacing, meanSpacing * 1.55 * t ** exponent);
  };
  const rejectFactor = 0.55;

  // Uniform grid for neighbour queries, as linked lists in typed arrays (no
  // allocation per seed). Cells are a third of the largest rejection radius,
  // so a query never scans more than 7x7 cells.
  const largestReject = spacingAt(maxR) * rejectFactor;
  const cellSize = Math.max(minSpacing * rejectFactor, largestReject / 3);
  const columns = Math.ceil(width / cellSize) + 1;
  const rows = Math.ceil(height / cellSize) + 1;
  const heads = new Int32Array(columns * rows).fill(-1);
  const next = new Int32Array(count);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  let placed = 0;

  const tooClose = (x: number, y: number, minDistance: number): boolean => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const span = Math.ceil(minDistance / cellSize);
    const limit = minDistance * minDistance;
    const y0 = Math.max(0, cy - span);
    const y1 = Math.min(rows - 1, cy + span);
    const x0 = Math.max(0, cx - span);
    const x1 = Math.min(columns - 1, cx + span);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        for (let i = heads[gy * columns + gx] ?? -1; i >= 0; i = next[i] ?? -1) {
          const dx = (xs[i] ?? 0) - x;
          const dy = (ys[i] ?? 0) - y;
          if (dx * dx + dy * dy < limit) return true;
        }
      }
    }
    return false;
  };

  const maxAttempts = count * 60;
  for (let attempt = 0; attempt < maxAttempts && placed < count; attempt++) {
    const r = maxR * random() ** k;
    const angle = random() * Math.PI * 2;
    const x = origin.x + Math.cos(angle) * r;
    const y = origin.y + Math.sin(angle) * r;
    if (x <= 0 || y <= 0 || x >= width || y >= height) continue;
    if (tooClose(x, y, spacingAt(r) * rejectFactor)) continue;
    const cell = Math.floor(y / cellSize) * columns + Math.floor(x / cellSize);
    xs[placed] = x;
    ys[placed] = y;
    next[placed] = heads[cell] ?? -1;
    heads[cell] = placed;
    placed += 1;
  }
  const points = new Float64Array(placed * 2);
  for (let i = 0; i < placed; i++) {
    points[i * 2] = xs[i] ?? 0;
    points[i * 2 + 1] = ys[i] ?? 0;
  }
  return points;
}

/**
 * Collects a cell outline from d3's public `renderCell(i, context)` into a
 * reusable flat buffer, skipping repeated vertices. Avoids the per-vertex
 * `[x, y]` arrays `cellPolygon` allocates.
 */
class RingCollector {
  readonly values: number[] = [];
  moveTo(x: number, y: number): void {
    this.values.length = 0;
    this.values.push(x, y);
  }
  lineTo(x: number, y: number): void {
    const v = this.values;
    const n = v.length;
    if (v[n - 2] === x && v[n - 1] === y) return;
    v.push(x, y);
  }
  closePath(): void {
    // The ring is kept open: drop a last vertex equal to the first.
    const v = this.values;
    const n = v.length;
    if (n >= 4 && v[0] === v[n - 2] && v[1] === v[n - 1]) v.length = n - 2;
  }
}

/** Voronoi cells of `seeds` clipped to the viewport, as shards. Null cells are skipped. */
export function voronoiShards(
  seeds: Float64Array,
  width: number,
  height: number,
  origin: Point,
): Shard[] {
  const voronoi = new Delaunay(seeds).voronoi([0, 0, width, height]);
  const shards: Shard[] = [];
  const count = seeds.length / 2;
  const collector = new RingCollector();
  for (let i = 0; i < count; i++) {
    // renderCell draws nothing for a null cell (coincident point, or clipped
    // away entirely); cellPolygon would return null there despite its type.
    collector.values.length = 0;
    voronoi.renderCell(i, collector);
    const shard = shardFromRing(collector.values, origin);
    if (shard) shards.push(shard);
  }
  return shards;
}

/**
 * `impact` (default pattern): Voronoi cells around impact-biased blue-noise
 * seeds, small near the impact point and large at the edges. An effect's
 * `seedPoints` replace the sampled seeds.
 */
export const impactPattern: FracturePattern = {
  name: 'impact',
  cells(input) {
    const seeds = input.seedPoints ? Float64Array.from(input.seedPoints) : sampleSeeds(input);
    return voronoiShards(seeds, input.width, input.height, input.origin);
  },
};
