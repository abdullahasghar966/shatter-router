/**
 * Glass shading settings (master prompt 5.5). The lighting itself lives in
 * the engine's shaders; these are the parts that can be checked without WebGL.
 */

/** Default tint of the glass' cut edges. */
export const DEFAULT_GLASS_TINT = '#cfe8ff';
/** How much of the tint colours the side (thickness) faces. */
export const GLASS_TINT_STRENGTH = 0.12;
/** Lighting fades in over this many seconds of motion; it is exactly 0 at t = 0. */
export const LIGHT_FADE_S = 0.06;
/** Chromatic aberration never exceeds this, CSS px. */
export const MAX_ABERRATION_PX = 1.5;
/** Screen speed, px/s, at which the aberration reaches its maximum. */
export const ABERRATION_FULL_SPEED = 1200;

export type Rgb = readonly [number, number, number];

/** Parses `#rgb` or `#rrggbb` into linear-free 0..1 channels; null when it is not one of those. */
export function parseHexColor(value: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  const hex = match?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const channel = (i: number): number => parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
  return [channel(0), channel(1), channel(2)];
}

/** The lighting fade-in at `t` seconds into the motion: 0 at 0, 1 from LIGHT_FADE_S on, smooth between. */
export function lightFade(t: number): number {
  if (t <= 0) return 0;
  if (t >= LIGHT_FADE_S) return 1;
  const x = t / LIGHT_FADE_S;
  return x * x * (3 - 2 * x);
}

/** Aberration in CSS px for a shard moving at `speed` px/s. */
export function aberrationPx(speed: number): number {
  return Math.min(
    MAX_ABERRATION_PX,
    (Math.max(0, speed) * MAX_ABERRATION_PX) / ABERRATION_FULL_SPEED,
  );
}
