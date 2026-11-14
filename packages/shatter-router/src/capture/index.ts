import {
  createContext,
  destroyContext,
  domToForeignObjectSvg,
  type Context,
} from 'modern-screenshot';
import { CaptureError, type CaptureRequest, type Capturer, type Snapshot } from '../core/snapshot';
import { deviceSize } from '../core/viewport';
import { CloneSession } from './clone-session';

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
  const forced = (win as unknown as { __SPIKE_GRID__?: LayoutGrid }).__SPIKE_GRID__;
  if (forced) return forced;
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

  /** The grid this engine needs the copy laid out on (see `layoutGridFor`). */
  readonly layoutGrid: LayoutGrid;

  constructor(private readonly doc: Document) {
    this.layoutGrid = doc.defaultView ? layoutGridFor(doc.defaultView) : 'css';
  }

  /** Creates the library context ahead of the first capture. */
  async warmUp(): Promise<void> {
    await this.ensureContext();
  }

  async capture(request: CaptureRequest): Promise<Snapshot> {
    const started = performance.now();
    const { doc } = this;
    const { viewport } = request;
    const size = deviceSize(viewport, request.maxTextureSize);
    const context = await this.ensureContext();
    // Measure only after the await: the page may have scrolled meanwhile.
    const rootRect = doc.documentElement.getBoundingClientRect();
    const session = new CloneSession(doc, {
      width: viewport.width,
      height: viewport.height,
      rootRect,
      layoutScale: this.layoutGrid === 'device' ? size.scale : 1,
    });

    context.width = rootRect.width;
    context.height = rootRect.height;
    context.filter = session.filter;
    context.onCloneEachNode = session.onCloneEachNode;
    context.onCloneNode = session.onCloneNode;
    context.onCreateForeignObjectSvg = session.onCreateForeignObjectSvg;

    let svg: SVGElement;
    try {
      svg = await domToForeignObjectSvg(context);
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
    }).then((context) => {
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

/** Entry point of the lazily loaded capture chunk. */
export function createCapturer(doc: Document): DomCapturer {
  return new DomCapturer(doc);
}
