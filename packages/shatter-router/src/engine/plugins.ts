import type { ShatterEffect } from '../core/effect';
import type { FracturePattern } from './fracture';

/**
 * The built-in parts, each in its own chunk, loaded on first use (ADR-048).
 * The dynamic imports name tsup entries (`dist/effects/*.js`,
 * `dist/patterns/*.js`), so every part has its own size budget.
 */

/** Built-in motions (the five effects of v1), by name. */
export const MOTIONS: Readonly<Record<string, () => Promise<ShatterEffect>>> = {
  shatter: () => import('./effects/shatter').then((module) => module.shatterEffect),
  explode: () => import('./effects/explode').then((module) => module.explodeEffect),
  implode: () => import('./effects/implode').then((module) => module.implodeEffect),
  flip: () => import('./effects/flip').then((module) => module.flipEffect),
  assemble: () => import('./effects/assemble').then((module) => module.assembleEffect),
};

/** Built-in fracture patterns, by name. */
export const PATTERNS: Readonly<Record<string, () => Promise<FracturePattern>>> = {
  impact: () => import('./patterns/impact').then((module) => module.impactPattern),
};

/**
 * Built-in motions a physics backend can drive (their per-shard data is
 * `a = (v0.xyz, delay)`, `b = (axis.xyz, ω)`), with their air drag in 1/s.
 */
export const PHYSICS_DAMPING: Readonly<Record<string, number>> = { shatter: 0, explode: 3 };

/** Names of the effects that ship with the library. */
export const BUILT_IN_EFFECT_NAMES: readonly string[] = Object.keys(MOTIONS);

/** The material every effect uses until M16 adds others. */
export const MATERIALS: readonly string[] = ['glass'];
