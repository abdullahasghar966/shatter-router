/**
 * Easing of the motion's time (ADR-059): how the motion phase is paced, for
 * any motion. The engine maps the time before every frame and every
 * completion check, `eased = duration · f(t / duration)`, with `f(0) = 0` and
 * `f(1) = 1`, so the first and last frames are the motion's own (the seams
 * hold) and only the pace in between changes.
 */
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** The time `t` (any unit) of a phase `duration` long, eased; unchanged outside the phase. */
export function easeTime(easing: Easing | undefined, t: number, duration: number): number {
  if (!easing || easing === 'linear' || duration <= 0 || t <= 0 || t >= duration) return t;
  const x = t / duration;
  const y =
    easing === 'ease-in' ? x * x : easing === 'ease-out' ? x * (2 - x) : x * x * (3 - 2 * x);
  return duration * y;
}

/** The easing that plays a motion's time reverse exactly: `D − f'(t) = f(D − t)`. */
export function mirrorEasing(easing: Easing | undefined): Easing | undefined {
  if (easing === 'ease-in') return 'ease-out';
  if (easing === 'ease-out') return 'ease-in';
  return easing;
}
