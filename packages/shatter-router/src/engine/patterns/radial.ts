import { farthestCorner, type FracturePattern, type PatternInput, type Shard } from '../fracture';
import { patternRandom, shardsFrom } from './shared';

interface WebOptions {
  /** Number of rays from the impact point. */
  readonly rays: number;
  /** Random spread of the rays' angles, as a share of the angle between two. */
  readonly rayJitter: number;
  /** Random spread of each ring's radius at each ray, as a share of the ring spacing. */
  readonly ringJitter: number;
  /** Ring spacing grows outward by this power (1 = even). */
  readonly growth: number;
}

/**
 * A web around the impact point: rays crossed by rings. Every crossing point
 * is shared by the four cells around it, so the cells meet exactly; each cell
 * lies between two rays less than half a turn apart, so it is convex.
 */
export function web(input: PatternInput, options: WebOptions): number[][] {
  const { origin } = input;
  const random = patternRandom(input);
  const rays = Math.max(3, options.rays);
  const rings = Math.max(1, Math.round(input.count / rays));
  const step = (2 * Math.PI) / rays;
  // The outermost ring is made of straight chords between rays: its closest
  // point to the impact is at reach·cos(gap/2). Push it past the farthest
  // corner for the widest gap the jitter allows.
  const widest = Math.min(Math.PI * 0.9, step * (1 + options.rayJitter));
  const reach = (farthestCorner(origin, input.width, input.height) * 1.02) / Math.cos(widest / 2);
  const start = random() * step;
  const angles = Array.from(
    { length: rays },
    (_, j) => start + j * step + (random() - 0.5) * options.rayJitter * step,
  );
  // radius[i][j]: ring i at ray j; ring 0 is the impact point itself.
  const radius: number[][] = [];
  for (let i = 0; i <= rings; i++) {
    const base = reach * (i / rings) ** options.growth;
    const spacing = reach * ((i / rings) ** options.growth - ((i - 1) / rings) ** options.growth);
    radius.push(
      angles.map(() =>
        i === 0 || i === rings ? base : base + (random() - 0.5) * options.ringJitter * spacing,
      ),
    );
  }
  const at = (i: number, j: number): [number, number] => {
    const r = radius[i]?.[j % rays] ?? 0;
    const angle = angles[j % rays] ?? 0;
    return [origin.x + Math.cos(angle) * r, origin.y + Math.sin(angle) * r];
  };
  const polygons: number[][] = [];
  for (let j = 0; j < rays; j++) {
    // The innermost cells are triangles meeting at the impact point.
    polygons.push([origin.x, origin.y, ...at(1, j), ...at(1, j + 1)]);
    for (let i = 1; i < rings; i++) {
      polygons.push([...at(i, j), ...at(i + 1, j), ...at(i + 1, j + 1), ...at(i, j + 1)]);
    }
  }
  return polygons;
}

/**
 * The web reaches past the farthest corner, so part of it is off the page
 * (most of it when the impact is in a corner). Builds it, then scales the
 * count by how many pieces landed on the page, up to three times, until at
 * least 90 % of the requested pieces are on it.
 */
function aimed(input: PatternInput, options: (count: number) => WebOptions): Shard[] {
  let count = input.count;
  let shards = shardsFrom(web(input, options(count)), input);
  for (let pass = 0; pass < 3 && shards.length < input.count * 0.9; pass++) {
    count = Math.round((count * input.count) / Math.max(1, shards.length));
    shards = shardsFrom(web({ ...input, count }, options(count)), input);
  }
  return shards;
}

/** `radial` (ADR-053): a windscreen's spider web, denser near the impact. */
export const radialPattern: FracturePattern = {
  name: 'radial',
  cells: (input) =>
    aimed(input, (count) => ({
      rays: Math.round(Math.min(28, Math.max(8, Math.sqrt(count) * 1.4))),
      rayJitter: 0.55,
      ringJitter: 0.45,
      growth: 1.35,
    })),
};

/** `rings` (ADR-053): even concentric bands, cut into short arcs, for ripples. */
export const ringsPattern: FracturePattern = {
  name: 'rings',
  cells: (input) =>
    aimed(input, (count) => ({
      rays: Math.round(Math.min(40, Math.max(16, count / 6))),
      rayJitter: 0,
      ringJitter: 0,
      growth: 1,
    })),
};
