import {
  createContext,
  destroyContext,
  domToForeignObjectSvg,
  type Context,
} from 'modern-screenshot';
import { CaptureError, type CaptureRequest, type Capturer, type Snapshot } from '../core/snapshot';
import { deviceSize } from '../core/viewport';
import { CloneSession, settleScroll } from './clone-session';
import { liveFaceStatus, pruneFontFaces } from './fonts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Characters that are not allowed in XML and would make the SVG fail to parse. */
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const INVALID_XML = /[\u0000-\u0008\v\f\u000E-\u001F\uD800-\uDFFF￾￿]/gu;

/** Mirrors the helper class the capture library relies on for `background-clip: text`. */
const SVG_BASE_CSS =
  '.______background-clip--text{background-clip:text;-webkit-background-clip:text;}';

function loadImage(doc: Document, url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = doc.createElement('img');
    image.decoding = 'sync';
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new CaptureError('The rendered page could not be decoded as an image'));
    };
    image.src = url;
  });
}

/** How the copy is laid out before it is rasterised at the device scale. */
export type LayoutGrid = 'css' | 'device';

/**
 * Picks the grid the copy must be laid out on so that it matches the live page.
 *
 * On a 2x display the live page and an SVG image of it do not round the same
 * way in every engine (measured with the seam tests, see context/LEARNINGS.md):
 * - Blink places text lines on whole CSS pixels, live and inside an SVG image
 *   alike, so a copy laid out in CSS pixels and scaled while rasterising matches.
 *   Laying it out in device pixels would move lines by one device pixel.
 * - WebKit places lines and box edges on whole device pixels in the live page
 *   but on whole CSS pixels inside an SVG image, so the copy has to be laid out
 *   in device pixels (CSS zoom) to match.
 * Canvas pixels cannot tell how the live page was rounded, so this is keyed on
 * the engine: every browser on Apple's engine reports Apple as its vendor.
 */
function layoutGridFor(win: Window): LayoutGrid {
  return win.navigator.vendor.startsWith('Apple') ? 'device' : 'css';
}

/**
 * Captures the viewport by cloning the DOM into an SVG `<foreignObject>`
 * (via modern-screenshot) and rasterising that SVG onto a 2D canvas.
 *
 * One library context is kept for the life of the capturer: it caches default
 * computed styles, fetched images and embedded fonts, which is most of the
 * cost of a capture.
 */
export class DomCapturer implements Capturer {
  private context: Context<HTMLElement> | null = null;
  private contextPromise: Promise<Context<HTMLElement>> | null = null;
  private destroyed = false;
  private queue: Promise<unknown> = Promise.resolve();

  /** The grid this engine needs the copy laid out on (see `layoutGridFor`). */
  readonly layoutGrid: LayoutGrid;

  constructor(private readonly doc: Document) {
    this.layoutGrid = doc.defaultView ? layoutGridFor(doc.defaultView) : 'css';
  }

  /** Creates the library context ahead of the first capture. */
  async warmUp(): Promise<void> {
    await this.ensureContext();
  }

  /**
   * Captures the viewport. Calls are serialised: the library context is shared
   * and its hooks hold per-capture state, so captures must never overlap.
   */
  capture(request: CaptureRequest): Promise<Snapshot> {
    const run = this.queue.then(() => this.captureNow(request));
    // Keep the queue alive past a failed capture.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async captureNow(request: CaptureRequest): Promise<Snapshot> {
    const started = performance.now();
    const { doc } = this;
    const { viewport } = request;
    const size = deviceSize(viewport, request.maxTextureSize);
    const context = await this.ensureContext();
    // Measure only after the await: the page may have scrolled meanwhile.
    const win = doc.defaultView;
    if (win) settleScroll(win);
    const rootRect = doc.documentElement.getBoundingClientRect();
    const session = new CloneSession(doc, {
      width: viewport.width,
      height: viewport.height,
      rootRect,
      scroll: { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 },
      layoutScale: this.layoutGrid === 'device' ? size.scale : 1,
    });

    context.width = rootRect.width;
    context.height = rootRect.height;
    context.filter = session.filter;
    context.onCloneEachNode = session.onCloneEachNode;
    context.onCloneNode = session.onCloneNode;
    context.onCreateForeignObjectSvg = session.onCreateForeignObjectSvg;

    let svg: SVGElement;
    const style = context.svgStyleElement;
    try {
      svg = await domToForeignObjectSvg(context);
      // Only the font files that can draw this page's text (ADR-051).
      if (style) pruneFontFaces(style, context.fontFamilies, liveFaceStatus(doc));
    } finally {
      this.resetContext(context);
    }
    if (session.broken) throw new CaptureError('Lost track of the DOM while cloning it');

    const xml = new XMLSerializer().serializeToString(svg).replace(INVALID_XML, '');
    const image = await loadImage(
      doc,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`,
    );

    const canvas = doc.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    // A CPU-backed canvas uploads to WebGL without a GPU read-back stall.
    const context2d = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context2d) throw new CaptureError('2D canvas is not available');
    if (session.fillColor) {
      context2d.fillStyle = session.fillColor;
      context2d.fillRect(0, 0, size.width, size.height);
    }
    context2d.drawImage(image, 0, 0, size.width, size.height);

    let disposed = false;
    return {
      source: canvas,
      width: viewport.width,
      height: viewport.height,
      deviceWidth: size.width,
      deviceHeight: size.height,
      duration: performance.now() - started,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        // Shrinking the canvas releases its backing store right away.
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.context) destroyContext(this.context);
    this.context = null;
    this.contextPromise = null;
  }

  private ensureContext(): Promise<Context<HTMLElement>> {
    this.contextPromise ??= createContext(this.doc.documentElement, {
      autoDestruct: false,
      // The page's own scroll offset is handled through the SVG viewBox and
      // nested scrollers by CloneSession, so the library must not shift anything.
      features: { restoreScrollPosition: false },
      // Bounds waiting for media and fetching assets.
      timeout: 2000,
    }).then(async (context) => {
      if (this.destroyed) {
        destroyContext(context);
        return context;
      }
      context.sandbox ??= createSandbox(this.doc);
      // The library reads default styles inside the frame; reading them before
      // its document has loaded forces layout early (a Firefox warning).
      if (context.sandbox) await frameLoaded(context.sandbox, SANDBOX_LOAD_TIMEOUT_MS);
      // Real properties only (ADR-051): computed values are already
      // resolved, so custom properties (a design system's tokens) are dead
      // weight that the library would copy onto every element of the copy.
      context.includeStyleProperties = standardProperties(this.doc);
      // destroy() may have run during the await above.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.destroyed) destroyContext(context);
      else this.context = context;
      return context;
    });
    return this.contextPromise;
  }

  /** Gives the reused context fresh per-capture state (the SVG takes ownership of the old). */
  private resetContext(context: Context<HTMLElement>): void {
    const style = this.doc.createElement('style');
    style.append(this.doc.createTextNode(SVG_BASE_CSS));
    context.svgStyleElement = style;
    context.svgDefsElement = this.doc.createElementNS(SVG_NAMESPACE, 'defs');
    context.svgStyles.clear();
    context.shadowRoots = [];
    context.tasks = [];
    context.filter = null;
    context.onCloneEachNode = null;
    context.onCloneNode = null;
    context.onCreateForeignObjectSvg = null;
  }
}

/**
 * The hidden iframe modern-screenshot reads default styles from. The library
 * makes its own by appending the frame and then setting `srcdoc`: navigating
 * a frame that is already in the document adds a session-history entry in
 * Firefox, so the user's next Back press went nowhere visible (PR #11 CI).
 * A frame whose `srcdoc` is set before it is inserted loads as its initial
 * navigation, which never adds history (ADR-044). Same attributes as the
 * library's; `destroyContext` removes it.
 */
/** How long a capture waits for its sandbox frame to load, at most. */
const SANDBOX_LOAD_TIMEOUT_MS = 1000;

/** Resolves once the frame's own document has loaded (or after `timeout` ms). */
export function frameLoaded(frame: HTMLIFrameElement, timeout: number): Promise<void> {
  const ready = (): boolean => {
    const document = frame.contentDocument;
    return (
      document !== null && document.URL === 'about:srcdoc' && document.readyState === 'complete'
    );
  };
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      frame.removeEventListener('load', done);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    frame.addEventListener('load', done);
  });
}

function createSandbox(doc: Document): HTMLIFrameElement | undefined {
  const body = doc.body as HTMLElement | null;
  if (!body) return undefined;
  const sandbox = doc.createElement('iframe');
  sandbox.width = '0';
  sandbox.height = '0';
  // Not rendered at all: the library only reads computed styles in it, and a
  // frame without layout cannot have its layout forced while it loads (in
  // Firefox any layout read in the page, a scrollbar reading scrollY for one,
  // flushes the frames inside it too).
  sandbox.style.display = 'none';
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.tabIndex = -1;
  sandbox.srcdoc = '<!DOCTYPE html><meta charset="UTF-8"><title></title><body>';
  body.append(sandbox);
  return sandbox;
}

/** Entry point of the lazily loaded capture chunk. */
export function createCapturer(doc: Document): DomCapturer {
  return new DomCapturer(doc);
}

/**
 * The CSS properties the browser computes, without custom properties (ADR-051).
 * Read once per capturer: the list is the same for every element.
 */
export function standardProperties(doc: Document): string[] {
  const win = doc.defaultView;
  if (!win) return [];
  const computed = win.getComputedStyle(doc.documentElement);
  const names: string[] = [];
  for (let i = 0; i < computed.length; i++) {
    const name = computed.item(i);
    if (!name.startsWith('--')) names.push(name);
  }
  return names;
}
