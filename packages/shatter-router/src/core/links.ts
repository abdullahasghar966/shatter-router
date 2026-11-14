/** Why a click on a link was left to the browser instead of being shattered. */
export type LinkSkipReason =
  | 'default-prevented'
  | 'not-primary-button'
  | 'modifier-key'
  | 'opt-out'
  | 'no-href'
  | 'target'
  | 'download'
  | 'non-http-protocol'
  | 'external-origin'
  | 'same-page-hash';

export type LinkClickDecision =
  | { readonly intercept: true; readonly url: URL }
  | { readonly intercept: false; readonly reason: LinkSkipReason };

/** The subset of `MouseEvent` the interception rules look at. */
export interface LinkClickEvent {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
}

/** The subset of `Location` the interception rules look at. */
export interface LinkLocation {
  readonly href: string;
}

/**
 * Finds the `<a>` element a click landed on, looking through shadow roots via
 * `composedPath()` so links inside web components are found too.
 */
export function findAnchor(event: Event): HTMLAnchorElement | null {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLAnchorElement) return node;
  }
  return null;
}

function effectiveTarget(anchor: HTMLAnchorElement): string {
  const own = anchor.getAttribute('target');
  if (own !== null) return own;
  const base = anchor.ownerDocument.querySelector('base[target]');
  return base?.getAttribute('target') ?? '';
}

/**
 * Decides whether a click on `anchor` may be turned into a Shatter transition.
 * Anything the browser would handle specially (new tabs, downloads, other
 * origins, in-page anchors) is left alone so native link behaviour is kept.
 */
export function classifyLinkClick(
  event: LinkClickEvent,
  anchor: HTMLAnchorElement,
  current: LinkLocation = anchor.ownerDocument.location,
): LinkClickDecision {
  if (event.defaultPrevented) return { intercept: false, reason: 'default-prevented' };
  if (event.button !== 0) return { intercept: false, reason: 'not-primary-button' };
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return { intercept: false, reason: 'modifier-key' };
  }
  if (anchor.closest('[data-shatter="off"]') !== null) {
    return { intercept: false, reason: 'opt-out' };
  }
  const rawHref = anchor.getAttribute('href');
  if (rawHref === null) return { intercept: false, reason: 'no-href' };

  const target = effectiveTarget(anchor).trim().toLowerCase();
  if (target !== '' && target !== '_self') return { intercept: false, reason: 'target' };
  if (anchor.hasAttribute('download')) return { intercept: false, reason: 'download' };

  const here = new URL(current.href);
  const url = new URL(rawHref, anchor.baseURI || here.href);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { intercept: false, reason: 'non-http-protocol' };
  }
  if (url.origin !== here.origin) return { intercept: false, reason: 'external-origin' };
  if (url.pathname === here.pathname && url.search === here.search && url.hash !== '') {
    return { intercept: false, reason: 'same-page-hash' };
  }
  return { intercept: true, url };
}

/** The per-link effect override from `data-shatter-effect`, if any. */
export function getLinkEffect(anchor: Element): string | undefined {
  const value = anchor.closest('[data-shatter-effect]')?.getAttribute('data-shatter-effect');
  return value === null || value === undefined || value.trim() === '' ? undefined : value.trim();
}
