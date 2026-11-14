import { Delaunay } from 'd3-delaunay';
import { createRandom, type Random } from '../core/random';

/** Smallest and largest shard counts the engine accepts. */
export const MIN_SHARDS = 12;
export const MAX_SHARDS = 400;

/** Shard counts per device tier for `shards: 'auto'`. */
export const TIER_SHARDS = { low: 40, mid: 90, high: 160 } as const;
export type DeviceTier = keyof typeof TIER_SHARDS;

/** Default falloff exponent `k` in `r = maxR * u^k` (master prompt 5.1: 1.6–2.2). */
export const DEFAULT_FALLOFF = 1.9;

/** Default glass thickness in CSS pixels. */
export const DEFAULT_THICKNESS = 6;

/**
 * Interleaved vertex layout, in floats:
 * position (3) · uv (2) · shardId (1) · centroid (2) · edgeDistance (1) · normal (3).
 */
export const VERTEX_LAYOUT = {
  position: { offset: 0, size: 3 },
  uv: { offset: 3, size: 2 },
  shardId: { offset: 5, size: 1 },
  centroid: { offset: 6, size: 2 },
  edgeDistance: { offset: 8, size: 1 },
  normal: { offset: 9, size: 3 },
} as const;
export const FLOATS_PER_VERTEX = 12;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SeedOptions {
  readonly width: number;
  readonly height: number;
  /** Impact point; seeds are densest here. */
  readonly origin: Point;
  /** Target number of seeds (shards). Clamped to [MIN_SHARDS, MAX_SHARDS]. */
  readonly count: number;
  /** Deterministic layout when given. */
  readonly seed?: number;
  /** Falloff exponent `k`; larger packs more shards near the impact. */
  readonly falloff?: number;
}

export interface FractureOptions extends SeedOptions {
  /** Extrusion depth for side faces, in CSS pixels. */
  readonly thickness?: number;
  /** Custom seed layout `[x0, y0, x1, y1, …]` (ShatterEffect.seedPoints); skips sampling. */
  readonly seedPoints?: Float32Array;
}

/** One shard: a convex Voronoi cell. */
export interface Shard {
  /** Polygon vertices `[x0, y0, x1, y1, …]`, counter-clockwise on screen, not closed. */
  readonly polygon: Float64Array;
  readonly centroid: Point;
  readonly area: number;
  /** Distance from the centroid to the nearest edge (largest inscribed-ish radius). */
  readonly inradius: number;
  /** Distance from the impact point to the centroid. */
  readonly distance: number;
}

export interface FractureGeometry {
  readonly width: number;
  readonly height: number;
  readonly origin: Point;
  /** Distance from the impact point to the farthest viewport corner. */
  readonly maxRadius: number;
  readonly thickness: number;
  readonly shards: readonly Shard[];
  /** Interleaved vertex data, `FLOATS_PER_VERTEX` floats per vertex, triangles. */
  readonly vertices: Float32Array;
  readonly vertexCount: number;
  /** Vertices `[0, frontVertexCount)` are the front faces (the page as seen at rest). */
  readonly frontVertexCount: number;
}

/** Clamps a requested shard count to what the engine supports. */
export function clampShardCount(count: number): number {
  if (!Number.isFinite(count)) return TIER_SHARDS.mid;
  return Math.min(MAX_SHARDS, Math.max(MIN_SHARDS, Math.round(count)));
}

export interface DeviceHints {
  readonly hardwareConcurrency?: number;
  /** GiB, from `navigator.deviceMemory` (Chromium only). */
  readonly deviceMemory?: number;
  /** Most recent capture time in ms, when known. */
  readonly captureMs?: number;
}

/**
 * Classifies the device for `shards: 'auto'`. Cores and memory set the base
 * tier; a slow capture (a direct measurement of this device on this page)
 * pulls it down a step.
 */
export function deviceTier(hints: DeviceHints): DeviceTier {
  const cores = hints.hardwareConcurrency ?? 4;
  const memory = hints.deviceMemory;
  let tier: DeviceTier;
  if (cores <= 4 || (memory !== undefined && memory <= 4)) tier = 'low';
  else if (cores >= 8 && (memory === undefined || memory >= 8)) tier = 'high';
  else tier = 'mid';
  if (hints.captureMs !== undefined && hints.captureMs > 160) {
    tier = tier === 'high' ? 'mid' : 'low';
  }
  return tier;
}

/** Distance from `p` to the farthest corner of the `width × height` box. */
export function farthestCorner(p: Point, width: number, height: number): number {
  const dx = Math.max(p.x, width - p.x);
  const dy = Math.max(p.y, height - p.y);
  return Math.hypot(dx, dy);
}

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

function polygonArea(ring: Float64Array): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    twice += (ring[i] ?? 0) * (ring[j + 1] ?? 0) - (ring[j] ?? 0) * (ring[i + 1] ?? 0);
  }
  return twice / 2;
}

function polygonCentroid(ring: Float64Array, signedArea: number): Point {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    const x0 = ring[i] ?? 0;
    const y0 = ring[i + 1] ?? 0;
    const x1 = ring[j] ?? 0;
    const y1 = ring[j + 1] ?? 0;
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lengthSq = vx * vx + vy * vy;
  const t =
    lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / lengthSq));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
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

/** Copies the collected outline, counter-clockwise on screen (y down). Null if degenerate. */
function toRing(values: readonly number[]): Float64Array | null {
  if (values.length < 6) return null;
  const ring = Float64Array.from(values);
  // Screen space has y down: a positive shoelace area means clockwise on screen.
  if (polygonArea(ring) > 0) {
    const reversed = new Float64Array(ring.length);
    for (let i = 0; i < ring.length; i += 2) {
      reversed[ring.length - 2 - i] = ring[i] ?? 0;
      reversed[ring.length - 1 - i] = ring[i + 1] ?? 0;
    }
    return reversed;
  }
  return ring;
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
    const ring = toRing(collector.values);
    if (!ring) continue;
    const signed = polygonArea(ring);
    const area = Math.abs(signed);
    if (area < 1e-6) continue;
    const centroid = polygonCentroid(ring, signed);
    let inradius = Infinity;
    for (let j = 0; j < ring.length; j += 2) {
      const k = (j + 2) % ring.length;
      inradius = Math.min(
        inradius,
        distanceToSegment(
          centroid.x,
          centroid.y,
          ring[j] ?? 0,
          ring[j + 1] ?? 0,
          ring[k] ?? 0,
          ring[k + 1] ?? 0,
        ),
      );
    }
    shards.push({
      polygon: ring,
      centroid,
      area,
      inradius,
      distance: Math.hypot(centroid.x - origin.x, centroid.y - origin.y),
    });
  }
  return shards;
}

/**
 * Builds the merged shard mesh: per shard a centroid fan for the front face
 * (z = 0, the page at rest), the same fan for the back face (z = -thickness,
 * reversed winding) and one quad per edge for the sides. One buffer, one draw call.
 *
 * `edgeDistance` on front and back faces is the exact distance to the
 * triangle's outer edge: 0 on the edge and the centroid's distance to that
 * edge at the centre, which interpolates linearly across the fan triangle.
 * Side faces carry a negative `edgeDistance` (the depth into the glass) so the
 * shader can tell them apart.
 */
export function buildMesh(
  shards: readonly Shard[],
  width: number,
  height: number,
  thickness: number,
): { vertices: Float32Array; vertexCount: number; frontVertexCount: number } {
  let edges = 0;
  for (const shard of shards) edges += shard.polygon.length / 2;
  // Front n triangles + back n triangles + sides 2n triangles, 3 vertices each.
  const vertexCount = edges * 12;
  const frontVertexCount = edges * 3;
  const vertices = new Float32Array(vertexCount * FLOATS_PER_VERTEX);
  const invW = 1 / width;
  const invH = 1 / height;

  let front = 0;
  let back = frontVertexCount;
  let side = frontVertexCount * 2;
  const write = (
    index: number,
    x: number,
    y: number,
    z: number,
    shardId: number,
    centroid: Point,
    edgeDistance: number,
    nx: number,
    ny: number,
    nz: number,
  ): void => {
    const o = index * FLOATS_PER_VERTEX;
    vertices[o] = x;
    vertices[o + 1] = y;
    vertices[o + 2] = z;
    vertices[o + 3] = Math.min(1, Math.max(0, x * invW));
    vertices[o + 4] = Math.min(1, Math.max(0, y * invH));
    vertices[o + 5] = shardId;
    vertices[o + 6] = centroid.x;
    vertices[o + 7] = centroid.y;
    vertices[o + 8] = edgeDistance;
    vertices[o + 9] = nx;
    vertices[o + 10] = ny;
    vertices[o + 11] = nz;
  };

  shards.forEach((shard, shardId) => {
    const { polygon: ring, centroid } = shard;
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2] ?? 0;
      const ay = ring[i * 2 + 1] ?? 0;
      const bx = ring[j * 2] ?? 0;
      const by = ring[j * 2 + 1] ?? 0;
      const toEdge = distanceToSegment(centroid.x, centroid.y, ax, ay, bx, by);

      // Front face, counter-clockwise on screen.
      write(front++, centroid.x, centroid.y, 0, shardId, centroid, toEdge, 0, 0, 1);
      write(front++, ax, ay, 0, shardId, centroid, 0, 0, 0, 1);
      write(front++, bx, by, 0, shardId, centroid, 0, 0, 0, 1);

      // Back face, reversed winding.
      write(back++, centroid.x, centroid.y, -thickness, shardId, centroid, toEdge, 0, 0, -1);
      write(back++, bx, by, -thickness, shardId, centroid, 0, 0, 0, -1);
      write(back++, ax, ay, -thickness, shardId, centroid, 0, 0, 0, -1);

      // Side quad with the outward edge normal (counter-clockwise ring on a y-down screen).
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (by - ay) / length;
      const ny = -(bx - ax) / length;
      const depth = -Math.max(thickness, 1e-3);
      write(side++, ax, ay, 0, shardId, centroid, -0, nx, ny, 0);
      write(side++, ax, ay, -thickness, shardId, centroid, depth, nx, ny, 0);
      write(side++, bx, by, 0, shardId, centroid, -0, nx, ny, 0);
      write(side++, bx, by, 0, shardId, centroid, -0, nx, ny, 0);
      write(side++, ax, ay, -thickness, shardId, centroid, depth, nx, ny, 0);
      write(side++, bx, by, -thickness, shardId, centroid, depth, nx, ny, 0);
    }
  });

  return { vertices, vertexCount, frontVertexCount };
}

/** Seeds → Voronoi shards → merged mesh. */
export function fracture(options: FractureOptions): FractureGeometry {
  const { width, height, origin } = options;
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError(`Fracture size must be positive, got ${width}x${height}`);
  }
  const clampedOrigin = {
    x: Math.min(width, Math.max(0, origin.x)),
    y: Math.min(height, Math.max(0, origin.y)),
  };
  const thickness = Math.max(0, options.thickness ?? DEFAULT_THICKNESS);
  const seeds = options.seedPoints
    ? Float64Array.from(options.seedPoints)
    : sampleSeeds({ ...options, origin: clampedOrigin });
  const shards = voronoiShards(seeds, width, height, clampedOrigin);
  const mesh = buildMesh(shards, width, height, thickness);
  return {
    width,
    height,
    origin: clampedOrigin,
    maxRadius: farthestCorner(clampedOrigin, width, height),
    thickness,
    shards,
    ...mesh,
  };
}
