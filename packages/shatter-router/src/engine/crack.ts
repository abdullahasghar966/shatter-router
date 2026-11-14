/** Crack propagation timing (master prompt 5.2). */
export const CRACK_DURATION_MS = 140;
export const CRACK_HOLD_MS = 40;

/** Peak strength of the impact flash and when it peaks. */
const FLASH_PEAK = 0.55;
const FLASH_PEAK_MS = 18;

export interface CrackFrame {
  /** CSS px the crack front has travelled from the impact point. */
  readonly radius: number;
  /** 0..1 strength of the impact flash. */
  readonly flash: number;
  /** True once the front has reached the farthest corner and the hold is over. */
  readonly done: boolean;
}

/** easeOutCubic: fast at the impact, slowing as the cracks reach the edges. */
function easeOut(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * State of the crack at `elapsed` ms. The front starts at radius 0 (no crack
 * visible, flash 0) so the first frame is the untouched page, reaches
 * `maxRadius` after `duration`, then holds for `hold` ms.
 */
export function crackAt(
  elapsed: number,
  maxRadius: number,
  duration: number = CRACK_DURATION_MS,
  hold: number = CRACK_HOLD_MS,
): CrackFrame {
  const t = Math.max(0, elapsed);
  const progress = duration > 0 ? Math.min(1, t / duration) : 1;
  // A small overshoot past the farthest corner makes sure the last fragment is reached.
  const radius = progress <= 0 ? 0 : easeOut(progress) * (maxRadius + 2);
  // Squared gamma pulse: 0 at t = 0, peak at FLASH_PEAK_MS, ~10 % left at
  // 3x that and gone well before the crack finishes.
  const k = t / FLASH_PEAK_MS;
  const pulse = k * Math.exp(1 - k);
  const flash = t <= 0 ? 0 : FLASH_PEAK * pulse * pulse;
  return { radius, flash: flash < 1e-3 ? 0 : flash, done: t >= duration + hold };
}
