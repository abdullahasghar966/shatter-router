import { effectName } from '../core/compose';
import type { EffectComposition, ShatterEffect } from '../core/effect';

/**
 * The effect a composition describes (ADR-048): its motion with the
 * composition's name, pattern, stagger and duration. The motion's shader code,
 * attributes and completion check are used as they are.
 */
export function composeEffect(spec: EffectComposition, motion: ShatterEffect): ShatterEffect {
  const duration = spec.timing?.duration ?? motion.duration;
  const pattern = spec.pattern ?? motion.pattern;
  const stagger = spec.stagger ?? motion.stagger;
  const seedPoints = motion.seedPoints?.bind(motion);
  return {
    name: effectName(spec),
    needsIncomingSnapshot: motion.needsIncomingSnapshot,
    crack: motion.crack,
    ...(motion.layers === undefined ? {} : { layers: motion.layers }),
    ...(duration === undefined ? {} : { duration }),
    ...(pattern === undefined ? {} : { pattern }),
    ...(stagger === undefined ? {} : { stagger }),
    ...(seedPoints ? { seedPoints } : {}),
    shardAttributes: (ctx) => motion.shardAttributes(ctx),
    vertexChunk: motion.vertexChunk,
    ...(motion.fragmentChunk === undefined ? {} : { fragmentChunk: motion.fragmentChunk }),
    isComplete: (t, state) => motion.isComplete(t, state),
  };
}
