import type { MaterialSource, ShatterMaterial } from '../core/material';
import { parseHexColor, type Rgb } from '../core/shading';
import { GLError } from './gl';

/** Every material field resolved to a number (ADR-057). */
export type ResolvedMaterial = Required<Omit<ShatterMaterial, 'tint'>> & { readonly tint: Rgb };

/** Glass: exactly the shading of M9 (ADR-038), the base every other material starts from. */
const GLASS: Required<ShatterMaterial> = {
  name: 'glass',
  tint: '#cfe8ff',
  tintStrength: 0.12,
  sideShade: 0.55,
  rim: 1,
  rimWidth: 2,
  glint: 0.55,
  shininess: 60,
  chromatic: 1,
  frost: 0,
  reflect: 0,
  iridescence: 0,
  brushed: 0,
  diffuse: 0,
};

/** The built-in materials, as differences from glass. */
const BUILT_IN: Readonly<Record<string, ShatterMaterial>> = {
  glass: GLASS,
  // Frosted: cloudy faces, wide white edges, a soft glint, little fringing.
  ice: {
    name: 'ice',
    tint: '#f4fbff',
    tintStrength: 0.45,
    sideShade: 0.85,
    rim: 1.3,
    rimWidth: 3.5,
    glint: 0.4,
    shininess: 24,
    chromatic: 0.5,
    frost: 0.85,
    diffuse: 0.1,
  },
  // A turning face mirrors a soft sky; a hard, bright glint.
  mirror: {
    name: 'mirror',
    tint: '#e9edf3',
    tintStrength: 0.3,
    sideShade: 0.7,
    rim: 0.8,
    rimWidth: 1.5,
    glint: 1,
    shininess: 120,
    chromatic: 0.2,
    reflect: 0.75,
  },
  // Dark volcanic glass: deep shade away from the light, a razor glint.
  obsidian: {
    name: 'obsidian',
    tint: '#2a2233',
    tintStrength: 0.6,
    sideShade: 0.25,
    rim: 0.7,
    rimWidth: 1.2,
    glint: 1.3,
    shininess: 220,
    chromatic: 0.6,
    diffuse: 0.6,
  },
  // No shine at all: white paper edges and soft shading as pieces turn.
  paper: {
    name: 'paper',
    tint: '#f2ede2',
    tintStrength: 0.85,
    sideShade: 0.95,
    rim: 0,
    glint: 0,
    chromatic: 0,
    diffuse: 0.45,
  },
  // Brushed steel: grey edges, a streaked glint, a dull reflection.
  metal: {
    name: 'metal',
    tint: '#b8bcc4',
    tintStrength: 0.6,
    sideShade: 0.5,
    rim: 0.9,
    rimWidth: 1.5,
    glint: 0.9,
    shininess: 40,
    chromatic: 0,
    reflect: 0.25,
    brushed: 0.8,
    diffuse: 0.3,
  },
  // Holographic foil: thin-film colours along the edges and in the glint.
  holo: {
    name: 'holo',
    tint: '#e0d4ff',
    tintStrength: 0.3,
    sideShade: 0.6,
    rim: 1.4,
    rimWidth: 2.5,
    glint: 0.8,
    shininess: 50,
    chromatic: 1.6,
    iridescence: 1,
  },
};

function finite(value: number | undefined, fallback: number, min: number, max: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/**
 * A material by name or object, every field filled in from glass and clamped
 * to a sane range. Throws for an unknown name (the transition then falls
 * back and navigation completes, as for an unknown effect).
 */
export function resolveMaterial(source: MaterialSource): ResolvedMaterial {
  const spec = typeof source === 'string' ? BUILT_IN[source] : source;
  if (!spec)
    throw new GLError(`Unknown material "${typeof source === 'string' ? source : source.name}"`);
  const base = typeof source === 'string' ? GLASS : { ...GLASS, ...(BUILT_IN[source.name] ?? {}) };
  const tint = parseHexColor(spec.tint ?? base.tint) ??
    parseHexColor(GLASS.tint) ?? [0.812, 0.91, 1];
  return {
    name: spec.name,
    tint,
    tintStrength: finite(spec.tintStrength, base.tintStrength, 0, 1),
    sideShade: finite(spec.sideShade, base.sideShade, 0, 1),
    rim: finite(spec.rim, base.rim, 0, 4),
    rimWidth: finite(spec.rimWidth, base.rimWidth, 0.1, 16),
    glint: finite(spec.glint, base.glint, 0, 4),
    shininess: finite(spec.shininess, base.shininess, 1, 1000),
    chromatic: finite(spec.chromatic, base.chromatic, 0, 4),
    frost: finite(spec.frost, base.frost, 0, 1),
    reflect: finite(spec.reflect, base.reflect, 0, 1),
    iridescence: finite(spec.iridescence, base.iridescence, 0, 1),
    brushed: finite(spec.brushed, base.brushed, 0, 1),
    diffuse: finite(spec.diffuse, base.diffuse, 0, 1),
  };
}

/** Floats in `packMaterial`'s output: three vec4 uniforms (`uMatA`, `uMatB`, `uMatC`). */
export const MATERIAL_FLOATS = 12;

/**
 * The shader's material uniforms:
 *   uMatA = (rim, rimWidth, glint, shininess)
 *   uMatB = (chromatic, frost, reflect, iridescence)
 *   uMatC = (brushed, sideShade, diffuse, tintStrength)
 */
export function packMaterial(material: ResolvedMaterial, out: Float32Array): Float32Array {
  out[0] = material.rim;
  out[1] = material.rimWidth;
  out[2] = material.glint;
  out[3] = material.shininess;
  out[4] = material.chromatic;
  out[5] = material.frost;
  out[6] = material.reflect;
  out[7] = material.iridescence;
  out[8] = material.brushed;
  out[9] = material.sideShade;
  out[10] = material.diffuse;
  out[11] = material.tintStrength;
  return out;
}
