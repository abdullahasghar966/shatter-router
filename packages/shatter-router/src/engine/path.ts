/**
 * Tear paths (ADR-060): a drag across the page breaks it along the drag. The
 * fracture puts its seeds around the path, every piece's distance (and so its
 * stagger order) is measured to the path, and the crack front grows out from
 * it. A path is a polyline of 2–8 points in viewport px.
 */

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}

/** Most points a path keeps (the crack shader has room for this many). */
export const MAX_PATH_POINTS = 8;

/** Distance from (x, y) to the polyline; to its single point when it has one. */
export function distanceToPath(path: readonly PathPoint[], x: number, y: number): number {
  const first = path[0];
  if (!first) return 0;
  let best = Math.hypot(x - first.x, y - first.y);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared > 0
        ? Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared))
        : 0;
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

/** Total length of the polyline, px. */
export function pathLength(path: readonly PathPoint[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

/** The point `along` px from the start of the polyline (clamped to its ends). */
export function pointAlong(path: readonly PathPoint[], along: number): PathPoint {
  let left = Math.max(0, along);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= segment && segment > 0) {
      const t = left / segment;
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    left -= segment;
  }
  return path[path.length - 1] ?? { x: 0, y: 0 };
}

/** The farthest viewport corner from the path: how far the crack front must travel. */
export function farthestCornerFromPath(
  path: readonly PathPoint[],
  width: number,
  height: number,
): number {
  return Math.max(
    distanceToPath(path, 0, 0),
    distanceToPath(path, width, 0),
    distanceToPath(path, 0, height),
    distanceToPath(path, width, height),
  );
}

/**
 * A usable path: finite points clamped into the viewport, consecutive
 * duplicates dropped, at most MAX_PATH_POINTS (the last one kept). Null when
 * fewer than two distinct points remain.
 */
export function cleanPath(
  path: readonly PathPoint[] | undefined,
  width: number,
  height: number,
): PathPoint[] | null {
  if (!path) return null;
  const points: PathPoint[] = [];
  for (const point of path) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const next = {
      x: Math.min(width, Math.max(0, point.x)),
      y: Math.min(height, Math.max(0, point.y)),
    };
    const last = points[points.length - 1];
    if (last && Math.hypot(next.x - last.x, next.y - last.y) < 1) continue;
    points.push(next);
  }
  if (points.length < 2) return null;
  if (points.length > MAX_PATH_POINTS) {
    const kept = points.slice(0, MAX_PATH_POINTS - 1);
    const last = points[points.length - 1];
    if (last) kept.push(last);
    return kept;
  }
  return points;
}
