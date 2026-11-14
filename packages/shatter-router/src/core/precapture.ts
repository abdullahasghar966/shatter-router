import { OVERLAY_ATTRIBUTE } from './dom';
import type { Snapshot } from './snapshot';
import type { ViewportMetrics } from './viewport';

/** A pre-capture is thrown away if the click does not follow within this time. */
export const PRECAPTURE_TTL_MS = 2000;

function isOwnNode(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return element.hasAttribute(OVERLAY_ATTRIBUTE) || element.id.startsWith('__SANDBOX__');
}

/**
 * True for changes in Shatter's own nodes: the overlay, the live region, and
 * the capture library's sandbox iframe (it sets `srcdoc` after inserting it).
 */
function insideOwnNode(node: Node): boolean {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (!element) return false;
  if (element.id.startsWith('__SANDBOX__')) return true;
  return element.closest(`[${OVERLAY_ATTRIBUTE}]`) !== null;
}

/**
 * A capture started before the click (on pointerdown or hover). It is only
 * used if nothing changed in between: a MutationObserver marks it dirty on any
 * DOM change outside Shatter's own nodes, and the scroll position and
 * viewport size must still match.
 */
export class Precapture {
  readonly startedAt: number;
  private dirty = false;
  private abandoned = false;
  private snapshot: Snapshot | null = null;
  private readonly observer: MutationObserver | null;
  readonly result: Promise<Snapshot | null>;

  constructor(
    private readonly win: Window & typeof globalThis,
    private readonly viewport: ViewportMetrics,
    capture: () => Promise<Snapshot>,
  ) {
    this.startedAt = win.performance.now();
    this.observer =
      typeof win.MutationObserver === 'function'
        ? new win.MutationObserver((records) => {
            for (const record of records) {
              if (insideOwnNode(record.target)) continue;
              if (record.type === 'childList') {
                const changed = [...record.addedNodes, ...record.removedNodes];
                if (changed.length > 0 && changed.every(isOwnNode)) continue;
              }
              this.dirty = true;
              this.observer?.disconnect();
              return;
            }
          })
        : null;
    this.observer?.observe(win.document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    this.result = capture().then(
      (snapshot) => {
        if (this.abandoned) {
          snapshot.dispose();
          return null;
        }
        this.snapshot = snapshot;
        return snapshot;
      },
      () => null,
    );
  }

  get age(): number {
    return this.win.performance.now() - this.startedAt;
  }

  /** True if the page still looks exactly as it did when the capture started. */
  isValid(now: ViewportMetrics): boolean {
    const then = this.viewport;
    return (
      !this.dirty &&
      now.scrollX === then.scrollX &&
      now.scrollY === then.scrollY &&
      now.width === then.width &&
      now.height === then.height &&
      now.scale === then.scale
    );
  }

  /** Stops watching. The snapshot (if any) now belongs to the caller. */
  claim(): void {
    this.observer?.disconnect();
  }

  /** Stops watching and frees the snapshot, now or when it arrives. */
  abandon(): void {
    this.abandoned = true;
    this.observer?.disconnect();
    this.snapshot?.dispose();
    this.snapshot = null;
  }
}
