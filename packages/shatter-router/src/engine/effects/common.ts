import type { EffectContext, EffectState, Random, ShardInfo } from '../../core/effect';

/** Unit direction from the impact point to the shard, random when they coincide. */
export function radialDirection(
  shard: ShardInfo,
  origin: EffectContext['origin'],
  random: Random,
): { x: number; y: number; distance: number } {
  const dx = shard.centroid.x - origin.x;
  const dy = shard.centroid.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 1e-3) return { x: dx / distance, y: dy / distance, distance };
  const angle = random() * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle), distance };
}

/** A random unit axis, mostly in the screen plane so faces turn toward the viewer. */
export function tumbleAxis(random: Random, depth = 0.35): { x: number; y: number; z: number } {
  const x = random() * 2 - 1;
  const y = random() * 2 - 1;
  const z = (random() * 2 - 1) * depth;
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

/**
 * How far the shard's outline reaches from its centroid along the unit
 * direction (dx, dy), CSS px: the support distance. Effects that turn a piece
 * about one of its edges (domino, fold, melt) put the hinge there.
 */
export function reach(shard: ShardInfo, dx: number, dy: number): number {
  const { polygon, centroid } = shard;
  let best = 0;
  for (let k = 0; k + 1 < polygon.length; k += 2) {
    const along = ((polygon[k] ?? 0) - centroid.x) * dx + ((polygon[k + 1] ?? 0) - centroid.y) * dy;
    if (along > best) best = along;
  }
  return best;
}

/** Spin multiplier: smaller shards turn faster. */
export function sizeFactor(shard: ShardInfo, ctx: EffectContext): number {
  const meanArea = (ctx.width * ctx.height) / Math.max(1, ctx.shards.length);
  return Math.min(1.8, Math.max(0.6, Math.sqrt(meanArea / Math.max(1, shard.area))));
}

/** Is a piece still on screen `seconds` into the motion? (The effect's own closed form.) */
export type Visible = (
  data: Float32Array,
  shard: ShardInfo,
  seconds: number,
  ctx: EffectContext,
) => boolean;

/** Per transition (by its attribute data): the time after which no piece is on screen, s. */
const LAST_VISIBLE = new WeakMap<Float32Array, number>();

/** Scan step, s: completion is decided at most one step late, never early. */
export const VISIBLE_STEP = 1 / 120;

/**
 * Finds, while the per-shard data is built (outside the frame loop), the last
 * moment any piece is still on screen, scanning each piece back from the end
 * of the phase, and remembers it for `finished` (ADR-058). The frame loop then
 * compares one number instead of re-running every piece's motion each frame.
 */
export function rememberLastVisible(
  data: Float32Array,
  ctx: EffectContext,
  visible: Visible,
): void {
  const end = ctx.duration / 1000;
  let last = 0;
  for (const shard of ctx.shards) {
    for (let t = end; t > last; t -= VISIBLE_STEP) {
      if (visible(data, shard, t, ctx)) {
        last = t;
        break;
      }
    }
  }
  LAST_VISIBLE.set(data, Math.min(end, last + VISIBLE_STEP));
}

/**
 * `isComplete` for effects whose pieces leave the screen: true at the end of
 * the phase, or once the remembered last-visible time has passed. Data that
 * this effect's `shardAttributes` did not build is checked piece by piece.
 */
export function finished(t: number, state: EffectState, visible: Visible): boolean {
  if (t >= state.duration) return true;
  const seconds = t / 1000;
  const last = LAST_VISIBLE.get(state.attributes);
  if (last !== undefined) return seconds >= last;
  const { shards } = state;
  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `for...of` allocates an iterator per call in unoptimised code; this may run every frame (ADR-040)
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i];
    if (shard && visible(state.attributes, shard, seconds, state)) return false;
  }
  return true;
}
