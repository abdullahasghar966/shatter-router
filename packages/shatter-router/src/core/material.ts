/**
 * Materials (ADR-057): what the pieces are made of. A material is a set of
 * shading parameters for the engine's one shader, not shader code, so any
 * material works with any pattern and motion. Every term is multiplied by the
 * engine's lighting gate (0 while a piece is at rest, faded in over the first
 * 60 ms of motion), so the first and last frames are the page whatever the
 * material (ADR-038).
 *
 * Built in: `'glass'` (default), `'ice'`, `'mirror'`, `'obsidian'`,
 * `'paper'`, `'metal'`, `'holo'`. A custom material is an object with a
 * `name` and any of the fields below; missing fields take glass's values.
 */
export interface ShatterMaterial {
  /** Name, for the debug hook and the navigation memory. */
  readonly name: string;
  /** Colour of the cut edges and sides, `#rgb` or `#rrggbb`. Glass: `'#cfe8ff'`. */
  readonly tint?: string;
  /** How much of the tint colours the sides, 0..1. Glass: 0.12. */
  readonly tintStrength?: number;
  /** Brightness of the sides relative to the page, 0..1. Glass: 0.55. */
  readonly sideShade?: number;
  /** Strength of the bright rim along each cut edge. Glass: 1. */
  readonly rim?: number;
  /** Width of that rim, CSS px. Glass: 2. */
  readonly rimWidth?: number;
  /** Strength of the specular glint as a piece turns. Glass: 0.55. */
  readonly glint?: number;
  /** Sharpness of the glint (Blinn-Phong exponent). Glass: 60. */
  readonly shininess?: number;
  /** Scale of the colour fringing along fast pieces (with `chromatic: true`). Glass: 1. */
  readonly chromatic?: number;
  /** Cloudiness of the faces while moving, 0..1 (a blur, like frosted ice). Glass: 0. */
  readonly frost?: number;
  /** How much a turning face mirrors a soft studio sky, 0..1. Glass: 0. */
  readonly reflect?: number;
  /** Thin-film colours on the rims and glints, 0..1. Glass: 0. */
  readonly iridescence?: number;
  /** Brushed streaks across the glint, 0..1 (metal). Glass: 0. */
  readonly brushed?: number;
  /** Faces turned away from the light darken, 0..1 (paper's soft shading, obsidian's depth). Glass: 0. */
  readonly diffuse?: number;
}

/** A material by name (built in) or as an object. */
export type MaterialSource = string | ShatterMaterial;

/** The materials that ship with the library. */
export const BUILT_IN_MATERIAL_NAMES = [
  'glass',
  'ice',
  'mirror',
  'obsidian',
  'paper',
  'metal',
  'holo',
] as const;

export type BuiltInMaterialName = (typeof BUILT_IN_MATERIAL_NAMES)[number];
