import type { FracturePattern, PatternInput } from '../fracture';
import { cellSize, patternRandom, shardsFrom } from './shared';

/**
 * The rectangular patterns (ADR-053): `tiles` (a square grid), `bricks`
 * (rows of 2:1 bricks, every other row offset by half a brick) and `strips`
 * (vertical blinds). Shared code, one chunk each through thin entry modules.
 */

function rect(x: number, y: number, w: number, h: number): number[] {
  return [x, y, x + w, y, x + w, y + h, x, y + h];
}

export function tiles(input: PatternInput): number[][] {
  const size = cellSize(input);
  const columns = Math.max(1, Math.round(input.width / size));
  const rows = Math.max(1, Math.round(input.height / size));
  const w = input.width / columns;
  const h = input.height / rows;
  const polygons: number[][] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      polygons.push(rect(column * w, row * h, w, h));
    }
  }
  return polygons;
}

export function bricks(input: PatternInput): number[][] {
  // A 2:1 brick covers two squares of the grid.
  const width = cellSize(input, 2);
  const rows = Math.max(1, Math.round(input.height / (width / 2)));
  const height = input.height / rows;
  const polygons: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : -width / 2;
    for (let x = offset; x < input.width; x += width) {
      polygons.push(rect(x, row * height, width, height));
    }
  }
  return polygons;
}

/** Strips are wide on purpose: about √count of them, 6–40. */
export function strips(input: PatternInput): number[][] {
  const count = Math.min(40, Math.max(6, Math.round(Math.sqrt(input.count) * 2)));
  const random = patternRandom(input);
  // Slightly uneven widths, like real blinds catching the light.
  const weights = Array.from({ length: count }, () => 0.85 + random() * 0.3);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const polygons: number[][] = [];
  let x = 0;
  weights.forEach((weight, i) => {
    const w = i === count - 1 ? input.width - x : (weight / total) * input.width;
    polygons.push(rect(x, 0, w, input.height));
    x += w;
  });
  return polygons;
}

export const tilesPattern: FracturePattern = {
  name: 'tiles',
  cells: (input) => shardsFrom(tiles(input), input),
};

export const bricksPattern: FracturePattern = {
  name: 'bricks',
  cells: (input) => shardsFrom(bricks(input), input),
};

export const stripsPattern: FracturePattern = {
  name: 'strips',
  cells: (input) => shardsFrom(strips(input), input),
};
