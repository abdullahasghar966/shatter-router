/** True when running in a browser with a DOM. Safe to call during SSR. */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** True when the user asked the OS to reduce motion. False during SSR. */
export function prefersReducedMotion(): boolean {
  return (
    isBrowser() &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
