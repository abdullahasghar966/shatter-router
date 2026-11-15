/**
 * Settling motion for effects that land on a rest pose (`flip`, `assemble`).
 *
 * A critically damped spring released at 0 towards 1:
 *   s(τ) = 1 − (1 + ωτ)·e^(−ωτ)
 * rises monotonically and never overshoots. It only approaches 1, so it is
 * snapped to exactly 1 at τ = T, where ω·T = SETTLE_STIFFNESS makes the
 * remaining distance 8·10⁻⁵ of the travel (a hundredth of a pixel for a 100 px
 * move): the last frame is the exact rest pose, with no visible jump.
 *
 * `settle()` here and `settle()` in GLSL (`SETTLE_GLSL`) are the same function.
 */
export const SETTLE_STIFFNESS = 12;

/** Progress 0..1 at `t` of a settle that lasts `T` (same units), exactly 1 from `T` on. */
export function settle(t: number, T: number): number {
  if (t <= 0 || T <= 0) return T <= 0 ? 1 : 0;
  if (t >= T) return 1;
  const wt = (SETTLE_STIFFNESS * t) / T;
  return 1 - (1 + wt) * Math.exp(-wt);
}

/** The GLSL twin of `settle()`, available to every effect chunk. */
export const SETTLE_GLSL = /* glsl */ `
float settle(float t, float T) {
  if (T <= 0.0) return 1.0;
  if (t <= 0.0) return 0.0;
  if (t >= T) return 1.0;
  float wt = ${SETTLE_STIFFNESS.toFixed(1)} * t / T;
  return 1.0 - (1.0 + wt) * exp(-wt);
}
`;
