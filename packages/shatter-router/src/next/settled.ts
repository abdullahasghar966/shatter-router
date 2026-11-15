/**
 * The marker contract for `waitFor: 'settled'`: any element with this
 * attribute (put it on your `loading.tsx` UI, skeletons, spinners) means the
 * new page is still loading. The transition waits until none is left in the
 * document, bounded by `readyTimeout`.
 */
export const PENDING_ATTRIBUTE = 'data-shatter-pending';

const SELECTOR = `[${PENDING_ATTRIBUTE}]`;

/** Resolves once no `[data-shatter-pending]` element is in `doc`, or after `timeout` ms. */
export function waitForSettled(doc: Document, timeout: number): Promise<void> {
  if (doc.querySelector(SELECTOR) === null) return Promise.resolve();
  const win = doc.defaultView;
  if (!win) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      observer.disconnect();
      win.clearTimeout(timer);
      resolve();
    };
    const observer = new win.MutationObserver(() => {
      if (doc.querySelector(SELECTOR) === null) finish();
    });
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [PENDING_ATTRIBUTE],
    });
    const timer = win.setTimeout(finish, timeout);
  });
}
