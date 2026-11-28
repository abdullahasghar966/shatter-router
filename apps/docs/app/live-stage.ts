'use client';

import { type RefObject, useEffect, useRef } from 'react';
import type { Shatter, TransitionRequest } from 'shatter-router';
import { useShatter } from 'shatter-router/next';

/** An effect name, or an effect composition with its pattern and material. */
export type StageEffect = NonNullable<TransitionRequest['effect']>;

/**
 * Breaks `target` in place with `effect` (ADR-063): only that element breaks,
 * the rest of the page stays live, and nothing navigates (the commit changes
 * nothing, so the element is whole again when the break ends).
 */
export function breakInPlace(
  shatter: Shatter,
  target: Element,
  effect: StageEffect,
  passthrough = false,
): Promise<void> {
  return shatter.transition({
    target,
    effect,
    commit: () => undefined,
    ...(passthrough ? { passthrough: true } : {}),
  });
}

/**
 * A live stage (ADR-067): the element breaks in place once the pointer has
 * rested on it for `holdMs`. It breaks once per visit: it arms again only when
 * the pointer leaves the element's box (the break's own overlay takes the
 * pointer, which must not re-arm it). Pointer devices only: touch has no hover.
 */
export function useHoverHoldBreak(
  ref: RefObject<HTMLElement | null>,
  effect: StageEffect,
  holdMs = 600,
): void {
  const shatter = useShatter();
  const effectRef = useRef(effect);
  useEffect(() => {
    effectRef.current = effect;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !shatter || !window.matchMedia('(hover: hover)').matches) return undefined;
    let timer = 0;
    let spent = false;
    const cancel = (): void => {
      window.clearTimeout(timer);
    };
    // Inside the element's box: pointerleave is not reliable on every engine
    // (Firefox kept the hold running after the pointer had left).
    const inside = (event: PointerEvent): boolean => {
      const box = el.getBoundingClientRect();
      return (
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      );
    };
    const enter = (): void => {
      cancel();
      if (spent) return;
      timer = window.setTimeout(() => {
        spent = true;
        // Clicks pass through the preview: a click on the card follows its link (ADR-068).
        void breakInPlace(shatter, el, effectRef.current, true);
      }, holdMs);
    };
    const leave = (event: PointerEvent): void => {
      cancel();
      if (!inside(event)) spent = false;
    };
    // Any move that takes the pointer off the element ends the hold.
    const move = (event: PointerEvent): void => {
      if (timer !== 0 && !inside(event)) cancel();
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    document.addEventListener('pointermove', move);
    return () => {
      cancel();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      document.removeEventListener('pointermove', move);
    };
  }, [ref, shatter, holdMs]);
}
