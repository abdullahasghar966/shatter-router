/** A custom lock for apps with their own scroller (Lenis, Locomotive, …). */
export interface ScrollLock {
  lock(): void;
  unlock(): void;
}

const SCROLL_KEYS = new Set([
  ' ',
  'Spacebar',
  'PageUp',
  'PageDown',
  'End',
  'Home',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') !==
    null
  );
}

/**
 * Blocks user scrolling without touching layout (master prompt 3.7): wheel,
 * touch and scroll keys are cancelled by listeners. `overflow: hidden` on
 * `<html>` is never used because it can hide the scrollbar and shift the page.
 * Programmatic scrolling (`scrollTo`) still works.
 */
export function createScrollLock(win: Window, custom?: ScrollLock): ScrollLock {
  let locked = false;
  const prevent = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key) && !isEditable(event.target)) prevent(event);
  };
  const options: AddEventListenerOptions = { capture: true, passive: false };
  return {
    lock() {
      if (locked) return;
      locked = true;
      win.addEventListener('wheel', prevent, options);
      win.addEventListener('touchmove', prevent, options);
      win.addEventListener('keydown', onKey, options);
      custom?.lock();
    },
    unlock() {
      if (!locked) return;
      locked = false;
      win.removeEventListener('wheel', prevent, options);
      win.removeEventListener('touchmove', prevent, options);
      win.removeEventListener('keydown', onKey, options);
      custom?.unlock();
    },
  };
}
