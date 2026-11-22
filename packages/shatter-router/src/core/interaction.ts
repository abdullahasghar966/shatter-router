/**
 * Interaction (ADR-060, plan 3.5): a cursor kit that shows where the glass
 * will break, press-and-hold to charge the break, drag across a link to tear
 * the page along the drag, long-press charge with haptic ticks on touch. The
 * code is a lazy chunk, loaded at idle only when the `interaction` option is
 * set. A gesture is remembered for the next transition, so every adapter
 * (vanilla, React, React Router, Next.js) gets it without changes.
 */

export interface InteractionOptions {
  /**
   * A cursor that follows the pointer and arms over links (decorative: the
   * native cursor stays). Default `'ring'`; `'none'` for no cursor.
   */
  readonly cursor?: 'ring' | 'reticle' | 'hammer' | 'glass-cutter' | 'none';
  /** Press and hold a link to hit harder (stronger impulse). Default true. */
  readonly charge?: boolean;
  /** Drag across a link (mouse or pen) to tear the page along the drag. Default true. */
  readonly tear?: boolean;
  /** A hairline crack grows under the cursor while it rests on a link. Default true. */
  readonly preCrack?: boolean;
  /** Haptic ticks while charging and on the break (touch, where allowed). Default true. */
  readonly haptics?: boolean;
}

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
}

/** What a gesture contributes to the next transition. */
export interface Gesture {
  /** Where the glass breaks, viewport px. */
  readonly origin: GesturePoint;
  /** 0..1; a plain click is 0.5. */
  readonly intensity: number;
  /** A tear: the drag path, viewport px (2–8 points). */
  readonly path?: readonly GesturePoint[];
}

/** What the interaction chunk needs from the core. */
export interface InteractionHost {
  readonly window: Window;
  /** The link a pointer event is on, when Shatter would play an effect for a click on it. */
  shatterLink(event: PointerEvent): HTMLAnchorElement | null;
  /** Remembers the gesture for the transition that follows. */
  gesture(gesture: Gesture): void;
  /** True while a transition is running. */
  busy(): boolean;
  /** Calls `listener(true)` when a transition starts and `listener(false)` when it ends; returns an unsubscribe. */
  watch(listener: (running: boolean) => void): () => void;
}

/** The running interaction, as the lazy chunk returns it. */
export interface Interaction {
  destroy(): void;
}

/** How long a gesture waits for its transition, ms. */
export const GESTURE_TTL_MS = 1500;

/** Intensity without a charge. */
export const DEFAULT_INTENSITY = 0.5;
