/**
 * Decides whether a `popstate` is held back from the router. Returns true to
 * stop it from reaching any later listener.
 */
export type PopHolder = (event: PopStateEvent) => boolean;

let installed = false;
let holder: PopHolder | null = null;

/**
 * Adds the page-lifetime `popstate` gate on `window`, once. It must be added
 * **before** the router's own listener:
 *
 * - Chromium runs listeners at the `window` target in registration order,
 *   capture or not (WebKit and Firefox run capture listeners first), and
 * - React 19 renders a router update made inside a `popstate` event
 *   synchronously, in that same event (`shouldAttemptEagerTransition`),
 *
 * so a listener that runs after the router's sees the new route already in
 * the DOM and can no longer capture the old one (ADR-028).
 */
export function installPopGate(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener(
    'popstate',
    (event) => {
      if (holder?.(event)) event.stopImmediatePropagation();
    },
    true,
  );
}

/** Makes `next` decide about the next popstates; null passes them all through. */
export function setPopHolder(next: PopHolder | null): void {
  holder = next;
}
