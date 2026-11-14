import { OVERLAY_ATTRIBUTE } from './dom';

const FOCUSABLE =
  'a[href],area[href],button,input,select,textarea,iframe,summary,[contenteditable],[tabindex]';

/**
 * Moves focus to the new page's starting point (master prompt, section 9):
 * `[data-shatter-focus]`, else the first `h1` in `main`, else `main`.
 * Elements that are not focusable get `tabindex="-1"` until they lose focus.
 */
export function focusNewPage(doc: Document): HTMLElement | null {
  const target =
    doc.querySelector<HTMLElement>('[data-shatter-focus]') ??
    doc.querySelector<HTMLElement>('main h1') ??
    doc.querySelector<HTMLElement>('main');
  if (!target) return null;
  if (!target.matches(FOCUSABLE)) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener(
      'blur',
      () => {
        if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
      },
      { once: true },
    );
  }
  target.focus({ preventScroll: true });
  return target;
}

const announcers = new WeakMap<Document, HTMLElement>();

/** A visually hidden `aria-live="polite"` region, created once per document. */
function announcer(doc: Document): HTMLElement {
  let region = announcers.get(doc);
  if (region?.isConnected) return region;
  region = doc.createElement('div');
  // Marked as Shatter's own so capture and mutation tracking skip it.
  region.setAttribute(OVERLAY_ATTRIBUTE, 'announcer');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
  doc.body.append(region);
  announcers.set(doc, region);
  return region;
}

/** Announces the new page title to screen readers. */
export function announceTitle(doc: Document): void {
  const title = doc.title.trim();
  if (!title) return;
  const region = announcer(doc);
  // Clear first so the same title twice is still announced.
  region.textContent = '';
  doc.defaultView?.setTimeout(() => {
    region.textContent = title;
  }, 50);
}
