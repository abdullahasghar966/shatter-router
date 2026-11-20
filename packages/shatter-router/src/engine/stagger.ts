import type { Stagger } from '../core/effect';
import { createRandom } from '../core/random';
import type { Point, Shard } from './fracture';

/** Where the shards lie: what an order is computed from. */
export interface OrderInput {
  readonly shards: readonly Shard[];
  readonly width: number;
  readonly height: number;
  readonly origin: Point;
  readonly maxRadius: number;
  /** Deterministic `'random'` order when given. */
  readonly seed?: number | undefined;
}

/** Offset so the `'random'` order differs from the fracture and motion sequences. */
const RANDOM_SALT = 0x2545f491;

/**
 * Per shard, when it starts relative to the others (ADR-048): 0 first, 1 last.
 * `'radial'` is exactly `min(1, distance / maxRadius)`, the `r` every built-in
 * effect used for its delays before stagger existed.
 */
export function staggerOrder(stagger: Stagger | undefined, input: OrderInput): Float32Array {
  const { shards, width, height, origin, maxRadius } = input;
  const order = new Float32Array(shards.length);
  const kind = typeof stagger === 'object' ? stagger.type : (stagger ?? 'radial');
  if (kind === 'radial') {
    const reach = Math.max(1, maxRadius);
    shards.forEach((shard, i) => {
      order[i] = Math.min(1, shard.distance / reach);
    });
  } else if (kind === 'linear') {
    const degrees = typeof stagger === 'object' ? stagger.angle : 0;
    const radians = (degrees * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    // The page's corners project onto [low, high] along the direction.
    const low = Math.min(0, width * dx) + Math.min(0, height * dy);
    const high = Math.max(0, width * dx) + Math.max(0, height * dy);
    const span = Math.max(1e-6, high - low);
    shards.forEach((shard, i) => {
      const along = shard.centroid.x * dx + shard.centroid.y * dy;
      order[i] = Math.min(1, Math.max(0, (along - low) / span));
    });
  } else if (kind === 'spiral') {
    // One turn around the impact point, outward: angle first, distance second.
    const reach = Math.max(1, maxRadius);
    shards.forEach((shard, i) => {
      const turn =
        (Math.atan2(shard.centroid.y - origin.y, shard.centroid.x - origin.x) + Math.PI) /
        (2 * Math.PI);
      order[i] = Math.min(1, 0.65 * turn + 0.35 * Math.min(1, shard.distance / reach));
    });
  } else if (kind === 'random') {
    const random = createRandom(input.seed === undefined ? undefined : input.seed + RANDOM_SALT);
    for (let i = 0; i < shards.length; i++) order[i] = random();
  } else {
    // 'reading-order': rows about one mean shard tall, each left to right.
    const rowHeight = Math.max(1, Math.sqrt((width * height) / Math.max(1, shards.length)));
    const rows = Math.max(1, Math.ceil(height / rowHeight));
    shards.forEach((shard, i) => {
      const row = Math.min(rows - 1, Math.floor(shard.centroid.y / rowHeight));
      const across = Math.min(1, Math.max(0, shard.centroid.x / Math.max(1, width)));
      order[i] = (row + across) / rows;
    });
  }
  return order;
}
