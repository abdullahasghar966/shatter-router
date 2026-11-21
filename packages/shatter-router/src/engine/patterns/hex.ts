import type { FracturePattern, PatternInput } from '../fracture';
import { shardsFrom } from './shared';

/**
 * `hex` (ADR-053): a honeycomb of pointy-top hexagons sized so about `count`
 * of them cover the viewport; the ones on the edges are clipped.
 */
export function hexagons(input: PatternInput): number[][] {
  // A hexagon of circumradius r covers (3√3/2)·r².
  const r = Math.sqrt(
    (input.width * input.height) / Math.max(1, input.count) / ((3 * Math.sqrt(3)) / 2),
  );
  const w = Math.sqrt(3) * r;
  const rowStep = 1.5 * r;
  const polygons: number[][] = [];
  for (let row = -1; row * rowStep < input.height + r; row++) {
    const cy = row * rowStep;
    const offset = row % 2 === 0 ? 0 : w / 2;
    for (let cx = offset - w; cx < input.width + w; cx += w) {
      const polygon: number[] = [];
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI / 3) * k - Math.PI / 2;
        polygon.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      }
      polygons.push(polygon);
    }
  }
  return polygons;
}

export const hexPattern: FracturePattern = {
  name: 'hex',
  cells: (input) => shardsFrom(hexagons(input), input),
};
