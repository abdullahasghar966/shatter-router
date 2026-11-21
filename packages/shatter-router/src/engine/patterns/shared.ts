import { createRandom, type Random } from '../../core/random';
import { type PatternInput, type Shard, shardFromRing } from '../fracture';

/**
 * Clips a convex polygon `[x0, y0, x1, y1, …]` to the `width × height` box
 * (Sutherland–Hodgman, one edge of the box at a time). A convex polygon stays
 * convex. Returns fewer than three points when nothing is left.
 */
export function clipToBox(polygon: readonly number[], width: number, height: number): number[] {
  let points = polygon.slice();
  // Each edge keeps the points where `inside` holds; `cross` finds where a
  // segment crosses the edge.
  const edges: [
    (x: number, y: number) => boolean,
    (ax: number, ay: number, bx: number, by: number) => [number, number],
  ][] = [
    [(x) => x >= 0, (ax, ay, bx, by) => [0, ay + ((by - ay) * (0 - ax)) / (bx - ax)]],
    [(x) => x <= width, (ax, ay, bx, by) => [width, ay + ((by - ay) * (width - ax)) / (bx - ax)]],
    [(_, y) => y >= 0, (ax, ay, bx, by) => [ax + ((bx - ax) * (0 - ay)) / (by - ay), 0]],
    [
      (_, y) => y <= height,
      (ax, ay, bx, by) => [ax + ((bx - ax) * (height - ay)) / (by - ay), height],
    ],
  ];
  for (const [inside, cross] of edges) {
    const next: number[] = [];
    const count = points.length / 2;
    for (let i = 0; i < count; i++) {
      const ax = points[i * 2] ?? 0;
      const ay = points[i * 2 + 1] ?? 0;
      const j = (i + 1) % count;
      const bx = points[j * 2] ?? 0;
      const by = points[j * 2 + 1] ?? 0;
      const aIn = inside(ax, ay);
      const bIn = inside(bx, by);
      if (aIn) next.push(ax, ay);
      if (aIn !== bIn) next.push(...cross(ax, ay, bx, by));
    }
    points = withoutRepeats(next);
    if (points.length < 6) return [];
  }
  return points;
}

/**
 * Drops points equal to the one before (and a last point equal to the first):
 * a cell corner lying exactly on the box edge is otherwise emitted twice,
 * which makes a zero-length edge and a degenerate side face.
 */
function withoutRepeats(points: readonly number[]): number[] {
  const out: number[] = [];
  const same = (ax: number, ay: number, bx: number, by: number): boolean =>
    Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    const n = out.length;
    if (n >= 2 && same(out[n - 2] ?? 0, out[n - 1] ?? 0, x, y)) continue;
    out.push(x, y);
  }
  while (
    out.length >= 4 &&
    same(out[0] ?? 0, out[1] ?? 0, out[out.length - 2] ?? 0, out[out.length - 1] ?? 0)
  ) {
    out.length -= 2;
  }
  return out;
}

/** Shards from convex polygons: clipped to the viewport, degenerate ones dropped. */
export function shardsFrom(polygons: readonly (readonly number[])[], input: PatternInput): Shard[] {
  const shards: Shard[] = [];
  for (const polygon of polygons) {
    const clipped = clipToBox(polygon, input.width, input.height);
    if (clipped.length < 6) continue;
    const shard = shardFromRing(clipped, input.origin);
    if (shard) shards.push(shard);
  }
  return shards;
}

/** The pattern's random source: deterministic for a seed, like `impact`. */
export function patternRandom(input: PatternInput): Random {
  return createRandom(input.seed);
}

/** Side of a square cell when `count` of them cover the viewport. */
export function cellSize(input: PatternInput, perCell = 1): number {
  return Math.sqrt((input.width * input.height * perCell) / Math.max(1, input.count));
}
