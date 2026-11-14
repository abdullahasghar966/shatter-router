import { OVERLAY_ATTRIBUTE } from './dom';
import { nextFrame } from './frame';

/** Where to scroll the new page under the overlay. */
export type ScrollTarget = 'top' | 'none' | { readonly x: number; readonly y: number };

/** Resolves after `ms`, or as soon as `signal` aborts. */
function delay(win: Window, ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = win.setTimeout(done, ms);
    function done(): void {
      win.clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Decodes every `<img>` that intersects the viewport, in parallel. */
function decodeVisibleImages(doc: Document, win: Window): Promise<unknown> {
  const width = win.innerWidth;
  const height = win.innerHeight;
  const pending: Promise<void>[] = [];
  for (const image of doc.querySelectorAll('img')) {
    if (image.closest(`[${OVERLAY_ATTRIBUTE}]`)) continue;
    const rect = image.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= height || rect.left >= width) continue;
    if (rect.width === 0 || rect.height === 0) continue;
    if (typeof image.decode !== 'function') continue;
    // decode() rejects for broken images; that must not hold up navigation.
    pending.push(image.decode().catch(() => undefined));
  }
  return Promise.all(pending);
}

/**
 * The waiting phase (master prompt 4.6): with the new route committed under
 * the overlay, scroll it, then wait for web fonts and for images in the
 * viewport to decode, then two frames for layout to settle. Bounded by
 * `timeout` ms; an aborted `signal` ends the wait at once.
 */
export async function waitUntilReady(
  doc: Document,
  scroll: ScrollTarget,
  timeout: number,
  signal?: AbortSignal,
): Promise<void> {
  const win = doc.defaultView;
  if (!win) return;
  if (scroll === 'top') win.scrollTo(0, 0);
  else if (scroll !== 'none') win.scrollTo(scroll.x, scroll.y);

  // `document.fonts` is missing in some environments (older WebViews, test DOMs).
  const fonts = (doc as Partial<Pick<Document, 'fonts'>>).fonts;
  const loaded = Promise.all([fonts?.ready.catch(() => undefined), decodeVisibleImages(doc, win)]);
  await Promise.race([loaded, delay(win, timeout, signal)]);
  if (signal?.aborted) return;
  await nextFrame(win);
  await nextFrame(win);
}
