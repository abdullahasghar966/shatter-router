import type { FracturePattern, PatternInput } from '../fracture';
import { cellSize, patternRandom, shardsFrom } from './shared';

type P = [number, number];

function turn(p: P, q: P, r: P): number {
  return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
}

/** True when both triangles of a diagonal split of quad abcd keep the quad's winding. */
function sameTurn(a: P, b: P, c: P, d: P, alongAC: boolean): boolean {
  const [t1, t2] = alongAC ? [turn(a, b, c), turn(a, c, d)] : [turn(a, b, d), turn(b, c, d)];
  return Math.sign(t1) === Math.sign(t2) && t1 !== 0;
}

/** How far an inner grid point may move, as a share of the cell size. */
const JITTER = 0.32;

/**
 * `triangles` (ADR-053): low-poly facets. A grid of points whose inner points
 * are jittered (the border points stay on the border, so the facets tile the
 * viewport), each quad split into two triangles along alternating diagonals.
 */
export function triangles(input: PatternInput): number[][] {
  // Two triangles per grid cell.
  const size = cellSize(input, 2);
  const columns = Math.max(1, Math.round(input.width / size));
  const rows = Math.max(1, Math.round(input.height / size));
  const w = input.width / columns;
  const h = input.height / rows;
  const random = patternRandom(input);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const inner = row > 0 && row < rows && column > 0 && column < columns;
      xs.push(column * w + (inner ? (random() - 0.5) * 2 * JITTER * w : 0));
      ys.push(row * h + (inner ? (random() - 0.5) * 2 * JITTER * h : 0));
    }
  }
  const point = (row: number, column: number): [number, number] => {
    const i = row * (columns + 1) + column;
    return [xs[i] ?? 0, ys[i] ?? 0];
  };
  const polygons: number[][] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = point(row, column);
      const b = point(row, column + 1);
      const c = point(row + 1, column + 1);
      const d = point(row + 1, column);
      // Alternate the diagonals for a facetted look, but a jittered quad can
      // be non-convex: then only the diagonal inside it splits it cleanly.
      const acFirst = (row + column) % 2 === 0;
      const acInside = sameTurn(a, b, c, d, true);
      const bdInside = sameTurn(a, b, c, d, false);
      if ((acFirst && acInside) || !bdInside) {
        polygons.push([...a, ...b, ...c], [...a, ...c, ...d]);
      } else {
        polygons.push([...a, ...b, ...d], [...b, ...c, ...d]);
      }
    }
  }
  return polygons;
}

export const trianglesPattern: FracturePattern = {
  name: 'triangles',
  cells: (input) => shardsFrom(triangles(input), input),
};
