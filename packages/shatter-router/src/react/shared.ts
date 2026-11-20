import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { EffectSource } from '../core/compose';
import { classifyLinkClick, getLinkEffect } from '../core/links';
import { createShatter } from '../core/shatter';
import type { Point, Shatter, ShatterOptions } from '../core/types';

/** The runtime's default `readyTimeout` (master prompt, section 4.6). */
export const DEFAULT_READY_TIMEOUT = 1500;

/**
 * Bounds a router commit: resolves when `commit` does or after `timeout` ms,
 * whichever comes first, so a navigation that never renders (blocked, slow
 * loader) cannot keep the overlay up. Errors from `commit` are passed on.
 */
export function boundedCommit(commit: () => unknown, timeout: number): Promise<void> {
  let result: unknown;
  try {
    result = commit();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, timeout);
    Promise.resolve(result).then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Scrolls the element a URL fragment points at into view, if it exists. */
export function scrollToFragment(hash: string): void {
  let id = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the raw fragment.
  }
  if (id) document.getElementById(id)?.scrollIntoView();
}

/** Logs a navigation that failed inside a click handler, where nobody awaits it. */
export function reportNavigationError(error: unknown): void {
  console.error('[shatter-router] navigation failed', error);
}

/**
 * The impact point of a link activation: the pointer position for a pointer
 * click, the centre of the link for keyboard activation (which reports 0,0).
 */
export function clickOrigin(event: MouseEvent<HTMLAnchorElement>): Point {
  if (event.detail > 0) return { x: event.clientX, y: event.clientY };
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Starts a transition for an intercepted click on a link to `url`. */
export type LinkStart = (origin: Point, effect: EffectSource | undefined, url: URL) => void;

/**
 * The click handler of every Shatter link component. Runs the app's own
 * `onClick` first, then intercepts only clicks the core rules allow (no
 * modifier or middle clicks, no `target`, `download`, other origins,
 * `data-shatter="off"` or same-page hashes). Everything else keeps native
 * link behaviour. With `start === null` (not mounted yet, no router) nothing
 * is intercepted.
 */
export function useShatterClick(
  onClick: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined,
  effect: EffectSource | undefined,
  start: LinkStart | null,
): (event: MouseEvent<HTMLAnchorElement>) => void {
  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!start) return;
      const anchor = event.currentTarget;
      const decision = classifyLinkClick(event, anchor);
      if (!decision.intercept) return;
      event.preventDefault();
      start(clickOrigin(event), effect ?? getLinkEffect(anchor), decision.url);
    },
    [onClick, effect, start],
  );
}

/**
 * One Shatter instance for the provider's lifetime: created after mount (so
 * SSR and the first render never touch the DOM), destroyed on unmount, and
 * re-created when React StrictMode remounts. `options` are read once.
 * A caller-owned `instance` is used as is and never destroyed here.
 */
export function useShatterInstance(
  options: ShatterOptions | undefined,
  instance: Shatter | undefined,
): Shatter | null {
  const [shatter, setShatter] = useState<Shatter | null>(instance ?? null);
  const optionsRef = useRef(options);
  useEffect(() => {
    if (instance) {
      setShatter(instance);
      return undefined;
    }
    const created = createShatter(optionsRef.current ?? {});
    setShatter(created);
    return () => {
      created.destroy();
      setShatter(null);
    };
  }, [instance]);
  return shatter;
}

/** Keeps the latest value in a ref, for callbacks that must stay stable. */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
