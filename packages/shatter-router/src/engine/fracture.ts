import { cleanPath, distanceToPath, farthestCornerFromPath } from './path';
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
  /**
   * A tear (ADR-060): 2–8 points the page breaks along. Seeds cluster around
   * the whole path; distances (stagger order, the crack front) are measured
   * to it. Already cleaned (`cleanPath`).
   */
  readonly path?: readonly Point[];
}

export interface FractureOptions extends SeedOptions {
  /** Extrusion depth for side faces, in CSS pixels. */
  readonly thickness?: number;
  /** Custom seed layout `[x0, y0, x1, y1, …]` (ShatterEffect.seedPoints); skips sampling. */
  readonly seedPoints?: Float32Array;
  /**
   * Where the `width × height` area sits on the page, in CSS pixels (ADR-063):
   * a region's pieces are built in region-local coordinates, then moved here,
   * so the UVs stay local to the cropped capture and every position, origin
   * and tear path is in page coordinates. Default: the page's origin.
   */
  readonly offset?: Point;
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
  /** Distance from the impact point (or the tear path) to the farthest viewport corner. */
  readonly maxRadius: number;
  /** The tear path, flattened `[x0, y0, …]`, or null (ADR-060). */
  readonly path: Float32Array | null;
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

/**
 * A shard from a closed outline `[x0, y0, x1, y1, …]` (any winding, not
 * closed): oriented counter-clockwise on screen, with its area, centroid,
 * inradius and distance from `origin`. Null for a degenerate outline. Every
 * pattern builds its shards with it.
 */
export function shardFromRing(values: ArrayLike<number>, origin: Point): Shard | null {
  if (values.length < 6) return null;
  let ring = Float64Array.from(values);
  // Screen space has y down: a positive shoelace area means clockwise on screen.
  if (polygonArea(ring) > 0) {
    const reversed = new Float64Array(ring.length);
    for (let i = 0; i < ring.length; i += 2) {
      reversed[ring.length - 2 - i] = ring[i] ?? 0;
      reversed[ring.length - 1 - i] = ring[i + 1] ?? 0;
    }
    ring = reversed;
  }
  const signed = polygonArea(ring);
  const area = Math.abs(signed);
  if (area < 1e-6) return null;
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
  return {
    polygon: ring,
    centroid,
    area,
    inradius,
    distance: Math.hypot(centroid.x - origin.x, centroid.y - origin.y),
  };
}

/** What a pattern gets: the viewport, the clamped impact point and shard count. */
export interface PatternInput extends FractureOptions {
  /** Already clamped to the viewport. */
  readonly origin: Point;
  /** Already clamped to [MIN_SHARDS, MAX_SHARDS]. */
  readonly count: number;
}

/**
 * A fracture pattern (ADR-048): cuts the viewport into convex cells that tile
 * it exactly. Loaded on demand, one chunk per pattern.
 */
export interface FracturePattern {
  readonly name: string;
  cells(input: PatternInput): Shard[];
}

/** Pattern cells → merged mesh. */
export function fracture(pattern: FracturePattern, options: FractureOptions): FractureGeometry {
  const { width, height, origin } = options;
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError(`Fracture size must be positive, got ${width}x${height}`);
  }
  const clampedOrigin = {
    x: Math.min(width, Math.max(0, origin.x)),
    y: Math.min(height, Math.max(0, origin.y)),
  };
  const thickness = Math.max(0, options.thickness ?? DEFAULT_THICKNESS);
  const path = cleanPath(options.path, width, height);
  const cells = pattern.cells({
    ...options,
    ...(path ? { path } : {}),
    origin: clampedOrigin,
    count: clampShardCount(options.count),
  });
  // A tear: every distance is measured to the path (ADR-060).
  const shards = path
    ? cells.map((shard) => ({
        ...shard,
        distance: distanceToPath(path, shard.centroid.x, shard.centroid.y),
      }))
    : cells;
  const mesh = buildMesh(shards, width, height, thickness);
  const dx = options.offset?.x ?? 0;
  const dy = options.offset?.y ?? 0;
  const moved = dx !== 0 || dy !== 0;
  return {
    width,
    height,
    origin: moved ? { x: clampedOrigin.x + dx, y: clampedOrigin.y + dy } : clampedOrigin,
    maxRadius: path
      ? farthestCornerFromPath(path, width, height)
      : farthestCorner(clampedOrigin, width, height),
    path: path ? Float32Array.from(path.flatMap((point) => [point.x + dx, point.y + dy])) : null,
    thickness,
    shards: moved ? shards.map((shard) => moveShard(shard, dx, dy)) : shards,
    vertices: moved ? moveVertices(mesh.vertices, dx, dy) : mesh.vertices,
    vertexCount: mesh.vertexCount,
    frontVertexCount: mesh.frontVertexCount,
  };
}

/** A shard moved by (dx, dy): its polygon and centroid, nothing else changes. */
function moveShard(shard: Shard, dx: number, dy: number): Shard {
  const polygon = new Float64Array(shard.polygon.length);
  for (let i = 0; i < shard.polygon.length; i += 2) {
    polygon[i] = (shard.polygon[i] ?? 0) + dx;
    polygon[i + 1] = (shard.polygon[i + 1] ?? 0) + dy;
  }
  return {
    ...shard,
    polygon,
    centroid: { x: shard.centroid.x + dx, y: shard.centroid.y + dy },
  };
}

/**
 * The interleaved mesh moved by (dx, dy): positions (floats 0–1) and the
 * centroid (floats 6–7). UVs (3–4) are local to the crop and stay as they are.
 */
function moveVertices(vertices: Float32Array, dx: number, dy: number): Float32Array {
  const moved = new Float32Array(vertices);
  for (let o = 0; o < moved.length; o += FLOATS_PER_VERTEX) {
    moved[o] = (moved[o] ?? 0) + dx;
    moved[o + 1] = (moved[o + 1] ?? 0) + dy;
    moved[o + 6] = (moved[o + 6] ?? 0) + dx;
    moved[o + 7] = (moved[o + 7] ?? 0) + dy;
  }
  return moved;
}
