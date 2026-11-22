import type { ShatterEffect } from '../core/effect';
import type { FracturePattern } from './fracture';

/**
 * The built-in parts, each in its own chunk, loaded on first use (ADR-048).
 * The dynamic imports name tsup entries (`dist/effects/*.js`,
 * `dist/patterns/*.js`), so every part has its own size budget.
 */

/** Built-in motions (the five effects of v1 and the motion families of ADR-055), by name. */
export const MOTIONS: Readonly<Record<string, () => Promise<ShatterEffect>>> = {
  shatter: () => import('./effects/shatter').then((module) => module.shatterEffect),
  explode: () => import('./effects/explode').then((module) => module.explodeEffect),
  implode: () => import('./effects/implode').then((module) => module.implodeEffect),
  flip: () => import('./effects/flip').then((module) => module.flipEffect),
  assemble: () => import('./effects/assemble').then((module) => module.assembleEffect),
  // Motion families (ADR-055).
  crumble: () => import('./effects/crumble').then((module) => module.crumbleEffect),
  rain: () => import('./effects/rain').then((module) => module.rainEffect),
  vortex: () => import('./effects/vortex').then((module) => module.vortexEffect),
  wind: () => import('./effects/wind').then((module) => module.windEffect),
  blinds: () => import('./effects/blinds').then((module) => module.blindsEffect),
  domino: () => import('./effects/domino').then((module) => module.dominoEffect),
  slide: () => import('./effects/slide').then((module) => module.slideEffect),
  fold: () => import('./effects/fold').then((module) => module.foldEffect),
  melt: () => import('./effects/melt').then((module) => module.meltEffect),
  ripple: () => import('./effects/ripple').then((module) => module.rippleEffect),
  glitch: () => import('./effects/glitch').then((module) => module.glitchEffect),
};

/** Built-in fracture patterns, by name. */
export const PATTERNS: Readonly<Record<string, () => Promise<FracturePattern>>> = {
  impact: () => import('./patterns/impact').then((module) => module.impactPattern),
  radial: () => import('./patterns/radial').then((module) => module.radialPattern),
  rings: () => import('./patterns/radial').then((module) => module.ringsPattern),
  triangles: () => import('./patterns/triangles').then((module) => module.trianglesPattern),
  hex: () => import('./patterns/hex').then((module) => module.hexPattern),
  bricks: () => import('./patterns/grid').then((module) => module.bricksPattern),
  tiles: () => import('./patterns/grid').then((module) => module.tilesPattern),
  strips: () => import('./patterns/grid').then((module) => module.stripsPattern),
};

/** Names of the fracture patterns that ship with the library. */
export const BUILT_IN_PATTERN_NAMES: readonly string[] = Object.keys(PATTERNS);

/**
 * Built-in motions a physics backend can drive (their per-shard data is
 * `a = (v0.xyz, delay)`, `b = (axis.xyz, ω)`), with their air drag in 1/s.
 */
export const PHYSICS_DAMPING: Readonly<Record<string, number>> = {
  shatter: 0,
  explode: 3,
  crumble: 0,
};

/** Names of the effects that ship with the library. */
export const BUILT_IN_EFFECT_NAMES: readonly string[] = Object.keys(MOTIONS);
