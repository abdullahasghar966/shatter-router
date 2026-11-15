import type { EffectContext, Random, ShardInfo } from '../../core/effect';

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

/** Spin multiplier: smaller shards turn faster. */
export function sizeFactor(shard: ShardInfo, ctx: EffectContext): number {
  const meanArea = (ctx.width * ctx.height) / Math.max(1, ctx.shards.length);
  return Math.min(1.8, Math.max(0.6, Math.sqrt(meanArea / Math.max(1, shard.area))));
}
