/** States of a transition (master prompt, section 4). */
export type TransitionState =
  | 'idle'
  | 'capturing'
  | 'covering'
  | 'committing'
  | 'waiting'
  | 'animating'
  | 'revealing'
  | 'fallback';

/**
 * Allowed moves. `→ idle` from capturing/covering is a cancellation (a newer
 * navigation superseded this one before it committed). Any state may move to
 * `fallback` when something fails; `fallback` always ends in `idle`.
 */
export const TRANSITIONS: Readonly<Record<TransitionState, readonly TransitionState[]>> = {
  idle: ['capturing', 'fallback'],
  capturing: ['covering', 'fallback', 'idle'],
  covering: ['committing', 'fallback', 'idle'],
  committing: ['waiting', 'fallback'],
  waiting: ['animating', 'revealing', 'fallback'],
  animating: ['revealing', 'fallback'],
  revealing: ['idle', 'fallback'],
  fallback: ['idle'],
};

export class InvalidTransition extends Error {
  override readonly name = 'InvalidTransition';
  constructor(
    readonly from: TransitionState,
    readonly to: TransitionState,
  ) {
    super(`Invalid state change ${from} → ${to}`);
  }
}

/** Milliseconds spent in each phase of the most recent transition. */
export type PhaseTimings = Partial<Record<Exclude<TransitionState, 'idle'>, number>>;

/**
 * The typed state machine. `enter()` refuses moves the table does not allow,
 * so a bug shows up as an error (and a fallback) instead of a stuck overlay.
 * Records how long each phase took.
 */
export class StateMachine {
  private current: TransitionState = 'idle';
  private enteredAt = 0;
  private timings: PhaseTimings = {};

  constructor(
    private readonly now: () => number,
    private readonly onChange?: (state: TransitionState, previous: TransitionState) => void,
  ) {}

  get state(): TransitionState {
    return this.current;
  }

  /** Durations of the phases of the latest transition (reset when a new one starts). */
  get phaseTimings(): PhaseTimings {
    return { ...this.timings };
  }

  canEnter(next: TransitionState): boolean {
    return TRANSITIONS[this.current].includes(next);
  }

  enter(next: TransitionState): void {
    const previous = this.current;
    if (previous === next) return;
    if (!this.canEnter(next)) throw new InvalidTransition(previous, next);
    const now = this.now();
    if (previous === 'idle') this.timings = {};
    else this.timings[previous] = (this.timings[previous] ?? 0) + (now - this.enteredAt);
    this.current = next;
    this.enteredAt = now;
    this.onChange?.(next, previous);
  }
}
