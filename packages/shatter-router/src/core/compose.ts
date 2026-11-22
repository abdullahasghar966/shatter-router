import type { EffectComposition, ShatterEffect, Stagger } from './effect';

/** What may be passed as an effect: a name, an effect object or a composition (ADR-048). */
export type EffectSource = string | ShatterEffect | EffectComposition;

/** True for a composition (it names a motion instead of carrying shader code). */
export function isComposition(
  effect: ShatterEffect | EffectComposition,
): effect is EffectComposition {
  return !('vertexChunk' in effect);
}

function staggerName(stagger: Stagger): string {
  return typeof stagger === 'string' ? stagger : `linear(${String(stagger.angle)})`;
}

/**
 * The name an effect goes by in the registry, the navigation memory and the
 * debug hook. An unnamed composition is named after its parts, for example
 * `'explode stagger=linear'`, so the same parts always get the same name.
 */
export function effectName(effect: EffectSource): string {
  if (typeof effect === 'string') return effect;
  if (!isComposition(effect)) return effect.name;
  if (effect.name) return effect.name;
  const parts = [effect.motion];
  if (effect.pattern !== undefined) parts.push(`pattern=${effect.pattern}`);
  if (effect.stagger !== undefined) parts.push(`stagger=${staggerName(effect.stagger)}`);
  if (effect.material !== undefined) {
    parts.push(
      `material=${typeof effect.material === 'string' ? effect.material : effect.material.name}`,
    );
  }
  if (effect.timing?.duration !== undefined) {
    parts.push(`duration=${String(effect.timing.duration)}`);
  }
  if (effect.timing?.easing !== undefined) parts.push(`easing=${effect.timing.easing}`);
  return parts.join(' ');
}
